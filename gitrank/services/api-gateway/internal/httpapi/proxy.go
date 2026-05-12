package httpapi

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gitrank/gitrank/packages/httpkit"
)

type proxyOptions struct {
	ForwardHeaders  map[string]string
	ResponseHeaders map[string]string
	Transform       func(*http.Response, []byte) (int, []byte, map[string]string, error)
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
	httpkit.InjectTraceContext(ctx, request.Header)
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("upstream readiness failed with status %d", response.StatusCode)
	}
	return nil
}

func proxyRequest(w http.ResponseWriter, r *http.Request, client *http.Client, baseURL, targetPath string, opts proxyOptions) {
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
	for name, value := range opts.ForwardHeaders {
		copyHeaderIfPresent(request.Header, name, value)
	}
	copyHeaderIfPresent(request.Header, "X-Request-ID", requestID)
	httpkit.InjectTraceContext(r.Context(), request.Header)

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

	statusCode := response.StatusCode
	headers := map[string]string{}
	if opts.Transform != nil {
		statusCode, payload, headers, err = opts.Transform(response, payload)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadGateway, "upstream_transform_failed", err.Error(), requestID)
			return
		}
	}

	copyResponseHeaders(w.Header(), response.Header)
	for name, value := range opts.ResponseHeaders {
		copyHeaderIfPresent(w.Header(), name, value)
	}
	for name, value := range headers {
		copyHeaderIfPresent(w.Header(), name, value)
	}
	w.WriteHeader(statusCode)
	if len(payload) > 0 {
		_, _ = w.Write(payload)
	}
}

func defaultForwardHeaders(r *http.Request) map[string]string {
	return map[string]string{
		"Accept":       r.Header.Get("Accept"),
		"Content-Type": r.Header.Get("Content-Type"),
		"Cookie":       r.Header.Get("Cookie"),
		"X-CSRF-Token": r.Header.Get("X-CSRF-Token"),
		"User-Agent":   r.UserAgent(),
	}
}

func copyResponseHeaders(dst, src http.Header) {
	for _, name := range []string{"Content-Type", "Cache-Control", "ETag", "Retry-After", "X-Request-ID"} {
		copyHeaderIfPresent(dst, name, src.Get(name))
	}
	for _, value := range src.Values("Set-Cookie") {
		if strings.TrimSpace(value) != "" {
			dst.Add("Set-Cookie", value)
		}
	}
}

func copyHeaderIfPresent(dst http.Header, key, value string) {
	if strings.TrimSpace(value) == "" {
		return
	}
	dst.Set(key, value)
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

func countPathSegments(path string) int {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return 0
	}
	return len(strings.Split(trimmed, "/"))
}
