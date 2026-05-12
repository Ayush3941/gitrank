package aiapi

import (
	"context"
	"strings"
	"testing"

	"github.com/gitrank/gitrank/packages/tracekit"
)

func TestBuildResponsesRequest(t *testing.T) {
	req, err := BuildResponsesRequest(Config{
		BaseURL:        "https://api.openai.com/v1",
		APIKey:         "key",
		Model:          "gpt-5.5",
		RequestTimeout: 20,
	}, ResponsesRequest{
		Input: "classify this pull request",
	})
	if err != nil {
		t.Fatalf("BuildResponsesRequest() error = %v", err)
	}
	if req.URL != "https://api.openai.com/v1/responses" {
		t.Fatalf("URL = %q, want responses endpoint", req.URL)
	}
	if req.Headers.Get("traceparent") == "" {
		t.Fatal("traceparent header missing")
	}
}

func TestBuildResponsesRequestWithContextPropagatesTrace(t *testing.T) {
	ctx := tracekit.WithContext(context.Background(), tracekit.TraceContext{
		TraceID: "4bf92f3577b34da6a3ce929d0e0e4736",
		SpanID:  "00f067aa0ba902b7",
		Flags:   "01",
	})

	req, err := BuildResponsesRequestWithContext(ctx, Config{
		BaseURL: "https://api.openai.com/v1",
		APIKey:  "key",
		Model:   "gpt-5.5",
	}, ResponsesRequest{
		Input: "classify this pull request",
	})
	if err != nil {
		t.Fatalf("BuildResponsesRequestWithContext() error = %v", err)
	}
	if got := req.Headers.Get("traceparent"); !strings.Contains(got, "4bf92f3577b34da6a3ce929d0e0e4736") {
		t.Fatalf("traceparent = %q, want propagated trace id", got)
	}
}

func TestBuildResponsesRequestRejectsUnsafeBaseURL(t *testing.T) {
	_, err := BuildResponsesRequest(Config{
		BaseURL: "http://token@127.0.0.1:11434/v1",
		APIKey:  "key",
		Model:   "gpt-5.5",
	}, ResponsesRequest{
		Input: "classify this pull request",
	})
	if err == nil {
		t.Fatal("BuildResponsesRequest() error = nil, want unsafe base URL rejection")
	}
}
