package githubapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"
)

func TestParseLinkHeader(t *testing.T) {
	links := ParseLinkHeader(`<https://api.github.com/repositories/1/issues?page=2>; rel="next", <https://api.github.com/repositories/1/issues?page=4>; rel="last"`)
	if links["next"] == "" {
		t.Fatal("ParseLinkHeader() missing next link")
	}
	if links["last"] == "" {
		t.Fatal("ParseLinkHeader() missing last link")
	}
}

func TestBuildAppInstallURL(t *testing.T) {
	installURL, err := BuildAppInstallURL("", "gitrank")
	if err != nil {
		t.Fatalf("BuildAppInstallURL() error = %v", err)
	}
	if installURL != "https://github.com/apps/gitrank/installations/new" {
		t.Fatalf("BuildAppInstallURL() = %q, want generated URL", installURL)
	}
}

func TestParseRetryAfter(t *testing.T) {
	now := time.Date(2026, 5, 5, 12, 0, 0, 0, time.UTC)
	if got := ParseRetryAfter("120", now); got != 120*time.Second {
		t.Fatalf("ParseRetryAfter(seconds) = %v, want 120s", got)
	}

	header := now.Add(90 * time.Second).Format(http.TimeFormat)
	if got := ParseRetryAfter(header, now); got < 89*time.Second || got > 90*time.Second {
		t.Fatalf("ParseRetryAfter(http-date) = %v, want about 90s", got)
	}
}

func TestRESTClientGetJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Fatalf("Authorization header = %q, want bearer token", r.Header.Get("Authorization"))
		}
		if r.Header.Get("If-None-Match") != "\"etag-1\"" {
			t.Fatalf("If-None-Match = %q, want %q", r.Header.Get("If-None-Match"), "\"etag-1\"")
		}
		if r.URL.RawQuery != "page=2" {
			t.Fatalf("RawQuery = %q, want page=2", r.URL.RawQuery)
		}

		w.Header().Set("ETag", "\"etag-2\"")
		w.Header().Set("Last-Modified", "Tue, 05 May 2026 12:00:00 GMT")
		w.Header().Set("X-RateLimit-Limit", "5000")
		w.Header().Set("X-RateLimit-Remaining", "4999")
		w.Header().Set("X-RateLimit-Used", "1")
		w.Header().Set("X-RateLimit-Reset", "1770000000")
		w.Header().Set("X-RateLimit-Resource", "core")
		w.Header().Set("Link", `<https://api.github.com/repositories/1/pulls?page=3>; rel="next"`)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":    1,
			"title": "Improve sync retries",
		})
	}))
	defer server.Close()

	client, err := NewRESTClient(ClientConfig{
		BaseURL:          server.URL + "/",
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		TokenSource:      StaticTokenSource("test-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	var payload struct {
		ID    int    `json:"id"`
		Title string `json:"title"`
	}
	meta, err := client.DoJSON(
		context.Background(),
		http.MethodGet,
		"/repos/octo/repo/pulls",
		url.Values{"page": {"2"}},
		ConditionalRequest{ETag: "\"etag-1\""},
		nil,
		&payload,
	)
	if err != nil {
		t.Fatalf("DoJSON() error = %v", err)
	}
	if payload.ID != 1 || payload.Title == "" {
		t.Fatalf("payload = %+v, want decoded response", payload)
	}
	if meta.ETag != "\"etag-2\"" {
		t.Fatalf("meta.ETag = %q, want %q", meta.ETag, "\"etag-2\"")
	}
	if meta.RateLimit.Remaining != 4999 {
		t.Fatalf("meta.RateLimit.Remaining = %d, want 4999", meta.RateLimit.Remaining)
	}
	if meta.Links["next"] == "" {
		t.Fatal("meta.Links missing next page")
	}
}

func TestGraphQLClientQueryJSON(t *testing.T) {
	query := "query Viewer($owner: String!) { viewer { login } repository(owner: $owner, name: \"gitrank\") { name } }"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %q, want POST", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Fatalf("Authorization header = %q, want bearer token", r.Header.Get("Authorization"))
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Fatalf("Content-Type = %q, want application/json", r.Header.Get("Content-Type"))
		}

		var request GraphQLRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatalf("decode GraphQL request: %v", err)
		}
		if request.Query != query {
			t.Fatalf("query = %q, want %q", request.Query, query)
		}

		variables, ok := request.Variables.(map[string]any)
		if !ok {
			t.Fatalf("variables type = %T, want map[string]any", request.Variables)
		}
		if variables["owner"] != "openai" {
			t.Fatalf("variables[owner] = %v, want openai", variables["owner"])
		}

		w.Header().Set("X-GitHub-Request-Id", "graphql-req-1")
		w.Header().Set("X-RateLimit-Limit", "5000")
		w.Header().Set("X-RateLimit-Remaining", "4998")
		w.Header().Set("X-RateLimit-Used", "2")
		w.Header().Set("X-RateLimit-Reset", "1770000123")
		_ = json.NewEncoder(w).Encode(GraphQLResponse[struct {
			Viewer struct {
				Login string `json:"login"`
			} `json:"viewer"`
			Repository struct {
				Name string `json:"name"`
			} `json:"repository"`
		}]{
			Data: struct {
				Viewer struct {
					Login string `json:"login"`
				} `json:"viewer"`
				Repository struct {
					Name string `json:"name"`
				} `json:"repository"`
			}{
				Viewer: struct {
					Login string `json:"login"`
				}{Login: "octocat"},
				Repository: struct {
					Name string `json:"name"`
				}{Name: "gitrank"},
			},
		})
	}))
	defer server.Close()

	client, err := NewGraphQLClient(ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		TokenSource:      StaticTokenSource("test-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewGraphQLClient() error = %v", err)
	}

	var response GraphQLResponse[struct {
		Viewer struct {
			Login string `json:"login"`
		} `json:"viewer"`
		Repository struct {
			Name string `json:"name"`
		} `json:"repository"`
	}]
	meta, err := client.QueryJSON(context.Background(), query, map[string]any{"owner": "openai"}, &response)
	if err != nil {
		t.Fatalf("QueryJSON() error = %v", err)
	}
	if response.Data.Viewer.Login != "octocat" {
		t.Fatalf("viewer login = %q, want octocat", response.Data.Viewer.Login)
	}
	if response.Data.Repository.Name != "gitrank" {
		t.Fatalf("repository name = %q, want gitrank", response.Data.Repository.Name)
	}
	if meta.RequestID != "graphql-req-1" {
		t.Fatalf("request id = %q, want graphql-req-1", meta.RequestID)
	}
	if meta.RateLimit.Remaining != 4998 {
		t.Fatalf("remaining = %d, want 4998", meta.RateLimit.Remaining)
	}
}
