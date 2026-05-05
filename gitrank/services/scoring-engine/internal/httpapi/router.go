package httpapi

import (
	"log/slog"
	"net/http"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/services/scoring-engine/internal/scoring"
)

func NewRouter(cfg config.App, log *slog.Logger, version string) http.Handler {
	engine := scoring.New()
	manifest := contracts.ServiceManifest{
		Service:     cfg.ServiceName,
		Description: "Deterministic contribution scoring and explainability service.",
		Version:     version,
		Routes: []contracts.RouteSpec{
			{Method: "GET", Path: "/healthz", Summary: "Liveness probe", Status: "implemented"},
			{Method: "GET", Path: "/readyz", Summary: "Readiness probe", Status: "implemented"},
			{Method: "GET", Path: "/v1/meta/manifest", Summary: "Service route manifest", Status: "implemented"},
			{Method: "POST", Path: "/v1/score/contribution", Summary: "Score an analyzed contribution", Status: "implemented"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "PostgreSQL", Kind: "database", Purpose: "Score event ledger and snapshots", Critical: true, Status: "planned"},
		},
	}

	mux := http.NewServeMux()
	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"http": {Status: "ok", Details: "deterministic scoring route online"},
		}))
	})))
	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, nil))
	})))
	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))
	mux.Handle("/v1/score/contribution", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req contracts.ScoreContributionRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, engine.Score(req))
	})))

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.AccessLog(log), httpkit.Recoverer(log))
}
