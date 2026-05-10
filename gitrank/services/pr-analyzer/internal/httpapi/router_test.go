package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
)

func TestAnalyzePullRequestReturnsValidatedEnvelope(t *testing.T) {
	router := NewRouter(testConfig(), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/analyze/pull-request", strings.NewReader(`{
		"repository":{"full_name":"octo/repo","primary_language":"Go"},
		"pull_request":{
			"title":"security: tighten auth validation",
			"changed_files":2,
			"files":[{"path":"internal/auth/validator.go"},{"path":"internal/auth/validator_test.go"}],
			"reviews":[{"state":"APPROVED","author_association":"MEMBER"}]
		}
	}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusOK, response.Body.String())
	}

	var payload contracts.PullRequestAnalysisResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if payload.SchemaVersion != contracts.PullRequestAnalysisSchemaVersion {
		t.Fatalf("SchemaVersion = %q, want %q", payload.SchemaVersion, contracts.PullRequestAnalysisSchemaVersion)
	}
	if payload.AnalysisSource != contracts.AnalysisSourceDeterministic {
		t.Fatalf("AnalysisSource = %q, want %q", payload.AnalysisSource, contracts.AnalysisSourceDeterministic)
	}
	if payload.ValidationStatus != contracts.AnalysisValidationValidated {
		t.Fatalf("ValidationStatus = %q, want %q", payload.ValidationStatus, contracts.AnalysisValidationValidated)
	}
	if payload.PrimaryDetectedLanguage != "Go" {
		t.Fatalf("PrimaryDetectedLanguage = %q, want Go", payload.PrimaryDetectedLanguage)
	}
	if payload.ReviewCycles != 0 {
		t.Fatalf("ReviewCycles = %d, want 0", payload.ReviewCycles)
	}
	if len(payload.CriticalityTags) == 0 || payload.CriticalityTags[0] != "auth_identity" {
		t.Fatalf("CriticalityTags = %v, want auth_identity", payload.CriticalityTags)
	}

	metricsResponse := httptest.NewRecorder()
	router.ServeHTTP(metricsResponse, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if metricsResponse.Code != http.StatusOK {
		t.Fatalf("metrics status = %d, want %d", metricsResponse.Code, http.StatusOK)
	}
	metrics := metricsResponse.Body.String()
	if !strings.Contains(metrics, `gitrank_pr_analysis_requests_total{service="pr-analyzer",category="security"} 1`) {
		t.Fatalf("metrics body missing analysis count: %s", metrics)
	}
	if !strings.Contains(metrics, `gitrank_pr_analysis_estimated_tokens_total{service="pr-analyzer",provider="none",model="deterministic",source="deterministic",phase="total"}`) {
		t.Fatalf("metrics body missing analysis token estimate: %s", metrics)
	}
	if !strings.Contains(metrics, `gitrank_pr_analysis_estimated_cost_usd_total{service="pr-analyzer",provider="none",model="deterministic",source="deterministic"} 0.000000`) {
		t.Fatalf("metrics body missing deterministic cost estimate: %s", metrics)
	}
}

func TestAnalyzePullRequestRejectsInvalidRequest(t *testing.T) {
	router := NewRouter(testConfig(), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/analyze/pull-request", strings.NewReader(`{
		"repository":{"full_name":""},
		"pull_request":{"title":"","changed_files":1}
	}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusBadRequest, response.Body.String())
	}
}

func testConfig() config.App {
	return config.App{
		ServiceName: "pr-analyzer",
		Env:         config.Development,
		Addr:        ":8084",
		Log: config.Log{
			Level:  "info",
			Format: "text",
		},
		ShutdownTimeout: time.Second,
		AI: config.AI{
			BaseURL: "https://api.openai.com/v1",
		},
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}
