package httpapi

import (
	"log/slog"
	"net/http"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/services/pr-analyzer/internal/analyzer"
)

func NewRouter(cfg config.App, log *slog.Logger, version string) http.Handler {
	service := analyzer.New()
	metrics := httpkit.NewMetrics(cfg.ServiceName)
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
			{Name: "OpenAI Responses API", Kind: "external_http", BaseURL: cfg.AI.BaseURL, Purpose: "Future AI enrichment layer", Auth: "API key", Critical: false, Status: "configured"},
		},
	}

	mux := http.NewServeMux()
	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"http": {Status: "ok", Details: "deterministic analysis route online"},
		}))
	})))
	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, nil))
	})))
	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))
	mux.Handle("/metrics", httpkit.RequireMethod(http.MethodGet, metrics.Handler()))
	mux.Handle("/v1/analyze/pull-request", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req contracts.PullRequestAnalysisRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, service.Analyze(req))
	})))

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.Instrument(metrics), httpkit.AccessLog(log), httpkit.Recoverer(log))
}
