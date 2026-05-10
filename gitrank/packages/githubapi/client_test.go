package githubapi

import (
	"context"
	"encoding/json"
	"errors"
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
		if r.Header.Get("traceparent") == "" {
			t.Fatal("traceparent header missing")
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

func TestRESTClientCircuitBreakerOpensAfterProviderFailures(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests++
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "github unavailable"})
	}))
	defer server.Close()

	client, err := NewRESTClient(ClientConfig{
		BaseURL:                        server.URL + "/",
		APIVersion:                     "2026-03-10",
		UserAgent:                      "GitRank/test",
		HTTPClient:                     server.Client(),
		SecondaryBackoff:               time.Millisecond,
		MaxConcurrency:                 1,
		CircuitBreakerFailureThreshold: 2,
		CircuitBreakerOpenInterval:     time.Hour,
		CircuitBreakerHalfOpenMax:      1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	for i := 0; i < 2; i++ {
		if _, err := client.GetJSON(context.Background(), "/repos/octo/repo", nil, ConditionalRequest{}, nil); err == nil {
			t.Fatal("GetJSON() expected upstream error")
		}
	}

	if _, err := client.GetJSON(context.Background(), "/repos/octo/repo", nil, ConditionalRequest{}, nil); !errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("GetJSON() error = %v, want ErrCircuitOpen", err)
	}
	if requests != 2 {
		t.Fatalf("server requests = %d, want 2 before circuit opened", requests)
	}
}

func TestRESTClientRejectsUnsafeBaseURL(t *testing.T) {
	_, err := NewRESTClient(ClientConfig{
		BaseURL:                        "file://metadata/latest",
		APIVersion:                     "2026-03-10",
		UserAgent:                      "GitRank/test",
		SecondaryBackoff:               time.Millisecond,
		MaxConcurrency:                 1,
		CircuitBreakerFailureThreshold: 1,
		CircuitBreakerOpenInterval:     time.Second,
		CircuitBreakerHalfOpenMax:      1,
	})
	if err == nil {
		t.Fatal("NewRESTClient() error = nil, want unsafe base URL rejection")
	}
}

func TestRESTClientCircuitBreakerClosesAfterReachableHalfOpenResponse(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests++
		if requests == 1 {
			w.WriteHeader(http.StatusBadGateway)
			_ = json.NewEncoder(w).Encode(map[string]string{"message": "github unavailable"})
			return
		}
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "not found"})
	}))
	defer server.Close()

	client, err := NewRESTClient(ClientConfig{
		BaseURL:                        server.URL + "/",
		APIVersion:                     "2026-03-10",
		UserAgent:                      "GitRank/test",
		HTTPClient:                     server.Client(),
		SecondaryBackoff:               time.Millisecond,
		MaxConcurrency:                 1,
		CircuitBreakerFailureThreshold: 1,
		CircuitBreakerOpenInterval:     time.Millisecond,
		CircuitBreakerHalfOpenMax:      1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	if _, err := client.GetJSON(context.Background(), "/repos/octo/repo", nil, ConditionalRequest{}, nil); err == nil {
		t.Fatal("GetJSON() expected upstream error")
	}
	if _, err := client.GetJSON(context.Background(), "/repos/octo/repo", nil, ConditionalRequest{}, nil); !errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("GetJSON() error = %v, want ErrCircuitOpen", err)
	}

	time.Sleep(2 * time.Millisecond)
	if _, err := client.GetJSON(context.Background(), "/repos/octo/repo", nil, ConditionalRequest{}, nil); errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("GetJSON() error = %v, want reachable 404 to close half-open circuit", err)
	}
	if _, err := client.GetJSON(context.Background(), "/repos/octo/repo", nil, ConditionalRequest{}, nil); errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("GetJSON() error = %v, want circuit to remain closed after reachable response", err)
	}
	if requests != 3 {
		t.Fatalf("server requests = %d, want 3", requests)
	}
}

func TestRESTClientRetriesSecondaryRateLimitBeforeSuccess(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-RateLimit-Limit", "5000")
		w.Header().Set("X-RateLimit-Resource", "core")
		if requests < 3 {
			w.Header().Set("X-RateLimit-Remaining", "4990")
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"message": "You have exceeded a secondary rate limit. Please retry later.",
			})
			return
		}

		w.Header().Set("X-RateLimit-Remaining", "4989")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "recovered"})
	}))
	defer server.Close()

	client, err := NewRESTClient(ClientConfig{
		BaseURL:                        server.URL + "/",
		APIVersion:                     "2026-03-10",
		UserAgent:                      "GitRank/test",
		HTTPClient:                     server.Client(),
		SecondaryBackoff:               time.Millisecond,
		MaxConcurrency:                 1,
		CircuitBreakerFailureThreshold: 2,
		CircuitBreakerOpenInterval:     time.Hour,
		CircuitBreakerHalfOpenMax:      1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	var payload struct {
		Status string `json:"status"`
	}
	meta, err := client.GetJSON(context.Background(), "/repos/octo/repo", nil, ConditionalRequest{}, &payload)
	if err != nil {
		t.Fatalf("GetJSON() error = %v", err)
	}
	if payload.Status != "recovered" {
		t.Fatalf("payload status = %q, want recovered", payload.Status)
	}
	if requests != 3 {
		t.Fatalf("server requests = %d, want two retries then success", requests)
	}
	if meta.RateLimit.Remaining != 4989 {
		t.Fatalf("remaining = %d, want final response rate-limit metadata", meta.RateLimit.Remaining)
	}
}

func TestRESTClientBackoffDelayHonorsRetryAfterHeader(t *testing.T) {
	client := &RESTClient{secondaryBackoff: time.Hour}
	if got := client.backoffDelay(2, "7"); got != 7*time.Second {
		t.Fatalf("backoffDelay() = %v, want Retry-After value", got)
	}
}

func TestGraphQLClientCircuitBreakerOpensAfterProviderFailures(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests++
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "github unavailable"})
	}))
	defer server.Close()

	client, err := NewGraphQLClient(ClientConfig{
		BaseURL:                        server.URL,
		APIVersion:                     "2026-03-10",
		UserAgent:                      "GitRank/test",
		HTTPClient:                     server.Client(),
		SecondaryBackoff:               time.Millisecond,
		MaxConcurrency:                 1,
		CircuitBreakerFailureThreshold: 2,
		CircuitBreakerOpenInterval:     time.Hour,
		CircuitBreakerHalfOpenMax:      1,
	})
	if err != nil {
		t.Fatalf("NewGraphQLClient() error = %v", err)
	}

	for i := 0; i < 2; i++ {
		if _, err := client.QueryJSON(context.Background(), "query { viewer { login } }", nil, nil); err == nil {
			t.Fatal("QueryJSON() expected upstream error")
		}
	}

	if _, err := client.QueryJSON(context.Background(), "query { viewer { login } }", nil, nil); !errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("QueryJSON() error = %v, want ErrCircuitOpen", err)
	}
	if requests != 2 {
		t.Fatalf("server requests = %d, want 2 before circuit opened", requests)
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

func TestGraphQLClientRetriesSecondaryRateLimitBeforeSuccess(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-GitHub-Request-Id", "graphql-rate-limit")
		w.Header().Set("X-RateLimit-Limit", "5000")
		if requests < 3 {
			w.Header().Set("X-RateLimit-Remaining", "4990")
			_ = json.NewEncoder(w).Encode(GraphQLResponse[map[string]any]{
				Errors: []GraphQLError{{
					Message: "You have exceeded a secondary rate limit. Please retry later.",
				}},
			})
			return
		}

		w.Header().Set("X-RateLimit-Remaining", "4988")
		_ = json.NewEncoder(w).Encode(GraphQLResponse[struct {
			Viewer struct {
				Login string `json:"login"`
			} `json:"viewer"`
		}]{
			Data: struct {
				Viewer struct {
					Login string `json:"login"`
				} `json:"viewer"`
			}{
				Viewer: struct {
					Login string `json:"login"`
				}{Login: "octocat"},
			},
		})
	}))
	defer server.Close()

	client, err := NewGraphQLClient(ClientConfig{
		BaseURL:                        server.URL,
		APIVersion:                     "2026-03-10",
		UserAgent:                      "GitRank/test",
		HTTPClient:                     server.Client(),
		SecondaryBackoff:               time.Millisecond,
		MaxConcurrency:                 1,
		CircuitBreakerFailureThreshold: 2,
		CircuitBreakerOpenInterval:     time.Hour,
		CircuitBreakerHalfOpenMax:      1,
	})
	if err != nil {
		t.Fatalf("NewGraphQLClient() error = %v", err)
	}

	var response GraphQLResponse[struct {
		Viewer struct {
			Login string `json:"login"`
		} `json:"viewer"`
	}]
	meta, err := client.QueryJSON(context.Background(), "query { viewer { login } }", nil, &response)
	if err != nil {
		t.Fatalf("QueryJSON() error = %v", err)
	}
	if response.Data.Viewer.Login != "octocat" {
		t.Fatalf("viewer login = %q, want octocat", response.Data.Viewer.Login)
	}
	if requests != 3 {
		t.Fatalf("server requests = %d, want two retries then success", requests)
	}
	if meta.RateLimit.Remaining != 4988 {
		t.Fatalf("remaining = %d, want final response rate-limit metadata", meta.RateLimit.Remaining)
	}
}
