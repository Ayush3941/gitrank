package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/services/profile-service/internal/app"
	"github.com/Ayush3941/gitrank/services/profile-service/internal/service"
)

func NewRouter(cfg config.App, profileService *service.Service, log *slog.Logger, version string) http.Handler {
	manifest := app.Manifest(cfg, version)
	mux := http.NewServeMux()

	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		checks := map[string]contracts.ComponentCheck{
			"http": {Status: "ok", Details: "profile read routes online"},
		}
		if strings.TrimSpace(cfg.Redis.URL) != "" {
			checks["redis"] = contracts.ComponentCheck{Status: "ok", Details: "profile cache configured"}
		}
		if strings.TrimSpace(cfg.Database.URL) != "" {
			checks["database"] = contracts.ComponentCheck{Status: "ok", Details: "profile database configured"}
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, checks))
	})))

	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := profileService.Ready(r.Context()); err != nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "profile_dependencies_unavailable", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"database": {Status: "ok", Details: "postgres reachable"},
		}))
	})))

	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))

	mux.Handle("/v1/profile/schema", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.ProfileSchemaResponse{
			Sections: []contracts.ProfileSection{
				{Key: "summary", Summary: "Overall rank, XP, strengths, and freshness", Status: "implemented"},
				{Key: "skills", Summary: "Top skill areas derived from scored public contribution evidence", Status: "implemented"},
				{Key: "badges", Summary: "Evidence-backed badge listing", Status: "implemented"},
				{Key: "timeline", Summary: "Time-windowed XP trend view", Status: "implemented"},
				{Key: "repositories", Summary: "Top repositories with visibility-aware projection", Status: "implemented"},
			},
		})
	})))

	mux.Handle("/v1/users/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			httpkit.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/v1/users/")
		if path == "" {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "profile not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		if strings.HasSuffix(path, "/card") {
			handle := strings.TrimSuffix(path, "/card")
			handle = strings.TrimSuffix(handle, "/")
			card, err := profileService.PublicProfileCard(r.Context(), handle, time.Now().UTC())
			if err != nil {
				writeProfileError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, card)
			return
		}

		handle := strings.TrimSuffix(path, "/")
		response, err := profileService.PublicProfile(r.Context(), handle, time.Now().UTC())
		if err != nil {
			writeProfileError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	}))

	mux.Handle("/v1/me/profile", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
			response, err := profileService.PrivateProfile(r.Context(), cookieValue(sessionCookie), time.Now().UTC())
			if err != nil {
				writeProfileError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, response)
		case http.MethodPatch:
			var req contracts.UpdateProfilePrivacyRequest
			if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
				httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
			sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
			response, err := profileService.UpdatePrivacy(r.Context(), cookieValue(sessionCookie), r.Header.Get("X-CSRF-Token"), req, time.Now().UTC())
			if err != nil {
				writeProfileError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, response)
		default:
			httpkit.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", httpkit.RequestIDFromContext(r.Context()))
		}
	}))

	mux.Handle("/v1/me/profile/repositories/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			httpkit.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/v1/me/profile/repositories/")
		path = strings.Trim(path, "/")
		parts := strings.Split(path, "/")
		if len(parts) != 2 {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_repository", "repository path must be owner/repo", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		var req contracts.UpdateRepositoryVisibilityRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		fullName := parts[0] + "/" + parts[1]
		sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
		response, err := profileService.UpdateRepositoryVisibility(r.Context(), cookieValue(sessionCookie), r.Header.Get("X-CSRF-Token"), fullName, req, time.Now().UTC())
		if err != nil {
			writeProfileError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	}))

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.AccessLog(log), httpkit.Recoverer(log))
}

func writeProfileError(w http.ResponseWriter, r *http.Request, err error) {
	requestID := httpkit.RequestIDFromContext(r.Context())
	switch {
	case errors.Is(err, service.ErrUnauthorized):
		httpkit.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required", requestID)
	case errors.Is(err, service.ErrInvalidCSRF):
		httpkit.WriteError(w, http.StatusForbidden, "invalid_csrf", err.Error(), requestID)
	case errors.Is(err, service.ErrProfileHidden), errors.Is(err, service.ErrNotFound):
		httpkit.WriteError(w, http.StatusNotFound, "profile_not_found", "profile not found", requestID)
	case errors.Is(err, service.ErrInvalidRequest):
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error(), requestID)
	default:
		httpkit.WriteError(w, http.StatusInternalServerError, "profile_error", err.Error(), requestID)
	}
}

func cookieValue(cookie *http.Cookie) string {
	if cookie == nil {
		return ""
	}
	return cookie.Value
}
