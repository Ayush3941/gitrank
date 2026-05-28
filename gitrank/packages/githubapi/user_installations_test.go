package githubapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestListUserInstallationsBuildsBoundedRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/user/installations" {
			t.Fatalf("path = %q, want /user/installations", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "10" {
			t.Fatalf("per_page = %q, want 10", r.URL.Query().Get("per_page"))
		}
		if r.URL.Query().Get("page") != "2" {
			t.Fatalf("page = %q, want 2", r.URL.Query().Get("page"))
		}
		if r.Header.Get("Authorization") != "Bearer user-token" {
			t.Fatalf("Authorization = %q, want user token", r.Header.Get("Authorization"))
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"total_count": 1,
			"installations": []map[string]any{
				{
					"id":                   42,
					"app_id":               1234,
					"app_slug":             "gitrank-local-app",
					"target_type":          "User",
					"repository_selection": "all",
					"permissions": map[string]any{
						"metadata":      "read",
						"pull_requests": "read",
					},
					"events":     []string{"pull_request", "pull_request_review"},
					"created_at": "2026-05-28T00:00:00Z",
					"account": map[string]any{
						"id":    1,
						"login": "octocat",
						"type":  "User",
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
		TokenSource:      StaticTokenSource("user-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	response, _, err := ListUserInstallations(context.Background(), client, UserInstallationsRequest{
		PerPage: 10,
		Page:    2,
	})
	if err != nil {
		t.Fatalf("ListUserInstallations() error = %v", err)
	}
	if response.TotalCount != 1 {
		t.Fatalf("total_count = %d, want 1", response.TotalCount)
	}
	if len(response.Installations) != 1 {
		t.Fatalf("installation count = %d, want 1", len(response.Installations))
	}
	installation := response.Installations[0]
	if installation.ID != 42 {
		t.Fatalf("installation id = %d, want 42", installation.ID)
	}
	if installation.Account == nil || installation.Account.Login != "octocat" {
		t.Fatalf("installation account = %+v, want octocat", installation.Account)
	}
}

func TestListUserInstallationsValidatesBounds(t *testing.T) {
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

	if _, _, err := ListUserInstallations(context.Background(), client, UserInstallationsRequest{PerPage: 101}); err == nil {
		t.Fatal("ListUserInstallations() expected per_page bound error")
	}
	if _, _, err := ListUserInstallations(context.Background(), client, UserInstallationsRequest{Page: -1}); err == nil {
		t.Fatal("ListUserInstallations() expected page bound error")
	}
}
