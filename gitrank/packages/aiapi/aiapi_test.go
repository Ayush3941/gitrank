package aiapi

import "testing"

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
