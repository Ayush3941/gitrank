package githubapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestListInstallationRepositoriesBuildsBoundedRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/installation/repositories" {
			t.Fatalf("path = %q, want /installation/repositories", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "5" {
			t.Fatalf("per_page = %q, want 5", r.URL.Query().Get("per_page"))
		}
		if r.URL.Query().Get("page") != "2" {
			t.Fatalf("page = %q, want 2", r.URL.Query().Get("page"))
		}
		if r.Header.Get("Authorization") != "Bearer installation-token" {
			t.Fatalf("Authorization = %q, want installation token", r.Header.Get("Authorization"))
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"total_count": 2,
			"repositories": []map[string]any{
				{
					"id":        101,
					"name":      "repo-one",
					"full_name": "octo/repo-one",
					"private":   false,
					"archived":  false,
					"disabled":  false,
					"owner": map[string]any{
						"id":    7001,
						"login": "octo",
						"type":  "Organization",
					},
				},
			},
		})
	}))
	defer server.Close()

	client, err := NewRESTClient(ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		TokenSource:      StaticTokenSource("installation-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	response, _, err := ListInstallationRepositories(context.Background(), client, InstallationRepositoriesRequest{
		PerPage: 5,
		Page:    2,
	})
	if err != nil {
		t.Fatalf("ListInstallationRepositories() error = %v", err)
	}
	if response.TotalCount != 2 {
		t.Fatalf("total_count = %d, want 2", response.TotalCount)
	}
	if len(response.Repositories) != 1 || response.Repositories[0].FullName != "octo/repo-one" {
		t.Fatalf("repositories = %+v, want one decoded repository", response.Repositories)
	}
}

func TestListInstallationRepositoriesValidatesBounds(t *testing.T) {
	client, err := NewRESTClient(ClientConfig{
		BaseURL:          "https://api.github.test",
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	if _, _, err := ListInstallationRepositories(context.Background(), client, InstallationRepositoriesRequest{PerPage: 101}); err == nil {
		t.Fatal("ListInstallationRepositories() expected per_page bound error")
	}
	if _, _, err := ListInstallationRepositories(context.Background(), client, InstallationRepositoriesRequest{Page: -1}); err == nil {
		t.Fatal("ListInstallationRepositories() expected page bound error")
	}
}
