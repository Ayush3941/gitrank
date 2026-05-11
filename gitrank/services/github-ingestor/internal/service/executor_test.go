package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/authkit"
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

func TestDecodeOptionalOAuthTokenKeysIncludesPreviousKeys(t *testing.T) {
	keys := decodeOptionalOAuthTokenKeys(config.App{
		Auth: config.Auth{
			TokenEncryptionKey:          "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
			PreviousTokenEncryptionKeys: []string{"YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY="},
		},
	})
	if len(keys) != 2 {
		t.Fatalf("keys len = %d, want current plus previous", len(keys))
	}

	encrypted, err := authkit.EncryptSecret(keys[1], "ghu_previous")
	if err != nil {
		t.Fatalf("EncryptSecret() error = %v", err)
	}
	decrypted, index, err := authkit.DecryptSecretAny(keys, encrypted)
	if err != nil {
		t.Fatalf("DecryptSecretAny() error = %v", err)
	}
	if index != 1 || decrypted != "ghu_previous" {
		t.Fatalf("DecryptSecretAny() = %q index %d, want previous token at index 1", decrypted, index)
	}
}

func TestExecutorFetchPullRequestFilesUsesBoundedRESTEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/octo/repo/pulls/7/files" {
			t.Fatalf("path = %q, want /repos/octo/repo/pulls/7/files", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "7" {
			t.Fatalf("per_page = %q, want 7", r.URL.Query().Get("per_page"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"filename":  "internal/service.go",
				"status":    "modified",
				"additions": 12,
				"deletions": 3,
				"patch":     "@@ -1 +1 @@\n-old\n+new",
			},
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
			MaxPageSize: 7,
		},
	}, nil, client)

	files, err := executor.fetchPullRequestFiles(context.Background(), "octo", "repo", 7)
	if err != nil {
		t.Fatalf("fetchPullRequestFiles() error = %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("files len = %d, want 1", len(files))
	}
	if path := stringValue(files[0]["filename"]); path != "internal/service.go" {
		t.Fatalf("filename = %q, want internal/service.go", path)
	}
}

func TestSanitizedPullRequestFilePayloadBoundsPatchAndDropsContents(t *testing.T) {
	longPatch := strings.Repeat("a", maxStoredPullRequestFilePatchBytes+20)
	file := map[string]any{
		"filename": "internal/service.go",
		"patch":    longPatch,
		"contents": "full file should not be stored",
		"content":  "raw file should not be stored",
		"nested": map[string]any{
			"value": "keep",
		},
	}

	patch := pullRequestFilePatch(file)
	if len(patch) != maxStoredPullRequestFilePatchBytes {
		t.Fatalf("patch bytes = %d, want %d", len(patch), maxStoredPullRequestFilePatchBytes)
	}

	payload := sanitizedPullRequestFilePayload(file, patch)
	if _, ok := payload["contents"]; ok {
		t.Fatal("sanitized payload kept contents field")
	}
	if _, ok := payload["content"]; ok {
		t.Fatal("sanitized payload kept content field")
	}
	if rawStringValue(payload["patch"]) != patch {
		t.Fatal("sanitized payload did not use bounded patch")
	}
	if rawStringValue(file["patch"]) != longPatch {
		t.Fatal("sanitization mutated original patch")
	}

	object(payload["nested"])["value"] = "changed"
	if got := stringValue(object(file["nested"])["value"]); got != "keep" {
		t.Fatalf("nested original value = %q, want keep", got)
	}
}

func TestBoundedStringBytesKeepsValidUTF8(t *testing.T) {
	if got := boundedStringBytes("aé", 2); got != "a" {
		t.Fatalf("boundedStringBytes() = %q, want a", got)
	}
}

func TestExecutorFetchPullRequestsUsesGraphQLBatchWhenTokenAvailable(t *testing.T) {
	restRequests := make(map[string]int)
	restServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		restRequests[r.URL.Path]++
		if r.URL.Path != "/repos/octo/repo/pulls" {
			t.Fatalf("unexpected REST path %q; GraphQL batch should avoid per-PR REST hydration", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "20" {
			t.Fatalf("per_page = %q, want GraphQL-bounded page size 20", r.URL.Query().Get("per_page"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"id":     7007,
				"number": 7,
				"user": map[string]any{
					"id":    1001,
					"login": "alice",
				},
				"labels": []map[string]any{
					{
						"id":          9901,
						"name":        "bug",
						"color":       "d73a4a",
						"description": "Something is not working",
						"default":     true,
					},
				},
			},
		})
	}))
	defer restServer.Close()

	graphqlRequests := 0
	graphqlServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		graphqlRequests++
		if r.Method != http.MethodPost {
			t.Fatalf("GraphQL method = %q, want POST", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer user-token" {
			t.Fatalf("Authorization = %q, want user token", r.Header.Get("Authorization"))
		}
		var request githubapi.GraphQLRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatalf("decode GraphQL request: %v", err)
		}
		variables, ok := request.Variables.(map[string]any)
		if !ok {
			t.Fatalf("variables type = %T, want map[string]any", request.Variables)
		}
		if variables["owner"] != "octo" || variables["name"] != "repo" {
			t.Fatalf("variables owner/name = %v/%v, want octo/repo", variables["owner"], variables["name"])
		}
		if variables["first"] != float64(1) || variables["reviewsFirst"] != float64(20) {
			t.Fatalf("variables first/reviewsFirst = %v/%v, want 1/20", variables["first"], variables["reviewsFirst"])
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"repository": map[string]any{
					"pullRequests": map[string]any{
						"nodes": []map[string]any{
							{
								"databaseId":              7007,
								"number":                  7,
								"title":                   "Fix parser panic",
								"state":                   "MERGED",
								"isDraft":                 false,
								"merged":                  true,
								"mergedAt":                "2026-05-01T12:00:00Z",
								"createdAt":               "2026-04-30T12:00:00Z",
								"updatedAt":               "2026-05-01T12:01:00Z",
								"closedAt":                "2026-05-01T12:00:00Z",
								"changedFilesIfAvailable": 3,
								"additions":               40,
								"deletions":               5,
								"commits":                 map[string]any{"totalCount": 2},
								"author":                  map[string]any{"login": "alice"},
								"baseRefName":             "main",
								"headRefName":             "fix-parser",
								"labels":                  map[string]any{"nodes": []map[string]any{{"name": "bug", "color": "d73a4a", "description": "Something is not working", "isDefault": true}}},
								"reviews": map[string]any{
									"nodes": []map[string]any{
										{
											"databaseId":        701,
											"state":             "APPROVED",
											"submittedAt":       "2026-05-01T11:30:00Z",
											"body":              "Looks good",
											"author":            map[string]any{"login": "bob"},
											"authorAssociation": "MEMBER",
										},
									},
								},
							},
						},
					},
				},
			},
		})
	}))
	defer graphqlServer.Close()

	restClient, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          restServer.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       restServer.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			GraphQLURL:       graphqlServer.URL,
			APIVersion:       "2026-03-10",
			UserAgent:        "GitRank/test",
			RequestTimeout:   time.Second,
			MaxPageSize:      50,
			GraphQLPageSize:  20,
			SecondaryBackoff: time.Millisecond,
			MaxConcurrency:   1,
		},
	}, nil, restClient)
	executor.graphqlTokenSource = func(context.Context, SyncRequestActor, time.Time) (githubapi.TokenSource, bool, error) {
		return githubapi.StaticTokenSource("user-token"), true, nil
	}
	executor.graphqlClientFactory = func(tokenSource githubapi.TokenSource) (*githubapi.GraphQLClient, error) {
		return githubapi.NewGraphQLClient(githubapi.ClientConfig{
			BaseURL:          graphqlServer.URL,
			APIVersion:       "2026-03-10",
			UserAgent:        "GitRank/test",
			TokenSource:      tokenSource,
			HTTPClient:       graphqlServer.Client(),
			SecondaryBackoff: time.Millisecond,
			MaxConcurrency:   1,
		})
	}

	pullRequests, reviewsByNumber, err := executor.fetchPullRequests(context.Background(), "octo", "repo", SyncRequestActor{GitHubLogin: "alice"})
	if err != nil {
		t.Fatalf("fetchPullRequests() error = %v", err)
	}
	if restRequests["/repos/octo/repo/pulls"] != 1 {
		t.Fatalf("REST list requests = %d, want 1", restRequests["/repos/octo/repo/pulls"])
	}
	if graphqlRequests != 1 {
		t.Fatalf("GraphQL requests = %d, want 1", graphqlRequests)
	}
	if len(pullRequests) != 1 {
		t.Fatalf("pullRequests len = %d, want 1", len(pullRequests))
	}
	pr := pullRequests[0]
	if intValue(pr["changed_files"]) != 3 || intValue(pr["commits"]) != 2 {
		t.Fatalf("batched PR metrics = changed_files %v commits %v, want 3/2", pr["changed_files"], pr["commits"])
	}
	if state := stringValue(pr["state"]); state != "closed" {
		t.Fatalf("state = %q, want REST-compatible closed", state)
	}
	if userID := intValue(object(pr["user"])["id"]); userID != 1001 {
		t.Fatalf("merged user id = %d, want REST summary user id", userID)
	}
	if labels := objectArray(pr["labels"]); len(labels) != 1 || intValue(labels[0]["id"]) != 9901 {
		t.Fatalf("merged labels = %#v, want REST summary label with numeric GitHub ID", labels)
	}
	reviews := reviewsByNumber[7]
	if len(reviews) != 1 {
		t.Fatalf("reviews len = %d, want 1", len(reviews))
	}
	if int64Value(reviews[0]["id"]) != 701 || stringValue(object(reviews[0]["user"])["login"]) != "bob" {
		t.Fatalf("review = %#v, want GraphQL review mapped to REST shape", reviews[0])
	}
}
