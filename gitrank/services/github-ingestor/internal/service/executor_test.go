package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/authkit"
	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/githubapi"
)

func TestGitHubStatusCodeFromError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		err      error
		wantCode int
		wantOK   bool
	}{
		{
			name:     "extracts status code from github rest error",
			err:      errors.New("GitHub API GET https://api.github.com/repos/octo/repo/commits failed with status 403"),
			wantCode: 403,
			wantOK:   true,
		},
		{
			name:   "missing status code",
			err:    errors.New("dial tcp timeout"),
			wantOK: false,
		},
		{
			name:   "nil error",
			err:    nil,
			wantOK: false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			gotCode, gotOK := gitHubStatusCodeFromError(test.err)
			if gotOK != test.wantOK {
				t.Fatalf("gitHubStatusCodeFromError() ok = %v, want %v", gotOK, test.wantOK)
			}
			if gotCode != test.wantCode {
				t.Fatalf("gitHubStatusCodeFromError() code = %d, want %d", gotCode, test.wantCode)
			}
		})
	}
}

func TestIsSkippableGitHubSyncError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "forbidden errors are skippable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo/commits failed with status 403"),
			want: true,
		},
		{
			name: "not found errors are skippable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo failed with status 404"),
			want: true,
		},
		{
			name: "conflict errors are skippable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo/commits failed with status 409"),
			want: true,
		},
		{
			name: "secondary rate-limit errors are not skippable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo/commits failed with status 429"),
			want: false,
		},
		{
			name: "context deadline exceeded errors are skippable",
			err:  context.DeadlineExceeded,
			want: true,
		},
		{
			name: "context canceled errors are skippable",
			err:  context.Canceled,
			want: true,
		},
		{
			name: "client timeout errors are skippable",
			err:  errors.New("Get \"https://api.github.com/repos/llvm/llvm-project/pulls/182707/reviews?per_page=20\": context deadline exceeded (Client.Timeout exceeded while awaiting headers)"),
			want: true,
		},
		{
			name: "non-github errors are not skippable",
			err:  errors.New("database is unavailable"),
			want: false,
		},
		{
			name: "nil error is not skippable",
			err:  nil,
			want: false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := isSkippableGitHubSyncError(test.err); got != test.want {
				t.Fatalf("isSkippableGitHubSyncError() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestIsRecoverableUserSyncSelectionError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "timeout errors are recoverable",
			err:  context.DeadlineExceeded,
			want: true,
		},
		{
			name: "not found errors are recoverable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo failed with status 404"),
			want: true,
		},
		{
			name: "rate limit errors are recoverable for user selection",
			err:  errors.New("GitHub API GET https://api.github.com/search/issues failed with status 429"),
			want: true,
		},
		{
			name: "server errors are recoverable for user selection",
			err:  errors.New("GitHub API GET https://api.github.com/search/issues failed with status 502"),
			want: true,
		},
		{
			name: "non-github errors are not recoverable",
			err:  errors.New("database is unavailable"),
			want: false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := isRecoverableUserSyncSelectionError(test.err); got != test.want {
				t.Fatalf("isRecoverableUserSyncSelectionError() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestBoundedUserPRSyncTimeout(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		cfg  config.App
		want time.Duration
	}{
		{
			name: "uses fallback when timeout is missing",
			cfg:  config.App{},
			want: defaultUserPRSyncTimeout,
		},
		{
			name: "uses minimum bound when timeout is too short",
			cfg: config.App{
				GitHub: config.GitHub{RequestTimeout: 5 * time.Second},
			},
			want: minUserPRSyncTimeout,
		},
		{
			name: "uses configured timeout when within bounds",
			cfg: config.App{
				GitHub: config.GitHub{RequestTimeout: 25 * time.Second},
			},
			want: 25 * time.Second,
		},
		{
			name: "uses maximum bound when timeout is too high",
			cfg: config.App{
				GitHub: config.GitHub{RequestTimeout: 90 * time.Second},
			},
			want: maxUserPRSyncTimeout,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := boundedUserPRSyncTimeout(test.cfg); got != test.want {
				t.Fatalf("boundedUserPRSyncTimeout() = %s, want %s", got, test.want)
			}
		})
	}
}

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

func TestExecutorForActorFallsBackOnTokenSourceError(t *testing.T) {
	t.Parallel()

	baseClient := &githubapi.RESTClient{}
	executor := &Executor{
		client: baseClient,
		graphqlTokenSource: func(context.Context, SyncRequestActor, time.Time) (githubapi.TokenSource, bool, error) {
			return nil, false, errors.New("secret could not be decrypted")
		},
		restClientFactory: func(githubapi.TokenSource) (*githubapi.RESTClient, error) {
			return &githubapi.RESTClient{}, nil
		},
	}

	runtime, err := executor.executorForActor(context.Background(), SyncRequestActor{GitHubLogin: "octocat"}, time.Now().UTC())
	if err != nil {
		t.Fatalf("executorForActor() error = %v", err)
	}
	if runtime != executor {
		t.Fatalf("executorForActor() runtime = %p, want fallback executor %p", runtime, executor)
	}
}

func TestExecutorForActorFallsBackOnRestClientFactoryError(t *testing.T) {
	t.Parallel()

	baseClient := &githubapi.RESTClient{}
	executor := &Executor{
		client: baseClient,
		graphqlTokenSource: func(context.Context, SyncRequestActor, time.Time) (githubapi.TokenSource, bool, error) {
			return githubapi.StaticTokenSource("ghu_test_token"), true, nil
		},
		restClientFactory: func(githubapi.TokenSource) (*githubapi.RESTClient, error) {
			return nil, errors.New("rest client factory failed")
		},
	}

	runtime, err := executor.executorForActor(context.Background(), SyncRequestActor{GitHubLogin: "octocat"}, time.Now().UTC())
	if err != nil {
		t.Fatalf("executorForActor() error = %v", err)
	}
	if runtime != executor {
		t.Fatalf("executorForActor() runtime = %p, want fallback executor %p", runtime, executor)
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

func TestExecutorFetchAuthoredPullRequestTargetsUsesGitHubSearch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/search/issues" {
			t.Fatalf("path = %q, want /search/issues", r.URL.Path)
		}
		query := r.URL.Query()
		if got := query.Get("q"); got != "author:alice type:pr archived:false" {
			t.Fatalf("q = %q, want authored PR search", got)
		}
		if query.Get("sort") != "updated" || query.Get("order") != "desc" {
			t.Fatalf("sort/order = %q/%q, want updated/desc", query.Get("sort"), query.Get("order"))
		}
		if query.Get("per_page") != "9" {
			t.Fatalf("per_page = %q, want 9", query.Get("per_page"))
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"total_count":        5,
			"incomplete_results": true,
			"items": []map[string]any{
				{
					"number": 12,
					"pull_request": map[string]any{
						"url": "https://api.github.com/repos/octo/external/pulls/12",
					},
					"repository": map[string]any{
						"full_name": "octo/external",
						"private":   false,
					},
				},
				{
					"number":         12,
					"repository_url": "https://api.github.com/repos/octo/external",
					"pull_request": map[string]any{
						"url": "https://api.github.com/repos/octo/external/pulls/12",
					},
				},
				{
					"number":         7,
					"repository_url": "https://api.github.com/repos/team/utility",
					"pull_request": map[string]any{
						"url": "https://api.github.com/repos/team/utility/pulls/7",
					},
				},
				{
					"number":         55,
					"repository_url": "https://api.github.com/repos/team/issue-only",
				},
				{
					"number": 8,
					"pull_request": map[string]any{
						"url": "https://api.github.com/repos/private/repo/pulls/8",
					},
					"repository": map[string]any{
						"full_name": "private/repo",
						"private":   true,
					},
				},
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
			MaxPageSize: 9,
		},
	}, nil, client)

	targets, incomplete, err := executor.fetchAuthoredPullRequestTargets(context.Background(), "alice")
	if err != nil {
		t.Fatalf("fetchAuthoredPullRequestTargets() error = %v", err)
	}
	if !incomplete {
		t.Fatal("incomplete = false, want GitHub search incompleteness surfaced")
	}
	if len(targets) != 2 {
		t.Fatalf("targets len = %d, want 2 after dedupe and filtering: %+v", len(targets), targets)
	}
	if targets[0] != (authoredPullRequestTarget{Repository: "octo/external", Number: 12}) {
		t.Fatalf("first target = %+v, want octo/external#12", targets[0])
	}
	if targets[1] != (authoredPullRequestTarget{Repository: "team/utility", Number: 7}) {
		t.Fatalf("second target = %+v, want team/utility#7", targets[1])
	}
}

func TestExecutorFetchLiveInstallationRepositoryTargetsUsesPaginationAndFilters(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/installation/repositories" {
			t.Fatalf("path = %q, want /installation/repositories", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer install-token" {
			t.Fatalf("Authorization = %q, want installation token", r.Header.Get("Authorization"))
		}
		if r.URL.Query().Get("per_page") != "3" {
			t.Fatalf("per_page = %q, want 3", r.URL.Query().Get("per_page"))
		}

		requests++
		page := r.URL.Query().Get("page")
		w.Header().Set("Content-Type", "application/json")
		switch page {
		case "1":
			w.Header().Set("Link", `<https://api.github.test/installation/repositories?page=2>; rel="next"`)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"total_count": 6,
				"repositories": []map[string]any{
					{"full_name": "octo/repo-one", "private": false, "archived": false, "disabled": false},
					{"full_name": "octo/private-repo", "private": true, "archived": false, "disabled": false},
					{"full_name": "octo/archived-repo", "private": false, "archived": true, "disabled": false},
				},
			})
		case "2":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"total_count": 6,
				"repositories": []map[string]any{
					{"full_name": "octo/repo-one", "private": false, "archived": false, "disabled": false},
					{"full_name": "octo/repo-two", "private": false, "archived": false, "disabled": false},
					{"full_name": "invalid", "private": false, "archived": false, "disabled": false},
				},
			})
		default:
			t.Fatalf("unexpected page %q", page)
		}
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		TokenSource:      githubapi.StaticTokenSource("install-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize: 3,
		},
	}, nil, client)

	repositories, incomplete, err := executor.fetchLiveInstallationRepositoryTargets(context.Background(), client)
	if err != nil {
		t.Fatalf("fetchLiveInstallationRepositoryTargets() error = %v", err)
	}
	if incomplete {
		t.Fatal("incomplete = true, want false after terminal page without next link")
	}
	if requests != 2 {
		t.Fatalf("requests = %d, want 2 pages", requests)
	}
	if len(repositories) != 2 {
		t.Fatalf("repositories len = %d, want 2 filtered entries", len(repositories))
	}
	if repositories[0] != "octo/repo-one" || repositories[1] != "octo/repo-two" {
		t.Fatalf("repositories = %#v, want octo/repo-one and octo/repo-two", repositories)
	}
}

func TestExecutorFetchLiveInstallationRepositoryTargetsCapsPageDepth(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Link", `<https://api.github.test/installation/repositories?page=999>; rel="next"`)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"total_count": 999,
			"repositories": []map[string]any{
				{"full_name": "octo/repo", "private": false, "archived": false, "disabled": false},
			},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		TokenSource:      githubapi.StaticTokenSource("install-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{}, nil, client)

	repositories, incomplete, err := executor.fetchLiveInstallationRepositoryTargets(context.Background(), client)
	if err != nil {
		t.Fatalf("fetchLiveInstallationRepositoryTargets() error = %v", err)
	}
	if !incomplete {
		t.Fatal("incomplete = false, want true when max page depth is reached")
	}
	if requests != defaultInstallationRepositoryMaxPages {
		t.Fatalf("requests = %d, want capped %d", requests, defaultInstallationRepositoryMaxPages)
	}
	if len(repositories) != 1 {
		t.Fatalf("repositories len = %d, want deduped single repository", len(repositories))
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

func TestDerivePullRequestFileFeaturesUsesBoundedPatchEvidence(t *testing.T) {
	rawPatch := strings.Join([]string{
		"@@ -1,2 +1,3 @@",
		" context",
		"-old",
		"+new",
		"+added",
	}, "\n")
	file := map[string]any{
		"filename":  "services/auth/session_test.go",
		"status":    "modified",
		"additions": 2,
		"deletions": 1,
		"changes":   3,
		"patch":     rawPatch,
	}

	features := derivePullRequestFileFeatures(file, pullRequestFilePath(file), rawPatch, rawPatch)

	if features["file_type"] != "test" {
		t.Fatalf("file_type = %v, want test", features["file_type"])
	}
	if features["path_extension"] != ".go" {
		t.Fatalf("path_extension = %v, want .go", features["path_extension"])
	}
	if features["patch_hunks"] != 1 || features["patch_added_lines"] != 2 || features["patch_removed_lines"] != 1 {
		t.Fatalf("patch stats = %+v, want 1 hunk, 2 added, 1 removed", features)
	}
	if features["patch_truncated"] != false || features["binary_or_large_patch"] != false {
		t.Fatalf("patch bounds flags = %+v, want not truncated and not binary", features)
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
		if r.URL.Query().Get("per_page") != "10" {
			t.Fatalf("per_page = %q, want GraphQL-bounded page size 10", r.URL.Query().Get("per_page"))
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
		if variables["first"] != float64(1) || variables["reviewsFirst"] != float64(10) {
			t.Fatalf("variables first/reviewsFirst = %v/%v, want 1/10", variables["first"], variables["reviewsFirst"])
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"repository": map[string]any{
					"pullRequests": map[string]any{
						"nodes": []map[string]any{
							{
								"databaseId":   7007,
								"number":       7,
								"title":        "Fix parser panic",
								"state":        "MERGED",
								"isDraft":      false,
								"merged":       true,
								"mergedAt":     "2026-05-01T12:00:00Z",
								"createdAt":    "2026-04-30T12:00:00Z",
								"updatedAt":    "2026-05-01T12:01:00Z",
								"closedAt":     "2026-05-01T12:00:00Z",
								"changedFiles": 3,
								"additions":    40,
								"deletions":    5,
								"commits":      map[string]any{"totalCount": 2},
								"author":       map[string]any{"login": "alice"},
								"baseRefName":  "main",
								"headRefName":  "fix-parser",
								"labels":       map[string]any{"nodes": []map[string]any{{"name": "bug", "color": "d73a4a", "description": "Something is not working", "isDefault": true}}},
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

func TestExecutorFetchPullRequestsFallsBackToRESTWhenGraphQLFails(t *testing.T) {
	t.Parallel()

	restRequests := map[string]int{}
	restServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		restRequests[r.URL.Path]++
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/repos/octo/repo/pulls":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"number": 7},
			})
		case "/repos/octo/repo/pulls/7":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            201,
				"number":        7,
				"title":         "fix: graphql fallback",
				"state":         "closed",
				"draft":         false,
				"merged_at":     "2026-05-01T12:00:00Z",
				"created_at":    "2026-04-30T12:00:00Z",
				"updated_at":    "2026-05-01T12:00:00Z",
				"closed_at":     "2026-05-01T12:00:00Z",
				"changed_files": 2,
				"additions":     14,
				"deletions":     4,
				"commits":       1,
				"user": map[string]any{
					"id":    1001,
					"login": "alice",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "fix-graphql-fallback"},
			})
		case "/repos/octo/repo/pulls/7/reviews":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":           701,
					"state":        "COMMENTED",
					"submitted_at": "2026-05-01T11:30:00Z",
					"body":         "fallback review",
					"user": map[string]any{
						"id":    2001,
						"login": "bob",
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer restServer.Close()

	graphqlRequests := 0
	graphqlServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		graphqlRequests++
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"errors": []map[string]any{
				{"message": "Field 'changedFilesIfAvailable' doesn't exist on type 'PullRequest'"},
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
	if graphqlRequests != 1 {
		t.Fatalf("GraphQL requests = %d, want 1", graphqlRequests)
	}
	if restRequests["/repos/octo/repo/pulls/7"] != 1 {
		t.Fatalf("REST details requests = %d, want 1", restRequests["/repos/octo/repo/pulls/7"])
	}
	if len(pullRequests) != 1 {
		t.Fatalf("pullRequests len = %d, want 1", len(pullRequests))
	}
	if intValue(pullRequests[0]["changed_files"]) != 2 {
		t.Fatalf("changed_files = %v, want 2 from REST fallback", pullRequests[0]["changed_files"])
	}
	if len(reviewsByNumber[7]) != 1 {
		t.Fatalf("reviewsByNumber[7] len = %d, want 1", len(reviewsByNumber[7]))
	}
}

func TestExecutorFetchPullRequestsRESTSkipsSkippableReviewErrors(t *testing.T) {
	t.Parallel()

	restRequests := map[string]int{}
	restServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		restRequests[r.URL.Path]++
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/repos/octo/repo/pulls":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"number": 7},
			})
		case "/repos/octo/repo/pulls/7":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            201,
				"number":        7,
				"title":         "fix: keep sync alive",
				"state":         "closed",
				"draft":         false,
				"merged_at":     "2026-05-01T12:00:00Z",
				"created_at":    "2026-04-30T12:00:00Z",
				"updated_at":    "2026-05-01T12:00:00Z",
				"closed_at":     "2026-05-01T12:00:00Z",
				"changed_files": 2,
				"additions":     14,
				"deletions":     4,
				"commits":       1,
				"user": map[string]any{
					"id":    1001,
					"login": "alice",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "fix-sync"},
			})
		case "/repos/octo/repo/pulls/7/reviews":
			http.NotFound(w, r)
		default:
			http.NotFound(w, r)
		}
	}))
	defer restServer.Close()

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
			APIVersion:       "2026-03-10",
			UserAgent:        "GitRank/test",
			RequestTimeout:   time.Second,
			MaxPageSize:      50,
			GraphQLPageSize:  20,
			SecondaryBackoff: time.Millisecond,
			MaxConcurrency:   1,
		},
	}, nil, restClient)
	executor.graphqlTokenSource = nil
	executor.graphqlClientFactory = nil

	pullRequests, reviewsByNumber, err := executor.fetchPullRequests(context.Background(), "octo", "repo", SyncRequestActor{})
	if err != nil {
		t.Fatalf("fetchPullRequests() error = %v", err)
	}
	if restRequests["/repos/octo/repo/pulls/7/reviews"] != 1 {
		t.Fatalf("REST review requests = %d, want 1", restRequests["/repos/octo/repo/pulls/7/reviews"])
	}
	if len(pullRequests) != 1 {
		t.Fatalf("pullRequests len = %d, want 1", len(pullRequests))
	}
	if intValue(pullRequests[0]["number"]) != 7 {
		t.Fatalf("pull request number = %v, want 7", pullRequests[0]["number"])
	}
	reviews, ok := reviewsByNumber[7]
	if !ok {
		t.Fatalf("reviewsByNumber missing key 7")
	}
	if len(reviews) != 0 {
		t.Fatalf("reviewsByNumber[7] len = %d, want 0 after skippable review error", len(reviews))
	}
}

func TestExecutorFetchPullRequestsRESTSkipsSkippablePullRequestDetailErrors(t *testing.T) {
	t.Parallel()

	restRequests := map[string]int{}
	restServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		restRequests[r.URL.Path]++
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/repos/octo/repo/pulls":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"number": 7},
				{"number": 8},
			})
		case "/repos/octo/repo/pulls/7":
			http.NotFound(w, r)
		case "/repos/octo/repo/pulls/8":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            202,
				"number":        8,
				"title":         "feat: keep partial sync",
				"state":         "closed",
				"draft":         false,
				"merged_at":     "2026-05-02T12:00:00Z",
				"created_at":    "2026-05-01T12:00:00Z",
				"updated_at":    "2026-05-02T12:00:00Z",
				"closed_at":     "2026-05-02T12:00:00Z",
				"changed_files": 3,
				"additions":     20,
				"deletions":     5,
				"commits":       2,
				"user": map[string]any{
					"id":    1002,
					"login": "alice",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "keep-sync"},
			})
		case "/repos/octo/repo/pulls/8/reviews":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id": 4001,
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer restServer.Close()

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
			APIVersion:       "2026-03-10",
			UserAgent:        "GitRank/test",
			RequestTimeout:   time.Second,
			MaxPageSize:      50,
			GraphQLPageSize:  20,
			SecondaryBackoff: time.Millisecond,
			MaxConcurrency:   1,
		},
	}, nil, restClient)
	executor.graphqlTokenSource = nil
	executor.graphqlClientFactory = nil

	pullRequests, reviewsByNumber, err := executor.fetchPullRequests(context.Background(), "octo", "repo", SyncRequestActor{})
	if err != nil {
		t.Fatalf("fetchPullRequests() error = %v", err)
	}
	if len(pullRequests) != 1 {
		t.Fatalf("pullRequests len = %d, want 1 after skippable detail error", len(pullRequests))
	}
	if intValue(pullRequests[0]["number"]) != 8 {
		t.Fatalf("pull request number = %v, want 8", pullRequests[0]["number"])
	}
	if restRequests["/repos/octo/repo/pulls/7/reviews"] != 0 {
		t.Fatalf("REST review requests for skipped detail = %d, want 0", restRequests["/repos/octo/repo/pulls/7/reviews"])
	}
	skipped, ok := reviewsByNumber[7]
	if !ok {
		t.Fatalf("reviewsByNumber missing key 7 for skipped detail path")
	}
	if len(skipped) != 0 {
		t.Fatalf("reviewsByNumber[7] len = %d, want 0 for skipped detail path", len(skipped))
	}
	if len(reviewsByNumber[8]) != 1 {
		t.Fatalf("reviewsByNumber[8] len = %d, want 1", len(reviewsByNumber[8]))
	}
}
