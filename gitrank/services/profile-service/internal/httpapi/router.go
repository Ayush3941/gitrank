package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/httpkit"
	"github.com/gitrank/gitrank/services/profile-service/internal/app"
	"github.com/gitrank/gitrank/services/profile-service/internal/service"
)

func NewRouter(cfg config.App, profileService *service.Service, log *slog.Logger, version string) http.Handler {
	manifest := app.Manifest(cfg, version)
	mux := http.NewServeMux()
	metrics := httpkit.NewMetrics(cfg.ServiceName)

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

	mux.Handle("/metrics", httpkit.RequireMethod(http.MethodGet, httpkit.MetricsHandler(metrics, profileService.MetricsSource())))

	mux.Handle("/v1/profile/schema", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.ProfileSchemaResponse{
			Sections: []contracts.ProfileSection{
				{Key: "summary", Summary: "Overall rank, XP, strengths, and freshness", Status: "implemented"},
				{Key: "skills", Summary: "Top skill areas derived from scored public contribution evidence", Status: "implemented"},
				{Key: "badges", Summary: "Evidence-backed badge listing", Status: "implemented"},
				{Key: "timeline", Summary: "Time-windowed XP trend view", Status: "implemented"},
				{Key: "repositories", Summary: "Top repositories with visibility-aware projection", Status: "implemented"},
				{Key: "quests", Summary: "Authenticated quest recommendations derived from profile score evidence", Status: "implemented"},
				{Key: "leaderboard", Summary: "Weekly season snapshots with persisted rank movement evidence", Status: "implemented"},
			},
		})
	})))

	mux.Handle("/v1/leaderboard/materialize", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response, err := profileService.MaterializeLeaderboard(r.Context(), 100, time.Now().UTC())
		if err != nil {
			writeProfileError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusAccepted, response)
	})))

	mux.Handle("/v1/leaderboard/materialize/history", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		weeks := 26
		if raw := strings.TrimSpace(r.URL.Query().Get("weeks")); raw != "" {
			value, err := strconv.Atoi(raw)
			if err != nil || value <= 0 {
				httpkit.WriteError(w, http.StatusBadRequest, "invalid_weeks", "weeks must be a positive integer", httpkit.RequestIDFromContext(r.Context()))
				return
			}
			weeks = value
		}
		response, err := profileService.BackfillLeaderboardHistory(r.Context(), weeks, 100, time.Now().UTC())
		if err != nil {
			writeProfileError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusAccepted, response)
	})))

	mux.Handle("/v1/leaderboard", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response, err := profileService.Leaderboard(r.Context(), 50, time.Now().UTC())
		if err != nil {
			writeProfileError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/profile/users/", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if userID, ok := parsePullRequestReportBackfillPath(r.URL.Path); ok {
			response, err := profileService.BackfillPullRequestReportsForUser(r.Context(), userID, 100, time.Now().UTC())
			if err != nil {
				writeProfileError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusAccepted, response)
			return
		}
		if userID, ok := parseQuestBackfillPath(r.URL.Path); ok {
			response, err := profileService.BackfillQuestsForUser(r.Context(), userID, time.Now().UTC())
			if err != nil {
				writeProfileError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusAccepted, response)
			return
		}

		userID, ok := parseProfileRefreshPath(r.URL.Path)
		if !ok {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "profile operation target not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}
		response, err := profileService.RefreshProfileByUserID(r.Context(), userID, time.Now().UTC())
		if err != nil {
			writeProfileError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusAccepted, response)
	})))

	mux.Handle("/v1/pr/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			owner, repo, number, ok := parsePullRequestReportPath(r.URL.Path)
			if !ok {
				httpkit.WriteError(w, http.StatusNotFound, "not_found", "pull request report not found", httpkit.RequestIDFromContext(r.Context()))
				return
			}
			response, err := profileService.PublicPullRequestReport(r.Context(), owner, repo, number, time.Now().UTC())
			if err != nil {
				writeProfileError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, response)
		case http.MethodPost:
			owner, repo, number, ok := parsePullRequestReportMaterializationPath(r.URL.Path)
			if !ok {
				httpkit.WriteError(w, http.StatusNotFound, "not_found", "pull request report materialization target not found", httpkit.RequestIDFromContext(r.Context()))
				return
			}
			response, err := profileService.MaterializePullRequestReport(r.Context(), owner, repo, number, time.Now().UTC())
			if err != nil {
				writeProfileError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusAccepted, response)
		default:
			httpkit.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", httpkit.RequestIDFromContext(r.Context()))
		}
	}))

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
			handle, err := contracts.NormalizeGitHubLogin(handle)
			if err != nil {
				httpkit.WriteError(w, http.StatusBadRequest, "invalid_profile_target", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
			card, err := profileService.PublicProfileCard(r.Context(), handle, time.Now().UTC())
			if err != nil {
				writeProfileError(w, r, err)
				return
			}
			httpkit.WriteJSON(w, http.StatusOK, card)
			return
		}

		handle := strings.TrimSuffix(path, "/")
		handle, err := contracts.NormalizeGitHubLogin(handle)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_profile_target", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
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

	mux.Handle("/v1/me/quests", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
		response, err := profileService.PrivateQuests(r.Context(), cookieValue(sessionCookie), time.Now().UTC())
		if err != nil {
			writeProfileError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

	mux.Handle("/v1/me/account/export", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
		response, err := profileService.AccountDataExport(r.Context(), cookieValue(sessionCookie), time.Now().UTC())
		if err != nil {
			writeProfileError(w, r, err)
			return
		}
		w.Header().Set("Cache-Control", "private, no-store")
		httpkit.WriteJSON(w, http.StatusOK, response)
	})))

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
		fullName, err := contracts.NormalizeGitHubRepository(parts[0] + "/" + parts[1])
		if err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_repository", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		var req contracts.UpdateRepositoryVisibilityRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
		response, err := profileService.UpdateRepositoryVisibility(r.Context(), cookieValue(sessionCookie), r.Header.Get("X-CSRF-Token"), fullName, req, time.Now().UTC())
		if err != nil {
			writeProfileError(w, r, err)
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, response)
	}))

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.Instrument(metrics), httpkit.AccessLog(log), httpkit.Recoverer(log))
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

func parsePullRequestReportPath(path string) (string, string, int, bool) {
	return parsePullRequestReportPathWithSuffix(path, false)
}

func parsePullRequestReportMaterializationPath(path string) (string, string, int, bool) {
	return parsePullRequestReportPathWithSuffix(path, true)
}

func parsePullRequestReportPathWithSuffix(path string, materialize bool) (string, string, int, bool) {
	trimmed := strings.Trim(strings.TrimPrefix(path, "/v1/pr/"), "/")
	parts := strings.Split(trimmed, "/")
	expectedParts := 4
	if materialize {
		expectedParts = 5
	}
	if len(parts) != expectedParts || parts[3] != "report" {
		return "", "", 0, false
	}
	if materialize && parts[4] != "materialize" {
		return "", "", 0, false
	}
	fullName, err := contracts.NormalizeGitHubRepository(parts[0] + "/" + parts[1])
	if err != nil {
		return "", "", 0, false
	}
	number, err := strconv.Atoi(parts[2])
	if err != nil || number <= 0 {
		return "", "", 0, false
	}
	repoParts := strings.SplitN(fullName, "/", 2)
	return repoParts[0], repoParts[1], number, true
}

func parseProfileRefreshPath(path string) (string, bool) {
	trimmed := strings.Trim(strings.TrimPrefix(path, "/v1/profile/users/"), "/")
	parts := strings.Split(trimmed, "/")
	if len(parts) != 2 || parts[1] != "refresh" {
		return "", false
	}
	userID, err := contracts.NormalizeUUID(parts[0], "user_id")
	if err != nil {
		return "", false
	}
	return userID, true
}

func parsePullRequestReportBackfillPath(path string) (string, bool) {
	trimmed := strings.Trim(strings.TrimPrefix(path, "/v1/profile/users/"), "/")
	parts := strings.Split(trimmed, "/")
	if len(parts) != 3 || parts[1] != "pr-reports" || parts[2] != "backfill" {
		return "", false
	}
	userID, err := contracts.NormalizeUUID(parts[0], "user_id")
	if err != nil {
		return "", false
	}
	return userID, true
}

func parseQuestBackfillPath(path string) (string, bool) {
	trimmed := strings.Trim(strings.TrimPrefix(path, "/v1/profile/users/"), "/")
	parts := strings.Split(trimmed, "/")
	if len(parts) != 3 || parts[1] != "quests" || parts[2] != "backfill" {
		return "", false
	}
	userID, err := contracts.NormalizeUUID(parts[0], "user_id")
	if err != nil {
		return "", false
	}
	return userID, true
}
