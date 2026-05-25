package analyzer

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
)

func TestNewGeminiSummaryClientRequiresCredentials(t *testing.T) {
	client := newGeminiSummaryClient(AIConfig{
		Provider:            "gemini",
		Model:               "gemini-2.5-flash",
		BaseURL:             "https://generativelanguage.googleapis.com/v1beta/openai",
		SummaryMaxRunes:     320,
		PromptFilePathLimit: 12,
	})
	if client != nil {
		t.Fatal("newGeminiSummaryClient() = non-nil, want nil without API key")
	}
}

func TestGeminiSummaryClientSummarizeSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Path; got != "/v1beta/openai/chat/completions" {
			t.Fatalf("path = %q, want chat completions path", got)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("authorization = %q, want Bearer token", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"  Added regression tests for API handlers.  "}}]}`))
	}))
	defer server.Close()

	client := newGeminiSummaryClient(AIConfig{
		Provider:            "gemini",
		APIKey:              "test-key",
		Model:               "gemini-2.5-flash",
		BaseURL:             server.URL + "/v1beta/openai",
		RequestTimeout:      2 * time.Second,
		SummaryMaxRunes:     320,
		PromptFilePathLimit: 12,
	})
	if client == nil {
		t.Fatal("newGeminiSummaryClient() = nil, want configured client")
	}

	req := contracts.PullRequestAnalysisRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo", PrimaryLanguage: "Go"},
		PullRequest: contracts.PullRequestContext{
			Number:       1,
			Title:        "test: add regression coverage",
			State:        "closed",
			Merged:       true,
			ChangedFiles: 1,
			Files: []contracts.ChangedFile{
				{Path: "service/api_test.go"},
			},
		},
	}
	baseline := contracts.PullRequestAnalysisResponse{
		Category: "tests",
		Signals:  []string{"category=tests"},
	}

	summary, err := client.Summarize(context.Background(), req, baseline)
	if err != nil {
		t.Fatalf("Summarize() error = %v", err)
	}
	if summary != "Added regression tests for API handlers." {
		t.Fatalf("summary = %q, want normalized model text", summary)
	}
}

func TestGeminiSummaryClientSummarizeRateLimitFallbackReason(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":{"message":"quota exceeded"}}`))
	}))
	defer server.Close()

	client := newGeminiSummaryClient(AIConfig{
		Provider:            "gemini",
		APIKey:              "test-key",
		Model:               "gemini-2.5-flash",
		BaseURL:             server.URL,
		RequestTimeout:      2 * time.Second,
		SummaryMaxRunes:     320,
		PromptFilePathLimit: 12,
	})
	if client == nil {
		t.Fatal("newGeminiSummaryClient() = nil, want configured client")
	}

	_, err := client.Summarize(context.Background(), contracts.PullRequestAnalysisRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo"},
		PullRequest: contracts.PullRequestContext{
			Number: 1,
			Title:  "feat: patch",
			Files:  []contracts.ChangedFile{{Path: "service/api.go"}},
		},
	}, contracts.PullRequestAnalysisResponse{
		Category: "feature",
		Signals:  []string{"category=feature"},
	})
	if err == nil {
		t.Fatal("Summarize() error = nil, want rate-limit error")
	}
	var summaryErr *aiSummaryError
	if !strings.Contains(err.Error(), "status 429") {
		t.Fatalf("error = %v, want HTTP status context", err)
	}
	if !errors.As(err, &summaryErr) {
		t.Fatalf("error = %T, want aiSummaryError wrapper", err)
	}
	if summaryErr.reason != "ai_rate_limited" {
		t.Fatalf("reason = %q, want ai_rate_limited", summaryErr.reason)
	}
}
