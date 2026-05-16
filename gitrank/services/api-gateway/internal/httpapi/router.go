package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/httpkit"
	"github.com/gitrank/gitrank/services/api-gateway/internal/app"
)

func NewRouter(cfg config.App, log *slog.Logger, version string) http.Handler {
	manifest := app.Manifest(cfg, version)
	mux := http.NewServeMux()
	metrics := httpkit.NewMetrics(cfg.ServiceName)
	analytics := newAnalyticsMetricsSource(cfg.ServiceName, log)

	profileBaseURL := strings.TrimRight(cfg.Services.ProfileBaseURL, "/")
	authBaseURL := strings.TrimRight(cfg.Services.AuthBaseURL, "/")
	ingestorBaseURL := strings.TrimRight(cfg.Services.GitHubIngestorBaseURL, "/")
	client := &http.Client{Timeout: cfg.Services.RequestTimeout}
	sessionSecrets := cfg.SessionSecretRing()

	sessionAuth := newSessionAuthenticator(client, authBaseURL, cfg.Auth.SessionCookieName, cfg.Auth.CSRFCookieName)
	publicReadLimiter := newRateLimiter(time.Minute, 180)
	privateReadLimiter := newRateLimiter(time.Minute, 90)
	writeLimiter := newRateLimiter(time.Minute, 45)

	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"http":            {Status: "ok", Details: "api gateway route layer online"},
			"auth-service":    {Status: "ok", Details: authBaseURL},
			"github-ingestor": {Status: "ok", Details: ingestorBaseURL},
			"profile-service": {Status: "ok", Details: profileBaseURL},
		}))
	})))

	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		checks := map[string]contracts.ComponentCheck{}
		if err := checkDependency(r.Context(), client, authBaseURL, "auth-service", checks); err != nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "dependency_unavailable", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if err := checkDependency(r.Context(), client, ingestorBaseURL, "github-ingestor", checks); err != nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "dependency_unavailable", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if err := checkDependency(r.Context(), client, profileBaseURL, "profile-service", checks); err != nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "dependency_unavailable", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, checks))
	})))

	mux.Handle("/metrics", httpkit.RequireMethod(http.MethodGet, httpkit.MetricsHandler(metrics, analytics)))

	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))

	mux.Handle("/v1/meta/dependencies", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest.Dependencies)
	})))

	mux.Handle("/v1/leaderboard", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowRateLimit(w, r, publicReadLimiter, "leaderboard") {
			return
		}
		proxyRequest(w, r, client, profileBaseURL, r.URL.Path, proxyOptions{
			ForwardHeaders: defaultForwardHeaders(r),
			ResponseHeaders: map[string]string{
				"Cache-Control": "public, max-age=60, stale-while-revalidate=300",
			},
		})
	})))

	mux.Handle("/v1/users/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w, r)
			return
		}
		if !allowRateLimit(w, r, publicReadLimiter, "public_profile") {
			return
		}
		suffix := strings.TrimPrefix(r.URL.Path, "/v1/users/")
		handle, matched, err := publicProfileHandleFromSuffix(suffix)
		if strings.TrimSpace(suffix) == "" || !matched {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "resource not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_profile_target", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		proxyRequest(w, r, client, profileBaseURL, r.URL.Path, proxyOptions{
			ForwardHeaders: defaultForwardHeaders(r),
			ResponseHeaders: map[string]string{
				"Cache-Control": "public, max-age=60, stale-while-revalidate=300",
			},
			Transform: analyticsProfileTransform(analytics, handle),
		})
	}))

	mux.Handle("/v1/pr/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w, r)
			return
		}
		if !allowRateLimit(w, r, publicReadLimiter, "pr_report") {
			return
		}
		if !validPullRequestReportPath(r.URL.Path) {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "pull request report not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		proxyRequest(w, r, client, profileBaseURL, r.URL.Path, proxyOptions{
			ForwardHeaders: defaultForwardHeaders(r),
			ResponseHeaders: map[string]string{
				"Cache-Control": "public, max-age=60, stale-while-revalidate=300",
			},
		})
	}))

	mux.Handle("/v1/me/profile", sessionAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			if !allowRateLimit(w, r, privateReadLimiter, "private_profile") {
				return
			}
		case http.MethodPatch:
			if !allowRateLimit(w, r, writeLimiter, "private_profile_write") {
				return
			}
		default:
			writeMethodNotAllowed(w, r)
			return
		}

		var transform func(*http.Response, []byte) (int, []byte, map[string]string, error)
		if r.Method == http.MethodGet {
			transform = analyticsProfileTransform(analytics, "self")
		}
		proxyRequest(w, r, client, profileBaseURL, r.URL.Path, proxyOptions{
			ForwardHeaders: defaultForwardHeaders(r),
			ResponseHeaders: map[string]string{
				"Cache-Control": "private, no-store",
			},
			Transform: transform,
		})
	})))

	mux.Handle("/v1/me/quests", sessionAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w, r)
			return
		}
		if !allowRateLimit(w, r, privateReadLimiter, "private_quests") {
			return
		}

		proxyRequest(w, r, client, profileBaseURL, r.URL.Path, proxyOptions{
			ForwardHeaders: defaultForwardHeaders(r),
			ResponseHeaders: map[string]string{
				"Cache-Control": "private, no-store",
			},
		})
	})))

	mux.Handle("/v1/me/account/export", sessionAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w, r)
			return
		}
		if !allowRateLimit(w, r, privateReadLimiter, "account_export") {
			return
		}

		proxyRequest(w, r, client, profileBaseURL, r.URL.Path, proxyOptions{
			ForwardHeaders: defaultForwardHeaders(r),
			ResponseHeaders: map[string]string{
				"Cache-Control": "private, no-store",
			},
		})
	})))

	mux.Handle("/v1/me/profile/repositories/", sessionAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			writeMethodNotAllowed(w, r)
			return
		}
		if !allowRateLimit(w, r, writeLimiter, "repository_visibility_write") {
			return
		}

		suffix := strings.TrimPrefix(r.URL.Path, "/v1/me/profile/repositories/")
		if countPathSegments(suffix) != 2 {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "repository target not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if _, err := contracts.NormalizeGitHubRepository(suffix); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_repository_target", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		proxyRequest(w, r, client, profileBaseURL, r.URL.Path, proxyOptions{
			ForwardHeaders: defaultForwardHeaders(r),
			ResponseHeaders: map[string]string{
				"Cache-Control": "private, no-store",
			},
		})
	})))

	mux.Handle("/v1/me/account/unlink", sessionAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeMethodNotAllowed(w, r)
			return
		}
		if err := validateSessionCSRF(r, cfg.Auth.SessionCookieName, sessionSecrets); err != nil {
			httpkit.WriteError(w, http.StatusForbidden, "invalid_csrf", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if !allowRateLimit(w, r, writeLimiter, "account_unlink") {
			return
		}

		proxyRequest(w, r, client, authBaseURL, "/v1/account/unlink", proxyOptions{
			ForwardHeaders: defaultForwardHeaders(r),
			ResponseHeaders: map[string]string{
				"Cache-Control": "private, no-store",
			},
		})
	})))

	mux.Handle("/v1/me/account/delete", sessionAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeMethodNotAllowed(w, r)
			return
		}
		if err := validateSessionCSRF(r, cfg.Auth.SessionCookieName, sessionSecrets); err != nil {
			httpkit.WriteError(w, http.StatusForbidden, "invalid_csrf", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if !allowRateLimit(w, r, writeLimiter, "account_delete") {
			return
		}

		proxyRequest(w, r, client, authBaseURL, "/v1/account/delete", proxyOptions{
			ForwardHeaders: defaultForwardHeaders(r),
			ResponseHeaders: map[string]string{
				"Cache-Control": "private, no-store",
			},
		})
	})))

	mux.Handle("/v1/sync", sessionAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeMethodNotAllowed(w, r)
			return
		}
		if err := validateSessionCSRF(r, cfg.Auth.SessionCookieName, sessionSecrets); err != nil {
			httpkit.WriteError(w, http.StatusForbidden, "invalid_csrf", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if !allowRateLimit(w, r, writeLimiter, "sync_trigger") {
			return
		}
		handleSyncRequest(w, r, client, ingestorBaseURL, analytics)
	})))

	mux.Handle("/v1/analytics/events", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowRateLimit(w, r, writeLimiter, "analytics_event") {
			return
		}
		handleAnalyticsEvent(w, r, analytics)
	})))

	mux.Handle("/v1/sync/repository/execute", sessionAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeMethodNotAllowed(w, r)
			return
		}
		if err := validateSessionCSRF(r, cfg.Auth.SessionCookieName, sessionSecrets); err != nil {
			httpkit.WriteError(w, http.StatusForbidden, "invalid_csrf", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if !allowRateLimit(w, r, writeLimiter, "sync_execute_repository") {
			return
		}
		handleRepositorySyncExecution(w, r, client, ingestorBaseURL)
	})))

	mux.Handle("/v1/sync/user/execute", sessionAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeMethodNotAllowed(w, r)
			return
		}
		if err := validateSessionCSRF(r, cfg.Auth.SessionCookieName, sessionSecrets); err != nil {
			httpkit.WriteError(w, http.StatusForbidden, "invalid_csrf", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if !allowRateLimit(w, r, writeLimiter, "sync_execute_user") {
			return
		}
		handleUserSyncExecution(w, r, client, ingestorBaseURL)
	})))

	mux.Handle("/v1/sync/installation/execute", sessionAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeMethodNotAllowed(w, r)
			return
		}
		if err := validateSessionCSRF(r, cfg.Auth.SessionCookieName, sessionSecrets); err != nil {
			httpkit.WriteError(w, http.StatusForbidden, "invalid_csrf", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if !allowRateLimit(w, r, writeLimiter, "sync_execute_installation") {
			return
		}
		handleInstallationSyncExecution(w, r, client, ingestorBaseURL)
	})))

	return httpkit.Chain(
		mux,
		httpkit.RequestID,
		httpkit.CORS(httpkit.CORSConfig{
			AllowedOrigins:   []string{cfg.PublicBaseURL},
			AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodOptions},
			AllowedHeaders:   []string{"Content-Type", "X-CSRF-Token", "X-Request-ID"},
			AllowCredentials: true,
			MaxAge:           10 * time.Minute,
		}),
		httpkit.Instrument(metrics),
		httpkit.AccessLog(log),
		httpkit.Recoverer(log),
	)
}

func publicProfileHandleFromSuffix(suffix string) (string, bool, error) {
	parts := strings.Split(strings.Trim(suffix, "/"), "/")
	switch {
	case len(parts) == 1:
		handle, err := contracts.NormalizeGitHubLogin(parts[0])
		return handle, true, err
	case len(parts) == 2 && parts[1] == "card":
		handle, err := contracts.NormalizeGitHubLogin(parts[0])
		return handle, true, err
	default:
		return "", false, nil
	}
}

func checkDependency(ctx context.Context, client *http.Client, baseURL, name string, checks map[string]contracts.ComponentCheck) error {
	if err := dependencyReady(ctx, client, baseURL); err != nil {
		return err
	}
	checks[name] = contracts.ComponentCheck{Status: "ok", Details: baseURL}
	return nil
}

func validPullRequestReportPath(path string) bool {
	trimmed := strings.Trim(strings.TrimPrefix(path, "/v1/pr/"), "/")
	parts := strings.Split(trimmed, "/")
	if len(parts) != 4 || parts[3] != "report" {
		return false
	}
	if _, err := contracts.NormalizeGitHubRepository(parts[0] + "/" + parts[1]); err != nil {
		return false
	}
	number, err := strconv.Atoi(parts[2])
	return err == nil && number > 0
}
