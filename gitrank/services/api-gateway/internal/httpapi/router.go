package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/services/api-gateway/internal/app"
)

func NewRouter(cfg config.App, log *slog.Logger, version string) http.Handler {
	manifest := app.Manifest(cfg, version)
	mux := http.NewServeMux()
	metrics := httpkit.NewMetrics(cfg.ServiceName)

	profileBaseURL := strings.TrimRight(cfg.Services.ProfileBaseURL, "/")
	authBaseURL := strings.TrimRight(cfg.Services.AuthBaseURL, "/")
	ingestorBaseURL := strings.TrimRight(cfg.Services.GitHubIngestorBaseURL, "/")
	client := &http.Client{Timeout: cfg.Services.RequestTimeout}

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

	mux.Handle("/metrics", httpkit.RequireMethod(http.MethodGet, metrics.Handler()))

	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))

	mux.Handle("/v1/meta/dependencies", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest.Dependencies)
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
		if strings.TrimSpace(suffix) == "" {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "resource not found", httpkit.RequestIDFromContext(r.Context()))
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
		if err := validateSessionCSRF(r, cfg.Auth.SessionCookieName, []byte(cfg.Auth.SessionSecret)); err != nil {
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
		if err := validateSessionCSRF(r, cfg.Auth.SessionCookieName, []byte(cfg.Auth.SessionSecret)); err != nil {
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
		if err := validateSessionCSRF(r, cfg.Auth.SessionCookieName, []byte(cfg.Auth.SessionSecret)); err != nil {
			httpkit.WriteError(w, http.StatusForbidden, "invalid_csrf", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if !allowRateLimit(w, r, writeLimiter, "sync_trigger") {
			return
		}
		handleSyncRequest(w, r, client, ingestorBaseURL)
	})))

	mux.Handle("/v1/sync/repository/execute", sessionAuth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeMethodNotAllowed(w, r)
			return
		}
		if err := validateSessionCSRF(r, cfg.Auth.SessionCookieName, []byte(cfg.Auth.SessionSecret)); err != nil {
			httpkit.WriteError(w, http.StatusForbidden, "invalid_csrf", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if !allowRateLimit(w, r, writeLimiter, "sync_execute_repository") {
			return
		}
		handleRepositorySyncExecution(w, r, client, ingestorBaseURL)
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

func checkDependency(ctx context.Context, client *http.Client, baseURL, name string, checks map[string]contracts.ComponentCheck) error {
	if err := dependencyReady(ctx, client, baseURL); err != nil {
		return err
	}
	checks[name] = contracts.ComponentCheck{Status: "ok", Details: baseURL}
	return nil
}
