package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/services/scheduler-worker/internal/app"
	"github.com/Ayush3941/gitrank/services/scheduler-worker/internal/service"
)

func NewRouter(cfg config.App, scheduler *service.Service, log *slog.Logger, version string) http.Handler {
	manifest := app.Manifest(cfg, version)
	mux := http.NewServeMux()
	metrics := httpkit.NewMetrics(cfg.ServiceName)

	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		workerDetails := "in-memory scheduler orchestration online"
		if cfg.Database.URL != "" {
			workerDetails = "postgres-backed scheduler state enabled"
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"worker": {Status: "ok", Details: workerDetails},
		}))
	})))

	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := scheduler.Ready(r.Context()); err != nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "scheduler_state_unavailable", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, nil))
	})))

	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))

	mux.Handle("/metrics", httpkit.RequireMethod(http.MethodGet, httpkit.MetricsHandler(metrics, scheduler.MetricsSource())))

	mux.Handle("/v1/jobs/config", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, scheduler.Config())
	})))

	mux.Handle("/v1/jobs/dead-letters/config", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, scheduler.DeadLetterConfig(time.Now().UTC()))
	})))

	mux.Handle("/v1/jobs", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/jobs" {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "resource not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}
		switch r.Method {
		case http.MethodGet:
			filter, err := decodeJobFilter(r)
			if err != nil {
				httpkit.WriteError(w, http.StatusBadRequest, "invalid_query", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, scheduler.QueueStatus(time.Now().UTC(), filter))
		default:
			writeMethodNotAllowed(w, r)
		}
	}))

	mux.Handle("/v1/jobs/sync", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req contracts.SyncRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		response, err := scheduler.EnqueueSync(req, httpkit.RequestIDFromContext(r.Context()), time.Now().UTC())
		if err != nil {
			writeSchedulerError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusAccepted, response)
	})))

	mux.Handle("/v1/jobs/tick", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response, err := scheduler.Tick(time.Now().UTC())
		if err != nil {
			writeSchedulerError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/jobs/lease", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req contracts.SchedulerLeaseRequest
		if r.ContentLength > 0 {
			if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
				httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
		}
		httpkit.WriteJSON(w, http.StatusOK, scheduler.Lease(req.Limit, time.Now().UTC()))
	})))

	mux.Handle("/v1/jobs/run-once", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response, err := scheduler.RunNext(r.Context(), time.Now().UTC())
		if err != nil {
			writeSchedulerError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/jobs/backfills", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			httpkit.WriteJSON(w, http.StatusOK, scheduler.BackfillPlans(time.Now().UTC()))
		case http.MethodPost:
			var req contracts.SchedulerBackfillPlanRequest
			if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
				httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
			plan, err := scheduler.CreateBackfillPlan(req, time.Now().UTC())
			if err != nil {
				writeSchedulerError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusCreated, plan)
		default:
			writeMethodNotAllowed(w, r)
		}
	}))

	mux.Handle("/v1/jobs/backfills/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		planID, action, ok := backfillPlanRoute(r.URL.Path)
		if !ok {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "backfill plan target not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		now := time.Now().UTC()
		switch {
		case r.Method == http.MethodDelete && action == "":
			response, err := scheduler.DeleteBackfillPlan(planID, now)
			if err != nil {
				writeSchedulerError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, response)
		case r.Method == http.MethodPost && action == "pause":
			response, err := scheduler.PauseBackfillPlan(planID, now)
			if err != nil {
				writeSchedulerError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, response)
		case r.Method == http.MethodPost && action == "resume":
			response, err := scheduler.ResumeBackfillPlan(planID, now)
			if err != nil {
				writeSchedulerError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, response)
		default:
			writeMethodNotAllowed(w, r)
		}
	}))

	mux.Handle("/v1/jobs/dead-letters", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/jobs/dead-letters" {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "resource not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}
		switch r.Method {
		case http.MethodGet:
			httpkit.WriteJSON(w, http.StatusOK, scheduler.DeadLetters(time.Now().UTC()))
		default:
			writeMethodNotAllowed(w, r)
		}
	}))

	mux.Handle("/v1/jobs/dead-letters/", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recordID, action, ok := deadLetterRoute(r.URL.Path)
		if !ok {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "dead-letter target not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if action != "replay" {
			writeMethodNotAllowed(w, r)
			return
		}
		response, err := scheduler.ReplayDeadLetter(recordID, httpkit.RequestIDFromContext(r.Context()), time.Now().UTC())
		if err != nil {
			writeSchedulerError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusAccepted, response)
	})))

	mux.Handle("/v1/jobs/", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		jobID, action, ok := jobActionRoute(r.URL.Path)
		if !ok {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "job action target not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		var (
			response contracts.SchedulerJobActionResponse
			err      error
		)
		now := time.Now().UTC()
		switch action {
		case "complete":
			response, err = scheduler.Complete(jobID, now)
		case "pause":
			response, err = scheduler.Pause(jobID, now)
		case "resume":
			response, err = scheduler.Resume(jobID, now)
		case "cancel":
			response, err = scheduler.Cancel(jobID, now)
		case "fail":
			var req contracts.SchedulerJobFailureRequest
			if r.ContentLength > 0 {
				if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
					httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
					return
				}
			}
			response, err = scheduler.Fail(jobID, req.ErrorMessage, now)
		default:
			writeMethodNotAllowed(w, r)
			return
		}
		if err != nil {
			writeSchedulerError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.Instrument(metrics), httpkit.AccessLog(log), httpkit.Recoverer(log))
}

func writeMethodNotAllowed(w http.ResponseWriter, r *http.Request) {
	httpkit.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", httpkit.RequestIDFromContext(r.Context()))
}

func writeSchedulerError(w http.ResponseWriter, r *http.Request, err error) {
	status := http.StatusBadRequest
	code := "scheduler_error"
	var rateLimitErr *service.RateLimitError
	switch {
	case errors.As(err, &rateLimitErr):
		status = http.StatusTooManyRequests
		code = "rate_limited"
		w.Header().Set("Retry-After", strconv.Itoa(int(rateLimitErr.RetryAfter.Seconds())+1))
	case strings.Contains(err.Error(), "not found"):
		status = http.StatusNotFound
		code = "not_found"
	case strings.Contains(err.Error(), "terminal"), strings.Contains(err.Error(), "not paused"):
		status = http.StatusConflict
		code = "invalid_job_state"
	}
	httpkit.WriteError(w, status, code, err.Error(), httpkit.RequestIDFromContext(r.Context()))
}

func jobActionRoute(path string) (string, string, bool) {
	suffix := strings.TrimPrefix(path, "/v1/jobs/")
	parts := strings.Split(strings.Trim(suffix, "/"), "/")
	if len(parts) != 2 {
		return "", "", false
	}
	if parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

func deadLetterRoute(path string) (string, string, bool) {
	suffix := strings.TrimPrefix(path, "/v1/jobs/dead-letters/")
	parts := strings.Split(strings.Trim(suffix, "/"), "/")
	if len(parts) != 2 {
		return "", "", false
	}
	if parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

func backfillPlanRoute(path string) (string, string, bool) {
	suffix := strings.TrimPrefix(path, "/v1/jobs/backfills/")
	parts := strings.Split(strings.Trim(suffix, "/"), "/")
	switch len(parts) {
	case 1:
		if parts[0] == "" {
			return "", "", false
		}
		return parts[0], "", true
	case 2:
		if parts[0] == "" || parts[1] == "" {
			return "", "", false
		}
		return parts[0], parts[1], true
	default:
		return "", "", false
	}
}

func decodeJobFilter(r *http.Request) (contracts.SchedulerJobFilter, error) {
	query := r.URL.Query()
	filter := contracts.SchedulerJobFilter{
		Type:          query.Get("type"),
		Status:        query.Get("status"),
		Repository:    query.Get("repository"),
		User:          query.Get("user"),
		Subject:       query.Get("subject"),
		CorrelationID: query.Get("correlation_id"),
	}
	if rawInstallationID := strings.TrimSpace(query.Get("installation_id")); rawInstallationID != "" {
		installationID, err := strconv.ParseInt(rawInstallationID, 10, 64)
		if err != nil || installationID <= 0 {
			return contracts.SchedulerJobFilter{}, errors.New("installation_id must be a positive integer")
		}
		filter.InstallationID = installationID
	}
	return filter, nil
}
