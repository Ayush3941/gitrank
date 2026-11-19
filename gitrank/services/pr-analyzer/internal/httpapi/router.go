package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/httpkit"
	"github.com/gitrank/gitrank/services/pr-analyzer/internal/analyzer"
)

func NewRouter(cfg config.App, log *slog.Logger, version string) http.Handler {
	return NewRouterWithStore(cfg, nil, log, version)
}

func NewRouterWithStore(cfg config.App, analysisStore *analyzer.Store, log *slog.Logger, version string) http.Handler {
	service := analyzer.New()
	summaries := analyzer.NewSummaryGenerator(analyzer.AIConfig{
		Provider:       cfg.AI.Provider,
		APIKey:         cfg.AI.APIKey,
		Model:          cfg.AI.Model,
		BaseURL:        cfg.AI.BaseURL,
		RequestTimeout: cfg.AI.RequestTimeout,
	})
	metrics := httpkit.NewMetrics(cfg.ServiceName)
	analysisMetrics := newAnalysisMetricsSource(cfg.ServiceName)
	manifest := contracts.ServiceManifest{
		Service:     cfg.ServiceName,
		Description: "Deterministic PR evidence analysis and on-demand, non-persistent AI explanations.",
		Version:     version,
		Routes: []contracts.RouteSpec{
			{Method: "GET", Path: "/healthz", Summary: "Liveness probe", Status: "implemented"},
			{Method: "GET", Path: "/readyz", Summary: "Readiness probe", Status: "implemented"},
			{Method: "GET", Path: "/metrics", Summary: "Prometheus-style service metrics", Status: "implemented"},
			{Method: "GET", Path: "/v1/meta/manifest", Summary: "Service route manifest", Status: "implemented"},
			{Method: "POST", Path: "/v1/analyze/pull-request", Summary: "Analyze PR structure and classify contribution type", Status: "implemented"},
			{Method: "POST", Path: "/v1/analyze/pull-request/execute", Summary: "Analyze already-synced PR evidence and persist the analysis artifact", Status: "implemented"},
			{Method: "POST", Path: "/v1/analyze/pull-request/summary", Summary: "Stream an AI explanation from stored PR evidence without persistence", Status: "implemented"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "PostgreSQL", Kind: "database", Purpose: "Persisted contribution analysis artifacts", Critical: true, Status: dependencyStatus(analysisStore != nil)},
			{Name: "AI chat completions API", Kind: "external_http", BaseURL: cfg.AI.BaseURL, Purpose: "On-demand PR explanations; never persisted or used in scoring", Auth: "API key", Critical: false, Status: "configured"},
		},
	}

	mux := http.NewServeMux()
	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"http": {Status: "ok", Details: "deterministic analysis route online"},
		}))
	})))
	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if analysisStore != nil {
			if err := analysisStore.Ready(r.Context()); err != nil {
				httpkit.WriteError(w, http.StatusServiceUnavailable, "analysis_store_unavailable", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, nil))
	})))
	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))
	mux.Handle("/metrics", httpkit.RequireMethod(http.MethodGet, httpkit.MetricsHandler(metrics, analysisMetrics)))
	mux.Handle("/v1/analyze/pull-request", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req contracts.PullRequestAnalysisRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if err := req.Validate(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		start := time.Now()
		response, err := service.AnalyzeContext(r.Context(), req)
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "analysis_validation_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if analysisStore != nil {
			persisted, err := analysisStore.SavePullRequestAnalysis(r.Context(), req, response, time.Now().UTC())
			if err != nil {
				if errors.Is(err, analyzer.ErrPullRequestNotFound) {
					httpkit.WriteError(w, http.StatusNotFound, "pull_request_not_found", "pull request evidence must be synced before analysis can be persisted", httpkit.RequestIDFromContext(r.Context()))
					return
				}
				httpkit.WriteError(w, http.StatusInternalServerError, "analysis_persistence_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
			response.AnalysisID = persisted.ID
			response.PullRequestID = persisted.PullRequestID
		}
		analysisMetrics.Observe(response.Category, time.Since(start), estimateAnalysisUsage(req, response, cfg.AI.Provider, cfg.AI.Model))
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))
	mux.Handle("/v1/analyze/pull-request/execute", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		analysisRequest, ok := loadStoredAnalysisRequest(w, r, analysisStore)
		if !ok {
			return
		}
		response, err := service.AnalyzeContext(r.Context(), analysisRequest)
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "analysis_validation_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		persisted, err := analysisStore.SavePullRequestAnalysis(r.Context(), analysisRequest, response, time.Now().UTC())
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "analysis_persistence_failed", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		response.AnalysisID = persisted.ID
		response.PullRequestID = persisted.PullRequestID
		analysisMetrics.Observe(response.Category, time.Since(start), estimateAnalysisUsage(analysisRequest, response, cfg.AI.Provider, cfg.AI.Model))
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))
	mux.Handle("/v1/analyze/pull-request/summary", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		req, ok := loadStoredAnalysisRequest(w, r, analysisStore)
		if !ok || !allowSummaryGeneration(w, r, req, cfg.AI) {
			return
		}
		baseline, err := service.AnalyzeContext(r.Context(), req)
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "analysis_validation_failed", "PR evidence could not be prepared for an explanation.", httpkit.RequestIDFromContext(r.Context()))
			return
		}
		response, err := summaries.Generate(r.Context(), req, baseline)
		if err != nil {
			var failure *analyzer.SummaryError
			if errors.As(err, &failure) {
				httpkit.WriteError(w, failure.Status, failure.Code, failure.Message, httpkit.RequestIDFromContext(r.Context()))
			} else {
				httpkit.WriteError(w, http.StatusInternalServerError, "summary_failed", "An AI explanation could not be generated.", httpkit.RequestIDFromContext(r.Context()))
			}
			return
		}
		defer response.Body.Close()
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "private, no-store")
		w.Header().Set("X-Accel-Buffering", "no")
		if err := httpkit.CopyStream(w, response.Body); err != nil && r.Context().Err() == nil {
			log.Warn("PR summary stream interrupted", "request_id", httpkit.RequestIDFromContext(r.Context()))
		}
	})))

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.Instrument(metrics), httpkit.AccessLog(log), httpkit.Recoverer(log))
}

func loadStoredAnalysisRequest(w http.ResponseWriter, r *http.Request, store *analyzer.Store) (contracts.PullRequestAnalysisRequest, bool) {
	var empty contracts.PullRequestAnalysisRequest
	if store == nil {
		httpkit.WriteError(w, http.StatusServiceUnavailable, "analysis_store_unavailable", "PR evidence storage is not configured", httpkit.RequestIDFromContext(r.Context()))
		return empty, false
	}
	var req contracts.SyncRequest
	if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return empty, false
	}
	req.Mode = "analysis_pull_request"
	if err := req.Normalize(); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return empty, false
	}
	loaded, err := store.LoadPullRequestAnalysisRequest(r.Context(), req.Repository, req.Number)
	if err != nil {
		status, code := http.StatusInternalServerError, "analysis_load_failed"
		if errors.Is(err, analyzer.ErrPullRequestNotFound) {
			status, code = http.StatusNotFound, "pull_request_not_found"
		}
		httpkit.WriteError(w, status, code, "Stored PR evidence is unavailable.", httpkit.RequestIDFromContext(r.Context()))
		return empty, false
	}
	return loaded, true
}

func allowSummaryGeneration(w http.ResponseWriter, r *http.Request, req contracts.PullRequestAnalysisRequest, cfg config.AI) bool {
	if err := enforceAnalysisLimits(req, cfg); err != nil {
		limitErr, ok := err.(analysisLimitError)
		if !ok {
			limitErr = analysisLimitError{code: "analysis_limit_exceeded", message: err.Error()}
		}
		httpkit.WriteError(w, http.StatusRequestEntityTooLarge, limitErr.code, limitErr.message, httpkit.RequestIDFromContext(r.Context()))
		return false
	}
	return true
}

func dependencyStatus(configured bool) string {
	if configured {
		return "implemented"
	}
	return "not_configured"
}
