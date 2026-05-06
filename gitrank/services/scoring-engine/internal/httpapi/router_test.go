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
	"github.com/Ayush3941/gitrank/services/scoring-engine/internal/service"
)

func TestMetricsIncludeScoreComputationDuration(t *testing.T) {
	router := testRouter(t)
	request := httptest.NewRequest(http.MethodPost, "/v1/score/contribution", strings.NewReader(`{
		"repository":{"full_name":"octo/repo","maintainers":4,"stars":1200},
		"pull_request":{"merged":true,"changed_files":1,"additions":4,"deletions":2},
		"analysis":{"category":"documentation","technical_depth":0.8,"review_strength":0.9,"skills":["documentation"],"file_breakdown":{"docs":1}},
		"contributor":{"recent_merged_pull_requests":1}
	}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("score status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}

	metricsResponse := httptest.NewRecorder()
	router.ServeHTTP(metricsResponse, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if metricsResponse.Code != http.StatusOK {
		t.Fatalf("metrics status = %d, want %d", metricsResponse.Code, http.StatusOK)
	}

	body := metricsResponse.Body.String()
	if !strings.Contains(body, `gitrank_score_computations_total{service="scoring-engine"} 1`) {
		t.Fatalf("metrics body missing score count: %s", body)
	}
	if !strings.Contains(body, `gitrank_score_computation_duration_ms_sum{service="scoring-engine"}`) {
		t.Fatalf("metrics body missing score duration: %s", body)
	}
	if !strings.Contains(body, `gitrank_score_suspicious_total{service="scoring-engine"} 1`) {
		t.Fatalf("metrics body missing suspicious count: %s", body)
	}
}

func TestScoreContributionRejectsInvalidAnalysisEnvelope(t *testing.T) {
	router := testRouter(t)
	request := httptest.NewRequest(http.MethodPost, "/v1/score/contribution", strings.NewReader(`{
		"repository":{"full_name":"octo/repo"},
		"pull_request":{"changed_files":1,"additions":4,"deletions":2},
		"analysis":{
			"analysis_source":"ai_assisted",
			"category":"feature",
			"technical_depth":1.0,
			"review_strength":1.0
		}
	}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusBadRequest, response.Body.String())
	}
}

func TestReplayRouteUnavailableWithoutDatabase(t *testing.T) {
	router := testRouter(t)
	request := httptest.NewRequest(http.MethodPost, "/v1/score/users/00000000-0000-0000-0000-000000000001/replay", strings.NewReader(`{}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusServiceUnavailable, response.Body.String())
	}
}

func testConfig() config.App {
	return config.App{
		ServiceName: "scoring-engine",
		Env:         config.Development,
		Addr:        ":8085",
		Log: config.Log{
			Level:  "info",
			Format: "text",
		},
		ShutdownTimeout: time.Second,
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func testRouter(t *testing.T) http.Handler {
	t.Helper()

	svc, err := service.New(testConfig(), nil, testLogger())
	if err != nil {
		t.Fatalf("service.New() error = %v", err)
	}
	return NewRouter(testConfig(), svc, testLogger(), "test")
}
