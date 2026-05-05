package httpapi

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/services/api-gateway/internal/app"
)

func NewRouter(cfg config.App, log *slog.Logger, version string) http.Handler {
	manifest := app.Manifest(cfg, version)
	mux := http.NewServeMux()
	profileBaseURL := strings.TrimRight(cfg.Services.ProfileBaseURL, "/")
	client := &http.Client{Timeout: cfg.Services.RequestTimeout}

	mux.Handle("/healthz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"http":            {Status: "ok", Details: "api gateway route layer online"},
			"profile-service": {Status: "ok", Details: profileBaseURL},
		}))
	})))

	mux.Handle("/readyz", httpkit.RequireMethod(http.MethodGet, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := dependencyReady(r.Context(), client, profileBaseURL); err != nil {
			httpkit.WriteError(w, http.StatusServiceUnavailable, "dependency_unavailable", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, contracts.NewHealthResponse(cfg.ServiceName, string(cfg.Env), version, map[string]contracts.ComponentCheck{
			"profile-service": {Status: "ok", Details: profileBaseURL},
		}))
	})))

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
		suffix := strings.TrimPrefix(r.URL.Path, "/v1/users/")
		if strings.TrimSpace(suffix) == "" {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "resource not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}
		proxyProfileRequest(w, r, client, profileBaseURL, r.URL.Path)
	}))

	mux.Handle("/v1/me/profile", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodPatch:
			proxyProfileRequest(w, r, client, profileBaseURL, r.URL.Path)
		default:
			writeMethodNotAllowed(w, r)
		}
	}))

	mux.Handle("/v1/me/profile/repositories/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			writeMethodNotAllowed(w, r)
			return
		}
		suffix := strings.TrimPrefix(r.URL.Path, "/v1/me/profile/repositories/")
		if countPathSegments(suffix) != 2 {
			httpkit.WriteError(w, http.StatusNotFound, "not_found", "repository target not found", httpkit.RequestIDFromContext(r.Context()))
			return
		}
		proxyProfileRequest(w, r, client, profileBaseURL, r.URL.Path)
	}))

	return httpkit.Chain(mux, httpkit.RequestID, httpkit.AccessLog(log), httpkit.Recoverer(log))
}

func dependencyReady(ctx context.Context, client *http.Client, baseURL string) error {
	target, err := buildProxyURL(baseURL, "/readyz", "")
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return err
	}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("profile-service readiness returned %d", response.StatusCode)
	}
	return nil
}

func proxyProfileRequest(w http.ResponseWriter, r *http.Request, client *http.Client, baseURL, targetPath string) {
	requestID := httpkit.RequestIDFromContext(r.Context())

	body, err := readBody(r)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_body", err.Error(), requestID)
		return
	}

	target, err := buildProxyURL(baseURL, targetPath, r.URL.RawQuery)
	if err != nil {
		httpkit.WriteError(w, http.StatusInternalServerError, "invalid_upstream_url", err.Error(), requestID)
		return
	}

	request, err := http.NewRequestWithContext(r.Context(), r.Method, target, bytes.NewReader(body))
	if err != nil {
		httpkit.WriteError(w, http.StatusInternalServerError, "upstream_request_error", err.Error(), requestID)
		return
	}

	copyForwardHeaders(request.Header, r)
	request.Header.Set("X-Request-ID", requestID)

	response, err := client.Do(request)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadGateway, "dependency_unavailable", err.Error(), requestID)
		return
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(response.Body)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadGateway, "upstream_read_error", err.Error(), requestID)
		return
	}

	copyResponseHeaders(w.Header(), response.Header)
	w.WriteHeader(response.StatusCode)
	if len(payload) > 0 {
		_, _ = w.Write(payload)
	}
}

func buildProxyURL(baseURL, path, rawQuery string) (string, error) {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return "", err
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + path
	parsed.RawQuery = rawQuery
	return parsed.String(), nil
}

func copyForwardHeaders(dst http.Header, src *http.Request) {
	copyHeaderIfPresent(dst, "Accept", src.Header.Get("Accept"))
	copyHeaderIfPresent(dst, "Content-Type", src.Header.Get("Content-Type"))
	copyHeaderIfPresent(dst, "Cookie", src.Header.Get("Cookie"))
	copyHeaderIfPresent(dst, "X-CSRF-Token", src.Header.Get("X-CSRF-Token"))
	copyHeaderIfPresent(dst, "User-Agent", src.UserAgent())
}

func copyResponseHeaders(dst, src http.Header) {
	for _, name := range []string{"Content-Type", "Cache-Control", "ETag", "X-Request-ID"} {
		copyHeaderIfPresent(dst, name, src.Get(name))
	}
}

func copyHeaderIfPresent(dst http.Header, key, value string) {
	if strings.TrimSpace(value) == "" {
		return
	}
	dst.Set(key, value)
}

func countPathSegments(path string) int {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return 0
	}
	return len(strings.Split(trimmed, "/"))
}

func readBody(r *http.Request) ([]byte, error) {
	if r.Body == nil {
		return nil, nil
	}
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	return body, nil
}

func writeMethodNotAllowed(w http.ResponseWriter, r *http.Request) {
	httpkit.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", httpkit.RequestIDFromContext(r.Context()))
}
