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
