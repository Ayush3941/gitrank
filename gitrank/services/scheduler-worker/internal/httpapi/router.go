package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/packages/store"
	"github.com/Ayush3941/gitrank/services/scheduler-worker/internal/app"
)

func NewRouter(cfg config.App, log *slog.Logger, version string) http.Handler {
	manifest := app.Manifest(cfg, version)
	mux := http.NewServeMux()
	metrics := httpkit.NewMetrics(cfg.ServiceName)

	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"worker": {Status: "ok", Details: "scheduler configuration route online"},
		}))
	})))

	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, nil))
	})))

	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))

	mux.Handle("/metrics", httpkit.RequireMethod(http.MethodGet, metrics.Handler()))

	mux.Handle("/v1/jobs/config", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.SchedulerConfigResponse{
			SyncCron:          cfg.Scheduler.SyncCron,
			MaxAttempts:       cfg.Scheduler.MaxAttempts,
			RetryBackoff:      cfg.Scheduler.RetryBackoff.String(),
			WorkerConcurrency: cfg.Scheduler.WorkerConcurrency,
			LeaseTTL:          cfg.Scheduler.LeaseTTL.String(),
			PollInterval:      cfg.Scheduler.PollInterval.String(),
			DeadLetterQueue:   cfg.Scheduler.DeadLetterQueue,
			SupportedJobTypes: supportedJobTypes(),
		})
	})))

	mux.Handle("/v1/jobs/dead-letters/config", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.DeadLetterQueueStatus{
			QueueName:     cfg.Scheduler.DeadLetterQueue,
			PoisonJobs:    0,
			LastUpdatedAt: time.Now().UTC(),
		})
	})))

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.Instrument(metrics), httpkit.AccessLog(log), httpkit.Recoverer(log))
}

func supportedJobTypes() []string {
	types := store.SupportedSyncJobTypes()
	labels := make([]string, 0, len(types))
	for _, jobType := range types {
		labels = append(labels, string(jobType))
	}
	return labels
}
