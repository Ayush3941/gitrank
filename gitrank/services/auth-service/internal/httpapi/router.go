package httpapi

import (
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/authkit"
	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/githubapi"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/services/auth-service/internal/app"
	"github.com/Ayush3941/gitrank/services/auth-service/internal/service"
)

const oauthBrowserCookieName = "gitrank_oauth"

type linkStartRequest struct {
	ReturnTo string `json:"return_to,omitempty"`
}

type accountDeleteRequest struct {
	Confirmation string `json:"confirmation"`
}

func NewRouter(cfg config.App, authService *service.Service, log *slog.Logger, version string) http.Handler {
	manifest := app.Manifest(cfg, version)
	mux := http.NewServeMux()
	metrics := httpkit.NewMetrics(cfg.ServiceName)

	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		checks := map[string]contracts.ComponentCheck{
			"http": {Status: "ok", Details: "auth route layer online"},
		}
		if cfg.ValidateOAuth() == nil {
			checks["github_user_tokens"] = contracts.ComponentCheck{Status: "ok", Details: cfg.GitHubUserClientMode() + " client configured"}
		}
		if cfg.ValidateGitHubApp() == nil {
			checks["github_app"] = contracts.ComponentCheck{Status: "ok", Details: "app installation credentials configured"}
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, checks))
	})))

	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := authService.Ready(r.Context()); err != nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "database_unavailable", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"database": {Status: "ok", Details: "postgres reachable"},
		}))
	})))

	mux.Handle("/v1/meta/manifest", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, manifest)
	})))

	mux.Handle("/metrics", httpkit.RequireMethod(http.MethodGet, httpkit.MetricsHandler(metrics, authService.MetricsSource())))

	mux.Handle("/oauth/github/install", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		installURL, err := githubapi.BuildAppInstallURL(cfg.GitHub.AppInstallURL, cfg.GitHub.AppSlug)
		if err != nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "app_install_unavailable", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}

		if r.URL.Query().Get("preview") == "1" {
			httpkit.WriteJSON(w, http.StatusOK, contracts.GitHubAppInstallPreview{
				InstallURL:            installURL,
				AppConfigured:         cfg.ValidateGitHubApp() == nil,
				UserTokenClientIDMode: cfg.GitHubUserClientMode(),
			})
			return
		}

		http.Redirect(w, r, installURL, http.StatusFound)
	})))

	mux.Handle("/oauth/github/start", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now().UTC()
		if !checkRateLimit(w, r, authService, "oauth_start", now) {
			return
		}

		result, err := authService.StartLogin(r.Context(), r.URL.Query().Get("return_to"), clientIP(r), r.UserAgent(), now)
		if err != nil {
			writeAuthError(w, r, err)
			return
		}
		setOAuthBrowserCookie(w, cfg, result.BrowserToken, result.Response.ExpiresAt)

		if strings.EqualFold(r.URL.Query().Get("response_mode"), "json") {
			httpkit.WriteJSON(w, http.StatusOK, result.Response)
			return
		}
		http.Redirect(w, r, result.Response.AuthorizeURL, http.StatusFound)
	})))

	mux.Handle("/oauth/github/callback", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now().UTC()
		if !checkRateLimit(w, r, authService, "oauth_callback", now) {
			return
		}

		browserCookie, _ := r.Cookie(oauthBrowserCookieName)
		sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
		result, err := authService.HandleCallback(
			r.Context(),
			r.URL.Query().Get("state"),
			r.URL.Query().Get("code"),
			cookieValue(browserCookie),
			cookieValue(sessionCookie),
			clientIP(r),
			r.UserAgent(),
			now,
		)
		if err != nil {
			writeAuthError(w, r, err)
			return
		}

		clearOAuthBrowserCookie(w, cfg)
		setSessionCookies(w, cfg, result.Session, result.Response.Session.SessionExpiresAt)

		if strings.EqualFold(r.URL.Query().Get("response_mode"), "json") || strings.TrimSpace(result.Response.RedirectURL) == "" {
			httpkit.WriteJSON(w, http.StatusOK, result.Response)
			return
		}
		http.Redirect(w, r, result.Response.RedirectURL, http.StatusFound)
	})))

	mux.Handle("/v1/account/link/start", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now().UTC()
		if !checkRateLimit(w, r, authService, "account_link_start", now) {
			return
		}

		var req linkStartRequest
		if r.ContentLength > 0 {
			if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
				httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
				return
			}
		}

		sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
		result, err := authService.StartLink(r.Context(), cookieValue(sessionCookie), r.Header.Get("X-CSRF-Token"), req.ReturnTo, clientIP(r), r.UserAgent(), now)
		if err != nil {
			writeAuthError(w, r, err)
			return
		}

		setOAuthBrowserCookie(w, cfg, result.BrowserToken, result.Response.ExpiresAt)
		httpkit.WriteJSON(w, http.StatusOK, result.Response)
	})))

	mux.Handle("/v1/account/unlink", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now().UTC()
		if !checkRateLimit(w, r, authService, "account_unlink", now) {
			return
		}

		sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
		if err := authService.UnlinkAccount(r.Context(), cookieValue(sessionCookie), r.Header.Get("X-CSRF-Token"), now); err != nil {
			writeAuthError(w, r, err)
			return
		}
		clearSessionCookies(w, cfg)
		httpkit.WriteJSON(w, http.StatusOK, contracts.AccountUnlinkResponse{
			Status:        "unlinked",
			LoggedOut:     true,
			ReauthorizeAt: cfg.PublicBaseURL + "/login",
		})
	})))

	mux.Handle("/v1/account/delete", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now().UTC()
		if !checkRateLimit(w, r, authService, "account_delete", now) {
			return
		}

		var req accountDeleteRequest
		if err := httpkit.DecodeJSON(r, &req, 1<<20); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if strings.TrimSpace(req.Confirmation) != "DELETE" {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_confirmation", "confirmation must equal DELETE", httpkit.RequestIDFromContext(r.Context()))
			return
		}

		sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
		if err := authService.DeleteAccount(r.Context(), cookieValue(sessionCookie), r.Header.Get("X-CSRF-Token"), now); err != nil {
			writeAuthError(w, r, err)
			return
		}
		clearSessionCookies(w, cfg)
		httpkit.WriteJSON(w, http.StatusOK, contracts.AccountDeletionResponse{
			Status:    "deleted",
			LoggedOut: true,
			DeletedAt: now,
		})
	})))

	mux.Handle("/v1/session/me", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
		result, err := authService.GetSession(r.Context(), cookieValue(sessionCookie), time.Now().UTC())
		if err != nil {
			writeAuthError(w, r, err)
			return
		}
		if result.Session != nil {
			setSessionCookies(w, cfg, *result.Session, result.Response.Session.SessionExpiresAt)
		}
		httpkit.WriteJSON(w, http.StatusOK, result.Response)
	})))

	mux.Handle("/v1/session/refresh", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now().UTC()
		if !checkRateLimit(w, r, authService, "session_refresh", now) {
			return
		}

		sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
		result, err := authService.RefreshSession(r.Context(), cookieValue(sessionCookie), r.Header.Get("X-CSRF-Token"), now)
		if err != nil {
			writeAuthError(w, r, err)
			return
		}
		if result.Session != nil {
			setSessionCookies(w, cfg, *result.Session, result.Response.Session.SessionExpiresAt)
		}
		httpkit.WriteJSON(w, http.StatusOK, result.Response)
	})))

	mux.Handle("/v1/session/logout", httpkit.RequireMethod(http.MethodPost, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now().UTC()
		if !checkRateLimit(w, r, authService, "session_logout", now) {
			return
		}

		sessionCookie, _ := r.Cookie(cfg.Auth.SessionCookieName)
		if err := authService.Logout(r.Context(), cookieValue(sessionCookie), r.Header.Get("X-CSRF-Token"), now); err != nil {
			writeAuthError(w, r, err)
			return
		}
		clearSessionCookies(w, cfg)
		httpkit.WriteJSON(w, http.StatusOK, contracts.LogoutResponse{Status: "logged_out"})
	})))

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.Instrument(metrics), httpkit.AccessLog(log), httpkit.Recoverer(log))
}

func writeAuthError(w http.ResponseWriter, r *http.Request, err error) {
	requestID := httpkit.RequestIDFromContext(r.Context())
	switch {
	case errors.Is(err, service.ErrSessionNotFound):
		httpkit.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required", requestID)
	case errors.Is(err, service.ErrNotFound):
		httpkit.WriteError(w, http.StatusNotFound, "not_found", "requested auth resource was not found", requestID)
	case errors.Is(err, service.ErrInvalidCSRF):
		httpkit.WriteError(w, http.StatusForbidden, "invalid_csrf", err.Error(), requestID)
	case errors.Is(err, service.ErrStateNotUsable):
		httpkit.WriteError(w, http.StatusUnauthorized, "invalid_state", err.Error(), requestID)
	case errors.Is(err, service.ErrConflict):
		httpkit.WriteError(w, http.StatusConflict, "auth_conflict", "account linking conflict", requestID)
	default:
		status := http.StatusBadRequest
		code := "auth_error"
		if strings.Contains(strings.ToLower(err.Error()), "github") || strings.Contains(strings.ToLower(err.Error()), "token") {
			status = http.StatusBadGateway
			code = "github_auth_failed"
		}
		httpkit.WriteError(w, status, code, err.Error(), requestID)
	}
}

func checkRateLimit(w http.ResponseWriter, r *http.Request, authService *service.Service, scope string, now time.Time) bool {
	retryAfter, allowed := authService.AllowRateLimit(scope, clientIP(r), now)
	if allowed {
		return true
	}
	w.Header().Set("Retry-After", strconv.Itoa(int(retryAfter.Seconds())+1))
	httpkit.WriteError(w, http.StatusTooManyRequests, "rate_limited", "too many requests", httpkit.RequestIDFromContext(r.Context()))
	return false
}

func setOAuthBrowserCookie(w http.ResponseWriter, cfg config.App, browserToken string, expiresAt time.Time) {
	authkit.SetCookie(w, authkit.CookieConfig{
		Name:     oauthBrowserCookieName,
		Value:    browserToken,
		Path:     "/oauth/github",
		HTTPOnly: true,
		Secure:   cfg.Auth.SessionCookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		Expires:  expiresAt.UTC(),
	})
}

func clearOAuthBrowserCookie(w http.ResponseWriter, cfg config.App) {
	authkit.ClearCookie(w, oauthBrowserCookieName, "", cfg.Auth.SessionCookieSecure, http.SameSiteLaxMode, true)
}

func setSessionCookies(w http.ResponseWriter, cfg config.App, tokens service.SessionTokens, expiresAt time.Time) {
	sameSite := authkit.SameSiteFromString(cfg.Auth.SessionCookieSameSite)
	maxAge := int(time.Until(expiresAt).Seconds())
	authkit.SetCookie(w, authkit.CookieConfig{
		Name:     cfg.Auth.SessionCookieName,
		Value:    tokens.SessionToken,
		Domain:   cfg.Auth.SessionCookieDomain,
		Path:     "/",
		MaxAge:   maxAge,
		HTTPOnly: true,
		Secure:   cfg.Auth.SessionCookieSecure,
		SameSite: sameSite,
		Expires:  expiresAt.UTC(),
	})
	authkit.SetCookie(w, authkit.CookieConfig{
		Name:     cfg.Auth.CSRFCookieName,
		Value:    tokens.CSRFToken,
		Domain:   cfg.Auth.SessionCookieDomain,
		Path:     "/",
		MaxAge:   maxAge,
		HTTPOnly: false,
		Secure:   cfg.Auth.SessionCookieSecure,
		SameSite: sameSite,
		Expires:  expiresAt.UTC(),
	})
}

func clearSessionCookies(w http.ResponseWriter, cfg config.App) {
	sameSite := authkit.SameSiteFromString(cfg.Auth.SessionCookieSameSite)
	authkit.ClearCookie(w, cfg.Auth.SessionCookieName, cfg.Auth.SessionCookieDomain, cfg.Auth.SessionCookieSecure, sameSite, true)
	authkit.ClearCookie(w, cfg.Auth.CSRFCookieName, cfg.Auth.SessionCookieDomain, cfg.Auth.SessionCookieSecure, sameSite, false)
}

func clientIP(r *http.Request) string {
	if forwarded := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); forwarded != "" {
		return forwarded
	}
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func cookieValue(cookie *http.Cookie) string {
	if cookie == nil {
		return ""
	}
	return cookie.Value
}
