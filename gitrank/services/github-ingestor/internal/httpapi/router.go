package httpapi

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/githubapi"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/packages/store"
	"github.com/Ayush3941/gitrank/services/github-ingestor/internal/app"
)

const githubSyncQueueName = "github-sync"

var errWebhookPayloadTooLarge = errors.New("webhook payload exceeds configured maximum")

func NewRouter(cfg config.App, log *slog.Logger, version string) http.Handler {
	manifest := app.Manifest(cfg, version)
	deliveryStore := store.NewInMemoryDeliveryStore(cfg.GitHub.DedupeTTL)
	jobQueue := store.NewInMemoryJobQueue()
	mux := http.NewServeMux()
	metrics := httpkit.NewMetrics(cfg.ServiceName)

	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		checks := map[string]contracts.ComponentCheck{
			"http":  {Status: "ok", Details: "webhook and sync routes online"},
			"queue": {Status: "ok", Details: "in-memory queue preview enabled"},
		}
		if cfg.GitHub.WebhookSecret != "" {
			checks["webhook_secret"] = contracts.ComponentCheck{Status: "ok", Details: "signature validation configured"}
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, checks))
	})))

	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, nil))
	})))

	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))

	mux.Handle("/metrics", httpkit.RequireMethod(http.MethodGet, metrics.Handler()))

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

	mux.Handle("/v1/sync/preview", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		jobs, err := manualSyncJobs(cfg, req, httpkit.RequestIDFromContext(r.Context()))
		if err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		httpkit.WriteJSON(w, http.StatusOK, queuePreview("preview", jobs, false))
	})))

	registerSyncRoute(mux, cfg, jobQueue, "/v1/sync/installation", "installation")
	registerSyncRoute(mux, cfg, jobQueue, "/v1/sync/user", "user")
	registerSyncRoute(mux, cfg, jobQueue, "/v1/sync/repository", "repository")
	registerSyncRoute(mux, cfg, jobQueue, "/v1/sync/pull-request", "pull_request")
	registerSyncRoute(mux, cfg, jobQueue, "/v1/sync/review", "review")
	registerSyncRoute(mux, cfg, jobQueue, "/v1/sync/issue", "issue")
	registerSyncRoute(mux, cfg, jobQueue, "/v1/sync/commit", "commit")

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

func manualSyncJobs(cfg config.App, req contracts.SyncRequest, correlationID string) ([]store.QueueJob, error) {
	switch req.Mode {
	case "installation":
		if req.InstallationID <= 0 {
			return nil, errors.New("installation_id is required when mode=installation")
		}
		job, err := store.NewQueueJob(store.QueueJobInput{
			QueueName:      githubSyncQueueName,
			Type:           store.SyncInstallationJob,
			CorrelationID:  correlationID,
			InstallationID: req.InstallationID,
			Subject:        strconv.FormatInt(req.InstallationID, 10),
			DedupeKey:      "installation:" + strconv.FormatInt(req.InstallationID, 10),
			MaxAttempts:    cfg.Scheduler.MaxAttempts,
			Payload: map[string]any{
				"installation_id": req.InstallationID,
				"mode":            "installation",
			},
		})
		if err != nil {
			return nil, err
		}
		return []store.QueueJob{job}, nil
	case "user":
		if req.User == "" {
			return nil, errors.New("user is required when mode=user")
		}
		job, err := store.NewQueueJob(store.QueueJobInput{
			QueueName:     githubSyncQueueName,
			Type:          store.SyncUserHistoryJob,
			CorrelationID: correlationID,
			Subject:       req.User,
			DedupeKey:     "user:" + req.User,
			MaxAttempts:   cfg.Scheduler.MaxAttempts,
			Payload: map[string]string{
				"user": req.User,
				"mode": "user",
			},
		})
		if err != nil {
			return nil, err
		}
		return []store.QueueJob{job}, nil
	case "repository":
		if req.Repository == "" {
			return nil, errors.New("repository is required when mode=repository")
		}
		job, err := store.NewQueueJob(store.QueueJobInput{
			QueueName:     githubSyncQueueName,
			Type:          store.SyncRepositoryJob,
			CorrelationID: correlationID,
			Repository:    req.Repository,
			DedupeKey:     "repository:" + req.Repository,
			MaxAttempts:   cfg.Scheduler.MaxAttempts,
			Payload: map[string]string{
				"repository": req.Repository,
				"mode":       "repository",
			},
		})
		if err != nil {
			return nil, err
		}
		return []store.QueueJob{job}, nil
	case "pull_request":
		if req.Repository == "" || req.Number <= 0 {
			return nil, errors.New("repository and number are required when mode=pull_request")
		}
		return resourceJobs(cfg, correlationID, store.SyncPullRequestJob, req.Repository, req.Number, "", "pull_request")
	case "review":
		if req.Repository == "" || req.Number <= 0 {
			return nil, errors.New("repository and number are required when mode=review")
		}
		return resourceJobs(cfg, correlationID, store.SyncReviewJob, req.Repository, req.Number, "", "review")
	case "issue":
		if req.Repository == "" || req.Number <= 0 {
			return nil, errors.New("repository and number are required when mode=issue")
		}
		return resourceJobs(cfg, correlationID, store.SyncIssueJob, req.Repository, req.Number, "", "issue")
	case "commit":
		if req.Repository == "" || req.SHA == "" {
			return nil, errors.New("repository and sha are required when mode=commit")
		}
		return resourceJobs(cfg, correlationID, store.SyncCommitJob, req.Repository, 0, req.SHA, "commit")
	default:
		return nil, errors.New("unsupported sync mode")
	}
}

func registerSyncRoute(mux *http.ServeMux, cfg config.App, queue *store.InMemoryJobQueue, path, mode string) {
	mux.Handle(path, httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		req.Mode = mode

		jobs, err := manualSyncJobs(cfg, req, httpkit.RequestIDFromContext(r.Context()))
		if err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_sync_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if _, err := enqueueJobs(queue, jobs); err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "queue_enqueue_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusAccepted, queuePreview("queued", jobs, false))
	})))
}

func resourceJobs(
	cfg config.App,
	correlationID string,
	jobType store.SyncJobType,
	repository string,
	number int,
	sha string,
	mode string,
) ([]store.QueueJob, error) {
	subject := repository
	payload := map[string]any{
		"repository": repository,
		"mode":       mode,
	}
	dedupeKey := mode + ":" + repository
	if number > 0 {
		subject = repository + "#" + strconv.Itoa(number)
		payload["number"] = number
		dedupeKey = subject
	}
	if sha != "" {
		subject = repository + "@" + sha
		payload["sha"] = sha
		dedupeKey = subject
	}

	job, err := store.NewQueueJob(store.QueueJobInput{
		QueueName:     githubSyncQueueName,
		Type:          jobType,
		CorrelationID: correlationID,
		Repository:    repository,
		Subject:       subject,
		DedupeKey:     dedupeKey,
		MaxAttempts:   cfg.Scheduler.MaxAttempts,
		Payload:       payload,
	})
	if err != nil {
		return nil, err
	}
	return []store.QueueJob{job}, nil
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
