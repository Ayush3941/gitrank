package httpkit

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRequestIDMiddlewareSetsHeader(t *testing.T) {
	handler := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if RequestIDFromContext(r.Context()) == "" {
			t.Fatal("request ID missing from context")
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Header().Get("X-Request-ID") == "" {
		t.Fatal("X-Request-ID header missing")
	}
}

func TestRecovererConvertsPanicsTo500(t *testing.T) {
	handler := Chain(
		http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
			panic("boom")
		}),
		RequestID,
		Recoverer(slog.Default()),
	)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(context.Background())
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestDecodeJSONRejectsUnknownFields(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"mode":"user","extra":true}`))

	var payload struct {
		Mode string `json:"mode"`
	}
	if err := DecodeJSON(req, &payload, 1<<20); err == nil {
		t.Fatal("DecodeJSON() error = nil, want unknown field rejection")
	}
}

func TestMetricsHandlerIncludesObservedRequests(t *testing.T) {
	metrics := NewMetrics("test-service")
	handler := Chain(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusCreated)
		}),
		Instrument(metrics),
	)

	req := httptest.NewRequest(http.MethodPost, "/v1/sync", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	metricsRec := httptest.NewRecorder()
	metrics.Handler().ServeHTTP(metricsRec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body, _ := io.ReadAll(metricsRec.Result().Body)
	text := string(body)
	if !strings.Contains(text, `gitrank_http_requests_total{service="test-service",method="POST",status_class="2xx"} 1`) {
		t.Fatalf("metrics output missing request count: %s", text)
	}
}

func TestMetricsHandlerIncludesObservedErrors(t *testing.T) {
	metrics := NewMetrics("test-service")
	handler := Chain(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusBadGateway)
		}),
		Instrument(metrics),
	)

	req := httptest.NewRequest(http.MethodGet, "/v1/fail", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	metricsRec := httptest.NewRecorder()
	metrics.Handler().ServeHTTP(metricsRec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body, _ := io.ReadAll(metricsRec.Result().Body)
	text := string(body)
	if !strings.Contains(text, `gitrank_http_errors_total{service="test-service",method="GET",status_class="5xx"} 1`) {
		t.Fatalf("metrics output missing error count: %s", text)
	}
}

func TestMetricsHandlerIncludesExtraCollectors(t *testing.T) {
	metrics := NewMetrics("test-service")
	metrics.Observe(http.MethodGet, http.StatusOK, 5)

	metricsRec := httptest.NewRecorder()
	MetricsHandler(metrics, PrometheusSourceFunc(func(w io.Writer) {
		_, _ = w.Write([]byte("gitrank_extra_metric 7\n"))
	})).ServeHTTP(metricsRec, httptest.NewRequest(http.MethodGet, "/metrics", nil))

	body, _ := io.ReadAll(metricsRec.Result().Body)
	text := string(body)
	if !strings.Contains(text, "gitrank_extra_metric 7") {
		t.Fatalf("metrics output missing extra collector: %s", text)
	}
}

func TestCORSMiddlewareHandlesPreflight(t *testing.T) {
	handler := Chain(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
		CORS(CORSConfig{
			AllowedOrigins:   []string{"http://localhost:3000"},
			AllowCredentials: true,
		}),
	)

	req := httptest.NewRequest(http.MethodOptions, "/v1/me/profile", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Fatalf("allow origin = %q", rec.Header().Get("Access-Control-Allow-Origin"))
	}
}

type PrometheusSourceFunc func(io.Writer)

func (f PrometheusSourceFunc) WritePrometheus(w io.Writer) {
	f(w)
}
