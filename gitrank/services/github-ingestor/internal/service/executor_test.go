package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/githubapi"
)

func TestExecutorFetchRepositoryUsesStableMetadataCache(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/octo/repo" {
			t.Fatalf("path = %q, want /repos/octo/repo", r.URL.Path)
		}
		requests++
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":               101,
			"name":             "repo",
			"full_name":        "octo/repo",
			"stargazers_count": requests,
			"owner":            map[string]any{"login": "octo"},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			RepositoryCacheTTL: time.Minute,
		},
	}, nil, client)

	first, err := executor.fetchRepository(context.Background(), "octo", "repo")
	if err != nil {
		t.Fatalf("fetchRepository(first) error = %v", err)
	}
	first["full_name"] = "mutated/repo"
	if owner, ok := first["owner"].(map[string]any); ok {
		owner["login"] = "mutated"
	}

	second, err := executor.fetchRepository(context.Background(), "OCTO", "repo")
	if err != nil {
		t.Fatalf("fetchRepository(second) error = %v", err)
	}
	if requests != 1 {
		t.Fatalf("server requests = %d, want cached second fetch", requests)
	}
	if second["full_name"] != "octo/repo" {
		t.Fatalf("full_name = %v, want cached clone unaffected by caller mutation", second["full_name"])
	}
	if owner := object(second["owner"]); stringValue(owner["login"]) != "octo" {
		t.Fatalf("owner login = %v, want cached nested clone unaffected by caller mutation", owner["login"])
	}
	if intValue(second["stargazers_count"]) != 1 {
		t.Fatalf("stargazers_count = %v, want first response", second["stargazers_count"])
	}
}
