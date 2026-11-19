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

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
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

func TestRegularAnalysisDoesNotInvokeConfiguredAI(t *testing.T) {
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("deterministic analysis contacted the AI provider")
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer provider.Close()
	cfg := testConfig()
	cfg.AI.Provider, cfg.AI.APIKey, cfg.AI.Model = "openai", "test-key", "gpt-4o-mini"
	cfg.AI.BaseURL, cfg.AI.RequestTimeout = provider.URL, time.Second
	router := NewRouter(cfg, testLogger(), "test")
	req := httptest.NewRequest(http.MethodPost, "/v1/analyze/pull-request", strings.NewReader(`{"repository":{"full_name":"octo/repo"},"pull_request":{"title":"A small change","changed_files":1}}`))
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	var analysis contracts.PullRequestAnalysisResponse
	if err := json.Unmarshal(response.Body.Bytes(), &analysis); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusOK || analysis.AnalysisSource != contracts.AnalysisSourceDeterministic || analysis.FallbackReason != "" || analysis.ModelName != "" {
		t.Fatalf("analysis depends on AI: status=%d response=%+v", response.Code, analysis)
	}
}

func TestDeterministicAnalysisIsIndependentOfAILimits(t *testing.T) {
	cfg := testConfig()
	cfg.AI.PRMaxChangedFiles = 1
	router := NewRouter(cfg, testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/analyze/pull-request", strings.NewReader(`{
		"repository":{"full_name":"octo/repo"},
		"pull_request":{
			"title":"feat: large change",
			"changed_files":2,
			"files":[{"path":"a.go"},{"path":"b.go"}]
		}
	}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("deterministic analysis depends on AI budget: status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestSummaryGenerationStillEnforcesInputLimits(t *testing.T) {
	cfg := testConfig()
	cfg.AI.PRMaxChangedFiles = 1
	response := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/analyze/pull-request/summary", nil)
	allowed := allowSummaryGeneration(response, req, contracts.PullRequestAnalysisRequest{PullRequest: contracts.PullRequestContext{ChangedFiles: 2}}, cfg.AI)
	if allowed || response.Code != http.StatusRequestEntityTooLarge || !strings.Contains(response.Body.String(), "changed_files_limit_exceeded") {
		t.Fatalf("summary ignored input limits: allowed=%t status=%d", allowed, response.Code)
	}
}

func TestAnalyzePullRequestExecuteRequiresPersistence(t *testing.T) {
	router := NewRouter(testConfig(), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/analyze/pull-request/execute", strings.NewReader(`{"repository":"octo/repo","number":17}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusServiceUnavailable, response.Body.String())
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
			BaseURL:                    "https://api.openai.com/v1",
			PRMaxChangedFiles:          100,
			PRMaxFileRecords:           100,
			PRMaxDiffLines:             5000,
			PRMaxInputChars:            120000,
			PRMaxEstimatedTokens:       30000,
			PRMaxEstimatedCostUSD:      0.25,
			EstimatedInputTokenCostUSD: 0.000005,
		},
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}
