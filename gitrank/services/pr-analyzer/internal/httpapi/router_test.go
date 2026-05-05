package httpapi

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
)

func TestMetricsIncludeAnalysisDuration(t *testing.T) {
	router := NewRouter(testConfig(), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/analyze/pull-request", strings.NewReader(`{
		"repository":{"full_name":"octo/repo"},
		"pull_request":{"title":"security: rotate token logic","changed_files":2,"files":[{"path":"internal/auth/validator.go"},{"path":"internal/auth/validator_test.go"}]}
	}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("analyze status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}

	metricsResponse := httptest.NewRecorder()
	router.ServeHTTP(metricsResponse, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if metricsResponse.Code != http.StatusOK {
		t.Fatalf("metrics status = %d, want %d", metricsResponse.Code, http.StatusOK)
	}

	body := metricsResponse.Body.String()
	if !strings.Contains(body, `gitrank_pr_analysis_requests_total{service="pr-analyzer",category="security"} 1`) {
		t.Fatalf("metrics body missing analysis request count: %s", body)
	}
	if !strings.Contains(body, `gitrank_pr_analysis_duration_ms_sum{service="pr-analyzer",category="security"}`) {
		t.Fatalf("metrics body missing analysis duration: %s", body)
	}
}

func testConfig() config.App {
	return config.App{
		ServiceName: "pr-analyzer",
		Env:         config.Development,
		Addr:        ":8083",
		Log: config.Log{
			Level:  "info",
			Format: "text",
		},
		ShutdownTimeout: time.Second,
		AI: config.AI{
			BaseURL:        "https://api.openai.com/v1",
			RequestTimeout: time.Second,
		},
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}
