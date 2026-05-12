package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/services/pr-analyzer/internal/analyzer"
)

func NewRouter(cfg config.App, log *slog.Logger, version string) http.Handler {
	return NewRouterWithStore(cfg, nil, log, version)
}

func NewRouterWithStore(cfg config.App, analysisStore *analyzer.Store, log *slog.Logger, version string) http.Handler {
	service := analyzer.New()
	metrics := httpkit.NewMetrics(cfg.ServiceName)
	analysisMetrics := newAnalysisMetricsSource(cfg.ServiceName)
	manifest := contracts.ServiceManifest{
		Service:     cfg.ServiceName,
		Description: "Deterministic pull-request analysis and AI-enrichment boundary.",
		Version:     version,
		Routes: []contracts.RouteSpec{
			{Method: "GET", Path: "/healthz", Summary: "Liveness probe", Status: "implemented"},
			{Method: "GET", Path: "/readyz", Summary: "Readiness probe", Status: "implemented"},
			{Method: "GET", Path: "/metrics", Summary: "Prometheus-style service metrics", Status: "implemented"},
			{Method: "GET", Path: "/v1/meta/manifest", Summary: "Service route manifest", Status: "implemented"},
			{Method: "POST", Path: "/v1/analyze/pull-request", Summary: "Analyze PR structure and classify contribution type", Status: "implemented"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "PostgreSQL", Kind: "database", Purpose: "Persisted contribution analysis artifacts", Critical: true, Status: dependencyStatus(analysisStore != nil)},
			{Name: "OpenAI Responses API", Kind: "external_http", BaseURL: cfg.AI.BaseURL, Purpose: "Future AI enrichment layer", Auth: "API key", Critical: false, Status: "configured"},
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
		if err := enforceAnalysisLimits(req, cfg.AI); err != nil {
			limitErr, ok := err.(analysisLimitError)
			if !ok {
				limitErr = analysisLimitError{code: "analysis_limit_exceeded", message: err.Error()}
			}
			httpkit.WriteError(w, http.StatusRequestEntityTooLarge, limitErr.code, limitErr.message, httpkit.RequestIDFromContext(r.Context()))
			return
		}
		start := time.Now()
		response, err := service.Analyze(req)
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

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.Instrument(metrics), httpkit.AccessLog(log), httpkit.Recoverer(log))
}

func dependencyStatus(configured bool) string {
	if configured {
		return "implemented"
	}
	return "not_configured"
}
