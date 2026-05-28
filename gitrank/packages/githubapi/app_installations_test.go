package githubapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestListAppInstallationsBuildsBoundedRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/app/installations" {
			t.Fatalf("path = %q, want /app/installations", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "25" {
			t.Fatalf("per_page = %q, want 25", r.URL.Query().Get("per_page"))
		}
		if r.URL.Query().Get("page") != "3" {
			t.Fatalf("page = %q, want 3", r.URL.Query().Get("page"))
		}
		if r.Header.Get("Authorization") != "Bearer app-jwt-token" {
			t.Fatalf("Authorization = %q, want app JWT token", r.Header.Get("Authorization"))
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"id":                   42,
				"app_id":               3731623,
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
		})
	}))
	defer server.Close()

	client, err := NewRESTClient(ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		TokenSource:      StaticTokenSource("app-jwt-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	installations, _, err := ListAppInstallations(context.Background(), client, AppInstallationsRequest{
		PerPage: 25,
		Page:    3,
	})
	if err != nil {
		t.Fatalf("ListAppInstallations() error = %v", err)
	}
	if len(installations) != 1 {
		t.Fatalf("installation count = %d, want 1", len(installations))
	}
	installation := installations[0]
	if installation.ID != 42 {
		t.Fatalf("installation id = %d, want 42", installation.ID)
	}
	if installation.AppSlug != "gitrank-local-app" {
		t.Fatalf("app slug = %q, want gitrank-local-app", installation.AppSlug)
	}
	if installation.Account == nil || installation.Account.Login != "octocat" {
		t.Fatalf("installation account = %+v, want octocat", installation.Account)
	}
}

func TestListAppInstallationsValidatesBounds(t *testing.T) {
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

	if _, _, err := ListAppInstallations(context.Background(), client, AppInstallationsRequest{PerPage: 101}); err == nil {
		t.Fatal("ListAppInstallations() expected per_page bound error")
	}
	if _, _, err := ListAppInstallations(context.Background(), client, AppInstallationsRequest{Page: -1}); err == nil {
		t.Fatal("ListAppInstallations() expected page bound error")
	}
}
