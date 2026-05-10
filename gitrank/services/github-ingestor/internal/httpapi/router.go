package httpapi

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/githubapi"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/packages/store"
	"github.com/Ayush3941/gitrank/services/github-ingestor/internal/app"
	"github.com/Ayush3941/gitrank/services/github-ingestor/internal/service"
)

const githubSyncQueueName = "github-sync"

var errWebhookPayloadTooLarge = errors.New("webhook payload exceeds configured maximum")

func NewRouter(cfg config.App, log *slog.Logger, version string) http.Handler {
	return NewRouterWithStores(cfg, store.NewInMemoryDeliveryStore(cfg.GitHub.DedupeTTL), store.NewInMemoryJobQueue(), nil, nil, log, version)
}

func NewRouterWithStores(cfg config.App, deliveryStore store.DeliveryStore, jobQueue *store.InMemoryJobQueue, persistence *service.Service, executor *service.Executor, log *slog.Logger, version string) http.Handler {
	manifest := app.Manifest(cfg, version)
	mux := http.NewServeMux()
	metrics := httpkit.NewMetrics(cfg.ServiceName)
	queueMetrics := queueMetricsSource{
		service:       cfg.ServiceName,
		queueName:     githubSyncQueueName,
		deliveryStore: deliveryStore,
		jobQueue:      jobQueue,
	}
	syncMetrics := newSyncMetricsSource(cfg.ServiceName)
	persistenceMetrics := newPersistenceMetricsSource(cfg.ServiceName)

	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		checks := map[string]contracts.ComponentCheck{
			"http":  {Status: "ok", Details: "webhook and sync routes online"},
			"queue": {Status: "ok", Details: "preview queue enabled"},
		}
		if cfg.GitHub.WebhookSecret != "" {
			checks["webhook_secret"] = contracts.ComponentCheck{Status: "ok", Details: "signature validation configured"}
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, checks))
	})))

	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if persistence != nil {
			if err := persistence.Ready(r.Context()); err != nil {
				httpkit.WriteError(w, http.StatusServiceUnavailable, "github_persistence_unavailable", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, nil))
	})))

	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))

	mux.Handle("/metrics", httpkit.RequireMethod(http.MethodGet, httpkit.MetricsHandler(metrics, queueMetrics, syncMetrics, persistenceMetrics)))

	mux.Handle("/webhooks/github", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := readWebhookBody(r, cfg.GitHub.MaxBodyBytes)
		if err != nil {
			status := http.StatusBadRequest
			code := "invalid_payload"
			if errors.Is(err, errWebhookPayloadTooLarge) {
				status = http.StatusRequestEntityTooLarge
				code = "payload_too_large"
			}
			httpkit.WriteError(w, status, code, err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		if err := githubapi.VerifyWebhookSignature(cfg.GitHub.WebhookSecret, body, r.Header.Get("X-Hub-Signature-256")); err != nil {
			httpkit.WriteError(w, http.StatusUnauthorized, "invalid_signature", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		envelope, err := githubapi.ParseWebhookEnvelope(r.Header, body)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_webhook", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		delivery, err := store.NewWebhookDelivery(store.WebhookDeliveryInput{
			DeliveryID:     envelope.DeliveryID,
			EventType:      envelope.EventType,
			Action:         envelope.Action,
			Repository:     envelope.Repository,
			InstallationID: envelope.Installation,
			Signature:      envelope.Signature,
			Payload:        body,
			ReceivedAt:     time.Now().UTC(),
		})
		if err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_delivery_record", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		duplicate, err := deliveryStore.Remember(delivery)
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "delivery_store_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if duplicate {
			httpkit.WriteJSON(w, http.StatusAccepted, contracts.GitHubWebhookReceipt{
				DeliveryID:      envelope.DeliveryID,
				EventType:       envelope.EventType,
				Action:          envelope.Action,
				Repository:      envelope.Repository,
				Installation:    envelope.Installation,
				SignatureOK:     true,
				ReplayProtected: true,
				Deduplicated:    true,
				DeliveryStatus:  string(store.DeliveryDuplicate),
				QueueName:       githubSyncQueueName,
			})
			return
		}

		if persistence != nil {
			result, err := persistence.PersistWebhook(r.Context(), envelope, httpkit.RequestIDFromContext(r.Context()), time.Now().UTC())
			if err != nil {
				_ = deliveryStore.MarkStatus(envelope.DeliveryID, store.DeliveryFailed, err)
				persistenceMetrics.ObserveFailure(envelope.EventType)
				httpkit.WriteError(w, http.StatusInternalServerError, "github_persistence_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
			persistenceMetrics.Observe(envelope.EventType, result)
		}

		jobs, err := webhookJobs(cfg, envelope, httpkit.RequestIDFromContext(r.Context()))
		if err != nil {
			_ = deliveryStore.MarkStatus(envelope.DeliveryID, store.DeliveryFailed, err)
			httpkit.WriteError(w, http.StatusInternalServerError, "queue_job_build_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		jobIDs, err := enqueueJobs(jobQueue, jobs)
		if err != nil {
			_ = deliveryStore.MarkStatus(envelope.DeliveryID, store.DeliveryFailed, err)
			httpkit.WriteError(w, http.StatusInternalServerError, "queue_enqueue_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		_ = deliveryStore.MarkStatus(envelope.DeliveryID, store.DeliveryEnqueued, nil)

		httpkit.WriteJSON(w, http.StatusAccepted, contracts.GitHubWebhookReceipt{
			DeliveryID:      envelope.DeliveryID,
			EventType:       envelope.EventType,
			Action:          envelope.Action,
			Repository:      envelope.Repository,
			Installation:    envelope.Installation,
			SignatureOK:     true,
			ReplayProtected: true,
			Deduplicated:    false,
			DeliveryStatus:  string(store.DeliveryEnqueued),
			JobIDs:          jobIDs,
			QueueName:       githubSyncQueueName,
		})
	})))

	mux.Handle("/v1/webhooks/github/deliveries/", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		deliveryID, ok := requeueDeliveryID(r.URL.Path)
		if !ok {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "delivery requeue target not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		delivery, found, err := deliveryStore.Lookup(deliveryID)
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "delivery_lookup_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if !found {
			httpkit.WriteError(w, http.StatusNotFound, "delivery_not_found", "webhook delivery not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		envelope, err := deliveryEnvelope(delivery)
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "delivery_requeue_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if persistence != nil {
			result, err := persistence.PersistWebhook(r.Context(), envelope, httpkit.RequestIDFromContext(r.Context()), time.Now().UTC())
			if err != nil {
				_ = deliveryStore.MarkStatus(delivery.DeliveryID, store.DeliveryFailed, err)
				persistenceMetrics.ObserveFailure(envelope.EventType)
				httpkit.WriteError(w, http.StatusInternalServerError, "github_persistence_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
			persistenceMetrics.Observe(envelope.EventType, result)
		}
		jobs, err := webhookJobs(cfg, envelope, httpkit.RequestIDFromContext(r.Context()))
		if err != nil {
			_ = deliveryStore.MarkStatus(delivery.DeliveryID, store.DeliveryFailed, err)
			httpkit.WriteError(w, http.StatusInternalServerError, "delivery_requeue_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		jobIDs, err := enqueueJobs(jobQueue, jobs)
		if err != nil {
			_ = deliveryStore.MarkStatus(delivery.DeliveryID, store.DeliveryFailed, err)
			httpkit.WriteError(w, http.StatusInternalServerError, "queue_enqueue_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		_ = deliveryStore.MarkStatus(delivery.DeliveryID, store.DeliveryEnqueued, nil)

		httpkit.WriteJSON(w, http.StatusAccepted, contracts.GitHubWebhookReceipt{
			DeliveryID:      envelope.DeliveryID,
			EventType:       envelope.EventType,
			Action:          envelope.Action,
			Repository:      envelope.Repository,
			Installation:    envelope.Installation,
			SignatureOK:     delivery.Signature != "",
			ReplayProtected: true,
			Deduplicated:    false,
			DeliveryStatus:  string(store.DeliveryEnqueued),
			JobIDs:          jobIDs,
			QueueName:       githubSyncQueueName,
		})
	})))

	mux.Handle("/v1/sync/preview", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		status := "preview"
		mode := "unknown"
		defer func() {
			syncMetrics.Observe(mode, status, time.Since(start))
		}()

		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			status = "invalid_json"
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if req.Mode != "" {
			mode = req.Mode
		}

		jobs, err := store.BuildSyncJobs(req, githubSyncQueueName, httpkit.RequestIDFromContext(r.Context()), cfg.Scheduler.MaxAttempts)
		if err != nil {
			status = "invalid_request"
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		httpkit.WriteJSON(w, http.StatusOK, queuePreview("preview", jobs, false))
	})))

	mux.Handle("/v1/sync/runs", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if persistence == nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "github_persistence_unavailable", "sync run persistence is not configured", httpkit.RequestIDFromContext(r.Context()))
			return
		}
		filter := contracts.GitHubSyncRunFilter{
			RunType:                r.URL.Query().Get("run_type"),
			Status:                 r.URL.Query().Get("status"),
			Subject:                r.URL.Query().Get("subject"),
			Repository:             r.URL.Query().Get("repository"),
			User:                   r.URL.Query().Get("user"),
			RequestedBySubject:     r.URL.Query().Get("requested_by_subject"),
			RequestedByGitHubLogin: r.URL.Query().Get("requested_by_github_login"),
			CorrelationID:          r.URL.Query().Get("correlation_id"),
			DeliveryID:             r.URL.Query().Get("delivery_id"),
		}
		if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
			limit, err := strconv.Atoi(rawLimit)
			if err != nil || limit <= 0 {
				httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_filter", "limit must be a positive integer", httpkit.RequestIDFromContext(r.Context()))
				return
			}
			filter.Limit = limit
		}

		response, err := persistence.ListSyncRuns(r.Context(), filter)
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "sync_run_query_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/sync/repository/execute", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if executor == nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "github_sync_unavailable", "repository sync execution is not configured", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		req.Mode = "repository"
		req.Repository = strings.TrimSpace(req.Repository)
		if err := req.Normalize(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		startedAt := time.Now().UTC()
		response, err := executor.SyncRepository(r.Context(), req, service.SyncRequestActor{
			Subject:     strings.TrimSpace(r.Header.Get("X-GitRank-Subject")),
			GitHubLogin: strings.TrimSpace(r.Header.Get("X-GitRank-GitHub-Login")),
		}, httpkit.RequestIDFromContext(r.Context()), startedAt)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadGateway, "github_repository_sync_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/sync/user/execute", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if executor == nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "github_sync_unavailable", "user sync execution is not configured", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		req.Mode = "user"
		req.User = strings.TrimSpace(req.User)
		if err := req.Normalize(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		startedAt := time.Now().UTC()
		response, err := executor.SyncUser(r.Context(), req, service.SyncRequestActor{
			Subject:     strings.TrimSpace(r.Header.Get("X-GitRank-Subject")),
			GitHubLogin: strings.TrimSpace(r.Header.Get("X-GitRank-GitHub-Login")),
		}, httpkit.RequestIDFromContext(r.Context()), startedAt)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadGateway, "github_user_sync_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/sync/installation/execute", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if executor == nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "github_sync_unavailable", "installation sync execution is not configured", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		req.Mode = "installation"
		if err := req.Normalize(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		startedAt := time.Now().UTC()
		response, err := executor.SyncInstallation(r.Context(), req, service.SyncRequestActor{
			Subject:     strings.TrimSpace(r.Header.Get("X-GitRank-Subject")),
			GitHubLogin: strings.TrimSpace(r.Header.Get("X-GitRank-GitHub-Login")),
		}, httpkit.RequestIDFromContext(r.Context()), startedAt)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadGateway, "github_installation_sync_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/sync/pull-request/execute", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if executor == nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "github_sync_unavailable", "pull request sync execution is not configured", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		req.Mode = "pull_request"
		req.Repository = strings.TrimSpace(req.Repository)
		if err := req.Normalize(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		startedAt := time.Now().UTC()
		response, err := executor.SyncPullRequest(r.Context(), req, service.SyncRequestActor{
			Subject:     strings.TrimSpace(r.Header.Get("X-GitRank-Subject")),
			GitHubLogin: strings.TrimSpace(r.Header.Get("X-GitRank-GitHub-Login")),
		}, httpkit.RequestIDFromContext(r.Context()), startedAt)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadGateway, "github_pull_request_sync_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/sync/review/execute", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if executor == nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "github_sync_unavailable", "review sync execution is not configured", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		req.Mode = "review"
		req.Repository = strings.TrimSpace(req.Repository)
		if err := req.Normalize(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		startedAt := time.Now().UTC()
		response, err := executor.SyncReview(r.Context(), req, service.SyncRequestActor{
			Subject:     strings.TrimSpace(r.Header.Get("X-GitRank-Subject")),
			GitHubLogin: strings.TrimSpace(r.Header.Get("X-GitRank-GitHub-Login")),
		}, httpkit.RequestIDFromContext(r.Context()), startedAt)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadGateway, "github_review_sync_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/sync/issue/execute", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if executor == nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "github_sync_unavailable", "issue sync execution is not configured", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		req.Mode = "issue"
		req.Repository = strings.TrimSpace(req.Repository)
		if err := req.Normalize(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		startedAt := time.Now().UTC()
		response, err := executor.SyncIssue(r.Context(), req, service.SyncRequestActor{
			Subject:     strings.TrimSpace(r.Header.Get("X-GitRank-Subject")),
			GitHubLogin: strings.TrimSpace(r.Header.Get("X-GitRank-GitHub-Login")),
		}, httpkit.RequestIDFromContext(r.Context()), startedAt)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadGateway, "github_issue_sync_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/sync/commit/execute", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if executor == nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "github_sync_unavailable", "commit sync execution is not configured", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		req.Mode = "commit"
		req.Repository = strings.TrimSpace(req.Repository)
		req.SHA = strings.TrimSpace(req.SHA)
		if err := req.Normalize(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		startedAt := time.Now().UTC()
		response, err := executor.SyncCommit(r.Context(), req, service.SyncRequestActor{
			Subject:     strings.TrimSpace(r.Header.Get("X-GitRank-Subject")),
			GitHubLogin: strings.TrimSpace(r.Header.Get("X-GitRank-GitHub-Login")),
		}, httpkit.RequestIDFromContext(r.Context()), startedAt)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadGateway, "github_commit_sync_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	registerSyncRoute(mux, cfg, jobQueue, persistence, syncMetrics, "/v1/sync/installation", "installation")
	registerSyncRoute(mux, cfg, jobQueue, persistence, syncMetrics, "/v1/sync/user", "user")
	registerSyncRoute(mux, cfg, jobQueue, persistence, syncMetrics, "/v1/sync/repository", "repository")
	registerSyncRoute(mux, cfg, jobQueue, persistence, syncMetrics, "/v1/sync/pull-request", "pull_request")
	registerSyncRoute(mux, cfg, jobQueue, persistence, syncMetrics, "/v1/sync/review", "review")
	registerSyncRoute(mux, cfg, jobQueue, persistence, syncMetrics, "/v1/sync/issue", "issue")
	registerSyncRoute(mux, cfg, jobQueue, persistence, syncMetrics, "/v1/sync/commit", "commit")

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.Instrument(metrics), httpkit.AccessLog(log), httpkit.Recoverer(log))
}

func readWebhookBody(r *http.Request, maxBytes int) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(r.Body, int64(maxBytes)+1))
	if err != nil {
		return nil, err
	}
	if len(body) > maxBytes {
		return nil, errWebhookPayloadTooLarge
	}
	return body, nil
}

func enqueueJobs(queue *store.InMemoryJobQueue, jobs []store.QueueJob) ([]string, error) {
	ids := make([]string, 0, len(jobs))
	for _, job := range jobs {
		if err := queue.Enqueue(job); err != nil {
			return nil, err
		}
		ids = append(ids, job.ID)
	}
	return ids, nil
}

func queuePreview(status string, jobs []store.QueueJob, deduplicated bool) contracts.GitHubQueuePreview {
	jobIDs := make([]string, 0, len(jobs))
	jobTypes := make([]string, 0, len(jobs))
	correlationID := ""
	for _, job := range jobs {
		jobIDs = append(jobIDs, job.ID)
		jobTypes = append(jobTypes, string(job.Type))
		if correlationID == "" {
			correlationID = job.CorrelationID
		}
	}

	return contracts.GitHubQueuePreview{
		Status:        status,
		JobIDs:        jobIDs,
		JobTypes:      jobTypes,
		QueueName:     githubSyncQueueName,
		CorrelationID: correlationID,
		Deduplicated:  deduplicated,
		AcceptedAt:    time.Now().UTC(),
	}
}

func requeueDeliveryID(path string) (string, bool) {
	suffix := strings.TrimPrefix(path, "/v1/webhooks/github/deliveries/")
	if !strings.HasSuffix(suffix, "/requeue") {
		return "", false
	}
	deliveryID := strings.TrimSuffix(suffix, "/requeue")
	deliveryID = strings.Trim(deliveryID, "/")
	if deliveryID == "" || strings.Contains(deliveryID, "/") {
		return "", false
	}
	return deliveryID, true
}

func deliveryEnvelope(delivery store.WebhookDelivery) (githubapi.WebhookEnvelope, error) {
	headers := http.Header{}
	headers.Set("X-GitHub-Delivery", delivery.DeliveryID)
	headers.Set("X-GitHub-Event", delivery.EventType)
	headers.Set("X-Hub-Signature-256", delivery.Signature)
	return githubapi.ParseWebhookEnvelope(headers, delivery.Payload)
}

func webhookJobs(cfg config.App, envelope githubapi.WebhookEnvelope, correlationID string) ([]store.QueueJob, error) {
	payload := map[string]any{
		"delivery_id":     envelope.DeliveryID,
		"event_type":      envelope.EventType,
		"action":          envelope.Action,
		"repository":      envelope.Repository,
		"repository_id":   envelope.RepositoryID,
		"installation_id": envelope.Installation,
		"number":          envelope.Number,
		"review_id":       envelope.ReviewID,
		"commit_sha":      envelope.CommitSHA,
	}

	jobType := store.SyncRepositoryJob
	switch envelope.EventType {
	case "installation", "installation_repositories":
		jobType = store.SyncInstallationJob
	case "pull_request", "pull_request_target":
		jobType = store.SyncPullRequestJob
	case "pull_request_review", "pull_request_review_comment":
		jobType = store.SyncReviewJob
	case "issues", "issue_comment", "label", "milestone":
		jobType = store.SyncIssueJob
	case "push", "create", "delete", "check_run", "check_suite":
		jobType = store.SyncCommitJob
	case "repository":
		jobType = store.SyncRepositoryJob
	}

	job, err := store.NewQueueJob(store.QueueJobInput{
		QueueName:      githubSyncQueueName,
		Type:           jobType,
		CorrelationID:  correlationID,
		DeliveryID:     envelope.DeliveryID,
		InstallationID: envelope.Installation,
		Repository:     envelope.Repository,
		Subject:        webhookSubject(envelope),
		DedupeKey:      "delivery:" + envelope.DeliveryID,
		MaxAttempts:    cfg.Scheduler.MaxAttempts,
		Payload:        payload,
	})
	if err != nil {
		return nil, err
	}
	return []store.QueueJob{job}, nil
}

func registerSyncRoute(mux *http.ServeMux, cfg config.App, queue *store.InMemoryJobQueue, persistence *service.Service, syncMetrics *syncMetricsSource, path, mode string) {
	mux.Handle(path, httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		status := "queued"
		defer func() {
			syncMetrics.Observe(mode, status, time.Since(start))
		}()

		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			status = "invalid_json"
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		req.Mode = mode

		jobs, err := store.BuildSyncJobs(req, githubSyncQueueName, httpkit.RequestIDFromContext(r.Context()), cfg.Scheduler.MaxAttempts)
		if err != nil {
			status = "invalid_request"
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if _, err := enqueueJobs(queue, jobs); err != nil {
			status = "enqueue_failed"
			httpkit.WriteError(w, http.StatusInternalServerError, "queue_enqueue_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if persistence != nil {
			actor := service.SyncRequestActor{
				Subject:     strings.TrimSpace(r.Header.Get("X-GitRank-Subject")),
				GitHubLogin: strings.TrimSpace(r.Header.Get("X-GitRank-GitHub-Login")),
			}
			if err := persistence.RecordQueuedSyncRequest(r.Context(), req, actor, jobs, httpkit.RequestIDFromContext(r.Context()), start.UTC()); err != nil {
				status = "traceability_failed"
				httpkit.WriteError(w, http.StatusInternalServerError, "sync_traceability_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
		}
		httpkit.WriteJSON(w, http.StatusAccepted, queuePreview("queued", jobs, false))
	})))
}

func webhookSubject(envelope githubapi.WebhookEnvelope) string {
	switch {
	case envelope.Repository != "" && envelope.Number > 0:
		return envelope.Repository + "#" + strconv.Itoa(envelope.Number)
	case envelope.Repository != "" && envelope.CommitSHA != "":
		return envelope.Repository + "@" + envelope.CommitSHA
	case envelope.Repository != "":
		return envelope.Repository
	case envelope.Installation > 0:
		return strconv.FormatInt(envelope.Installation, 10)
	default:
		return envelope.EventType
	}
}
