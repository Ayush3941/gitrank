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
