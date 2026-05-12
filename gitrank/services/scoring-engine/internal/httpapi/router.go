package httpapi

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/httpkit"
	"github.com/gitrank/gitrank/services/scoring-engine/internal/service"
)

func NewRouter(cfg config.App, scoringService *service.Service, log *slog.Logger, version string) http.Handler {
	metrics := httpkit.NewMetrics(cfg.ServiceName)
	scoreMetrics := newScoreMetricsSource(cfg.ServiceName)
	manifest := contracts.ServiceManifest{
		Service:     cfg.ServiceName,
		Description: "Deterministic contribution scoring and explainability service.",
		Version:     version,
		Routes: []contracts.RouteSpec{
			{Method: "GET", Path: "/healthz", Summary: "Liveness probe", Status: "implemented"},
			{Method: "GET", Path: "/readyz", Summary: "Readiness probe", Status: "implemented"},
			{Method: "GET", Path: "/metrics", Summary: "Prometheus-style service metrics", Status: "implemented"},
			{Method: "GET", Path: "/v1/meta/manifest", Summary: "Service route manifest", Status: "implemented"},
			{Method: "POST", Path: "/v1/score/contribution", Summary: "Score an analyzed contribution", Status: "implemented"},
			{Method: "POST", Path: "/v1/score/users/{user_id}/replay", Summary: "Recompute and persist a user's score ledger from stored evidence", Status: "implemented"},
			{Method: "POST", Path: "/v1/score/users/{user_id}/replay/verify", Summary: "Verify deterministic score replay without mutating persisted scores", Status: "implemented"},
			{Method: "GET", Path: "/v1/score/users/{user_id}/snapshot", Summary: "Read the latest persisted aggregate score snapshot for a user", Status: "implemented"},
			{Method: "GET", Path: "/v1/score/users/{user_id}/events", Summary: "Read the latest persisted score event ledger for a user", Status: "implemented"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "PostgreSQL", Kind: "database", Purpose: "Score event ledger, replay runs, badges, and snapshots", Critical: true, Status: "implemented"},
		},
	}

	mux := http.NewServeMux()
	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"http": {Status: "ok", Details: "deterministic scoring route online"},
		}))
	})))
	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := scoringService.Ready(r.Context()); err != nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "scoring_dependencies_unavailable", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"database": {Status: "ok", Details: "score replay store reachable"},
		}))
	})))
	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))
	mux.Handle("/metrics", httpkit.RequireMethod(http.MethodGet, httpkit.MetricsHandler(metrics, scoreMetrics)))
	mux.Handle("/v1/score/contribution", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req contracts.ScoreContributionRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if err := req.Validate(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		start := time.Now()
		response := scoringService.Score(req)
		scoreMetrics.Observe(response.SuspiciousActivity, time.Since(start))
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/score/users/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/v1/score/users/") {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "score route not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/v1/score/users/")
		path = strings.Trim(path, "/")
		if path == "" {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "score route not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		parts := strings.Split(path, "/")
		userID := strings.TrimSpace(parts[0])
		if userID == "" {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_user", "user id is required", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		now := time.Now().UTC()
		switch {
		case len(parts) == 3 && parts[1] == "replay" && parts[2] == "verify":
			if r.Method != http.MethodPost {
				httpkit.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", httpkit.RequestIDFromContext(r.Context()))
				return
			}
			var req contracts.VerifyScoreReplayRequest
			if r.ContentLength != 0 {
				if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil && !errors.Is(err, io.EOF) {
					httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
					return
				}
			}
			response, err := scoringService.VerifyReplay(r.Context(), userID, req, now)
			if err != nil {
				writeScoringError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, response)
		case len(parts) == 2 && parts[1] == "replay":
			if r.Method != http.MethodPost {
				httpkit.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", httpkit.RequestIDFromContext(r.Context()))
				return
			}
			var req contracts.ReplayUserScoresRequest
			if r.ContentLength != 0 {
				if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil && !errors.Is(err, io.EOF) {
					httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
					return
				}
			}
			response, err := scoringService.ReplayUser(r.Context(), userID, req, now)
			if err != nil {
				scoreMetrics.ObserveReplayFailure(scoringErrorReason(err))
				writeScoringError(w, r, err)
				return
			}
			scoreMetrics.ObserveReplay(len(response.Badges), response.Events)
			httpkit.WriteJSON(w, http.StatusAccepted, response)
		case len(parts) == 2 && parts[1] == "snapshot":
			if r.Method != http.MethodGet {
				httpkit.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", httpkit.RequestIDFromContext(r.Context()))
				return
			}
			response, err := scoringService.LatestSnapshot(r.Context(), userID, now)
			if err != nil {
				writeScoringError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, response)
		case len(parts) == 2 && parts[1] == "events":
			if r.Method != http.MethodGet {
				httpkit.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", httpkit.RequestIDFromContext(r.Context()))
				return
			}
			response, err := scoringService.Events(r.Context(), userID, now)
			if err != nil {
				writeScoringError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, response)
		default:
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "score route not found", httpkit.RequestIDFromContext(r.Context()))
		}
	}))

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.Instrument(metrics), httpkit.AccessLog(log), httpkit.Recoverer(log))
}

func writeScoringError(w http.ResponseWriter, r *http.Request, err error) {
	requestID := httpkit.RequestIDFromContext(r.Context())
	switch scoringErrorReason(err) {
	case "not_found":
		httpkit.WriteError(w, http.StatusNotFound, "score_not_found", "scored evidence not found", requestID)
	case "invalid_request":
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error(), requestID)
	case "unavailable":
		httpkit.WriteError(w, http.StatusServiceUnavailable, "scoring_unavailable", err.Error(), requestID)
	default:
		httpkit.WriteError(w, http.StatusInternalServerError, "scoring_error", err.Error(), requestID)
	}
}

func scoringErrorReason(err error) string {
	switch {
	case errors.Is(err, service.ErrNotFound):
		return "not_found"
	case errors.Is(err, service.ErrInvalidRequest):
		return "invalid_request"
	case errors.Is(err, service.ErrUnavailable):
		return "unavailable"
	default:
		return "internal"
	}
}
