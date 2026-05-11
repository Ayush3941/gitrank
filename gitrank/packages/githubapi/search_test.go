package githubapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSearchIssuesAndPullRequestsBuildsBoundedQuery(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/search/issues" {
			t.Fatalf("path = %q, want /search/issues", r.URL.Path)
		}
		query := r.URL.Query()
		if got := query.Get("q"); got != "author:alice type:pr archived:false" {
			t.Fatalf("q = %q, want authored PR query", got)
		}
		if query.Get("sort") != "updated" || query.Get("order") != "desc" {
			t.Fatalf("sort/order = %q/%q, want updated/desc", query.Get("sort"), query.Get("order"))
		}
		if query.Get("per_page") != "11" {
			t.Fatalf("per_page = %q, want 11", query.Get("per_page"))
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"total_count":        1,
			"incomplete_results": false,
			"items": []map[string]any{
				{
					"number":         42,
					"repository_url": "https://api.github.com/repos/octo/repo",
					"pull_request": map[string]any{
						"url": "https://api.github.com/repos/octo/repo/pulls/42",
					},
					"repository": map[string]any{
						"full_name": "octo/repo",
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
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	result, _, err := SearchIssuesAndPullRequests(context.Background(), client, IssueSearchRequest{
		Query:   "author:alice type:pr archived:false",
		Sort:    "updated",
		Order:   "desc",
		PerPage: 11,
	})
	if err != nil {
		t.Fatalf("SearchIssuesAndPullRequests() error = %v", err)
	}
	if result.TotalCount != 1 || len(result.Items) != 1 {
		t.Fatalf("result = %+v, want one search result", result)
	}
	if result.Items[0].PullRequest == nil {
		t.Fatal("search result did not decode pull_request links")
	}
	if result.Items[0].Repository == nil || result.Items[0].Repository.FullName != "octo/repo" {
		t.Fatalf("repository = %+v, want octo/repo", result.Items[0].Repository)
	}
}

func TestSearchIssuesAndPullRequestsRequiresQuery(t *testing.T) {
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

	if _, _, err := SearchIssuesAndPullRequests(context.Background(), client, IssueSearchRequest{}); err == nil {
		t.Fatal("SearchIssuesAndPullRequests() error = nil, want query validation error")
	}
}
