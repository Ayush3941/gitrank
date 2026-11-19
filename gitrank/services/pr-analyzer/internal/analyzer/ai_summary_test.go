package analyzer

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
)

func TestSummaryGenerationStreamsLongExplanationFromEvidence(t *testing.T) {
	narrative := strings.Repeat("A client-friendly explanation. ", 40)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" || r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("incorrect provider request")
		}
		var payload struct {
			Stream   bool                             `json:"stream"`
			Messages []struct{ Role, Content string } `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Error(err)
		}
		if !payload.Stream || len(payload.Messages) != 2 || !strings.Contains(payload.Messages[0].Content, "1000 words") || !strings.Contains(payload.Messages[1].Content, "A proposal, not a release") {
			t.Errorf("invalid prompt: %+v", payload)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		event, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"delta": map[string]string{"content": narrative}}}})
		_, _ = w.Write(append(append([]byte("data: "), event...), []byte("\n\ndata: [DONE]\n\n")...))
	}))
	defer server.Close()
	generator := NewSummaryGenerator(AIConfig{Provider: "openai", APIKey: "test-key", Model: "gpt-4o-mini", BaseURL: server.URL + "/v1", RequestTimeout: time.Second})
	response, err := generator.Generate(context.Background(), contracts.PullRequestAnalysisRequest{
		Repository:  contracts.RepositoryContext{FullName: "octo/repo"},
		PullRequest: contracts.PullRequestContext{Title: "Compatibility proposal", Body: "A proposal, not a release"},
	}, contracts.PullRequestAnalysisResponse{Category: "feature"})
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil || !strings.Contains(string(body), narrative) {
		t.Fatalf("long explanation was truncated: %s, %v", body, err)
	}
}

func TestSummaryProviderFailureIsLocalToGeneration(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(429)
		_, _ = w.Write([]byte(`{"error":{"code":"insufficient_quota","message":"private provider diagnostic"}}`))
	}))
	defer server.Close()
	generator := NewSummaryGenerator(AIConfig{Provider: "openai", APIKey: "test-key", Model: "gpt-4o-mini", BaseURL: server.URL, RequestTimeout: time.Second})
	_, err := generator.Generate(context.Background(), contracts.PullRequestAnalysisRequest{}, contracts.PullRequestAnalysisResponse{})
	var failure *SummaryError
	if !errors.As(err, &failure) || failure.Code != "ai_quota_exceeded" || failure.Status != 429 || strings.Contains(failure.Message, "private provider") {
		t.Fatalf("unexpected safe failure: %v", err)
	}
}

func TestSummaryGenerationRequiresConfiguration(t *testing.T) {
	generator := NewSummaryGenerator(AIConfig{Provider: "openai", Model: "gpt-4o-mini", BaseURL: "https://api.openai.com/v1", RequestTimeout: time.Second})
	if generator != nil {
		t.Fatal("generator enabled without a key")
	}
	_, err := generator.Generate(context.Background(), contracts.PullRequestAnalysisRequest{}, contracts.PullRequestAnalysisResponse{})
	var failure *SummaryError
	if !errors.As(err, &failure) || failure.Status != 503 {
		t.Fatalf("missing configuration error=%v", err)
	}
}
