package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/githubapi"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestExecutorSyncRepositoryFetchesAndPersistsBoundedRepositoryData(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_INGESTOR_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_INGESTOR_DATABASE_URL is not set")
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/repos/octo/repo":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":                101,
				"name":              "repo",
				"full_name":         "octo/repo",
				"private":           false,
				"fork":              false,
				"language":          "Go",
				"default_branch":    "main",
				"stargazers_count":  25,
				"forks_count":       4,
				"open_issues_count": 3,
				"archived":          false,
				"disabled":          false,
				"owner": map[string]any{
					"login": "octo",
					"type":  "User",
				},
			})
		case "/repos/octo/repo/pulls":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"number": 7},
				{"number": 8},
			})
		case "/repos/octo/repo/pulls/7":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            201,
				"number":        7,
				"title":         "fix: tighten sync replay path",
				"state":         "closed",
				"draft":         false,
				"merged_at":     "2026-05-06T12:00:00Z",
				"created_at":    "2026-05-05T12:00:00Z",
				"updated_at":    "2026-05-06T12:00:00Z",
				"closed_at":     "2026-05-06T12:00:00Z",
				"changed_files": 2,
				"additions":     40,
				"deletions":     8,
				"commits":       2,
				"user": map[string]any{
					"id":    501,
					"login": "octocat",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "feature/sync"},
				"labels": []map[string]any{
					{"id": 601, "name": "bug", "color": "d73a4a", "default": true},
				},
			})
		case "/repos/octo/repo/pulls/8":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            202,
				"number":        8,
				"title":         "feat: add repository sync trace",
				"state":         "open",
				"draft":         false,
				"merged_at":     nil,
				"created_at":    "2026-05-05T16:00:00Z",
				"updated_at":    "2026-05-06T13:00:00Z",
				"closed_at":     nil,
				"changed_files": 1,
				"additions":     18,
				"deletions":     0,
				"commits":       1,
				"user": map[string]any{
					"id":    502,
					"login": "hubot",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "feature/trace"},
				"labels": []map[string]any{
					{"id": 602, "name": "feature", "color": "0e8a16", "default": false},
				},
			})
		case "/repos/octo/repo/pulls/7/reviews":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":           701,
					"state":        "APPROVED",
					"submitted_at": "2026-05-06T12:30:00Z",
					"body":         "Looks good",
					"user": map[string]any{
						"id":    501,
						"login": "octocat",
					},
				},
			})
		case "/repos/octo/repo/pulls/8/reviews":
			_ = json.NewEncoder(w).Encode([]map[string]any{})
		case "/repos/octo/repo/issues":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":         801,
					"number":     3,
					"title":      "Track sync backlog",
					"state":      "open",
					"locked":     false,
					"created_at": "2026-05-05T10:00:00Z",
					"updated_at": "2026-05-06T10:00:00Z",
					"user": map[string]any{
						"id":    501,
						"login": "octocat",
					},
					"labels": []map[string]any{
						{"id": 603, "name": "tracking", "color": "0366d6", "default": false},
					},
				},
				{
					"id":           802,
					"number":       9,
					"title":        "PR mirror should be ignored",
					"state":        "open",
					"pull_request": map[string]any{"url": "https://api.github.test/repos/octo/repo/pulls/9"},
				},
			})
		case "/repos/octo/repo/commits":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"sha": "abc123",
					"commit": map[string]any{
						"message": "seed repository state",
						"author":  map[string]any{"date": "2026-05-06T09:00:00Z"},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   4,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize: 50,
		},
	}, pool, client)
	now := time.Now().UTC()

	result, err := executor.SyncRepository(ctx, contracts.SyncRequest{
		Mode:       "repository",
		Repository: "octo/repo",
	}, SyncRequestActor{
		Subject:     "user-sync-executor",
		GitHubLogin: "octocat",
	}, "sync-executor-1", now)
	if err != nil {
		t.Fatalf("SyncRepository() error = %v", err)
	}

	if result.Status != "completed" {
		t.Fatalf("Status = %q, want completed", result.Status)
	}
	if result.Repository != "octo/repo" {
		t.Fatalf("Repository = %q, want octo/repo", result.Repository)
	}
	if result.Fetched["pull_requests"] != 2 {
		t.Fatalf("Fetched[pull_requests] = %d, want 2", result.Fetched["pull_requests"])
	}
	if result.Persisted["pull_requests"] != 2 {
		t.Fatalf("Persisted[pull_requests] = %d, want 2", result.Persisted["pull_requests"])
	}

	assertCount(t, ctx, pool, "repositories", "SELECT COUNT(*) FROM repositories WHERE github_repository_id = 101", 1)
	assertCount(t, ctx, pool, "pull_requests", "SELECT COUNT(*) FROM pull_requests WHERE github_pull_request_id IN (201, 202)", 2)
	assertCount(t, ctx, pool, "pull_request_reviews", "SELECT COUNT(*) FROM pull_request_reviews WHERE github_review_id = 701", 1)
	assertCount(t, ctx, pool, "repository_issues", "SELECT COUNT(*) FROM repository_issues WHERE github_issue_id = 801", 1)
	assertCount(t, ctx, pool, "repository_commits", "SELECT COUNT(*) FROM repository_commits WHERE sha = 'abc123'", 1)

	var requestedRepository string
	if err := pool.QueryRow(ctx, `
		SELECT requested_repository_full_name
		FROM github_sync_runs
		WHERE correlation_id = 'sync-executor-1'
		ORDER BY started_at DESC
		LIMIT 1
	`).Scan(&requestedRepository); err != nil {
		t.Fatalf("select github_sync_runs.requested_repository_full_name: %v", err)
	}
	if requestedRepository != "octo/repo" {
		t.Fatalf("requested_repository_full_name = %q, want octo/repo", requestedRepository)
	}
}

func TestExecutorSyncUserFetchesRecentOwnedRepositories(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_INGESTOR_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_INGESTOR_DATABASE_URL is not set")
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/users/octocat/repos":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":         301,
					"name":       "repo",
					"full_name":  "octo/repo",
					"private":    false,
					"fork":       false,
					"archived":   false,
					"disabled":   false,
					"updated_at": "2026-05-06T12:00:00Z",
					"owner": map[string]any{
						"login": "octocat",
						"type":  "User",
					},
				},
				{
					"id":         302,
					"name":       "archived-repo",
					"full_name":  "octo/archived-repo",
					"private":    false,
					"fork":       false,
					"archived":   true,
					"disabled":   false,
					"updated_at": "2026-05-05T12:00:00Z",
					"owner": map[string]any{
						"login": "octocat",
						"type":  "User",
					},
				},
			})
		case "/repos/octo/repo":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":                101,
				"name":              "repo",
				"full_name":         "octo/repo",
				"private":           false,
				"fork":              false,
				"language":          "Go",
				"default_branch":    "main",
				"stargazers_count":  25,
				"forks_count":       4,
				"open_issues_count": 3,
				"archived":          false,
				"disabled":          false,
				"owner": map[string]any{
					"login": "octocat",
					"type":  "User",
				},
			})
		case "/repos/octo/repo/pulls":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"number": 7},
			})
		case "/repos/octo/repo/pulls/7":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            201,
				"number":        7,
				"title":         "feat: owned repository sync",
				"state":         "closed",
				"draft":         false,
				"merged_at":     "2026-05-06T12:00:00Z",
				"created_at":    "2026-05-05T12:00:00Z",
				"updated_at":    "2026-05-06T12:00:00Z",
				"closed_at":     "2026-05-06T12:00:00Z",
				"changed_files": 1,
				"additions":     12,
				"deletions":     1,
				"commits":       1,
				"user": map[string]any{
					"id":    501,
					"login": "octocat",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "feature/user-sync"},
				"labels": []map[string]any{
					{"id": 601, "name": "feature", "color": "0e8a16", "default": false},
				},
			})
		case "/repos/octo/repo/pulls/7/reviews":
			_ = json.NewEncoder(w).Encode([]map[string]any{})
		case "/repos/octo/repo/issues":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":         801,
					"number":     3,
					"title":      "Track owned repository sync",
					"state":      "open",
					"locked":     false,
					"created_at": "2026-05-05T10:00:00Z",
					"updated_at": "2026-05-06T10:00:00Z",
					"user": map[string]any{
						"id":    501,
						"login": "octocat",
					},
				},
			})
		case "/repos/octo/repo/commits":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"sha": "abc123",
					"commit": map[string]any{
						"message": "seed owned repository state",
						"author":  map[string]any{"date": "2026-05-06T09:00:00Z"},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   4,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize: 50,
		},
	}, pool, client)
	now := time.Now().UTC()

	result, err := executor.SyncUser(ctx, contracts.SyncRequest{
		Mode: "user",
		User: "octocat",
	}, SyncRequestActor{
		Subject:     "user-sync-executor",
		GitHubLogin: "octocat",
	}, "sync-user-executor-1", now)
	if err != nil {
		t.Fatalf("SyncUser() error = %v", err)
	}

	if result.Status != "completed" {
		t.Fatalf("Status = %q, want completed", result.Status)
	}
	if result.User != "octocat" {
		t.Fatalf("User = %q, want octocat", result.User)
	}
	if result.Fetched["repositories_selected"] != 1 {
		t.Fatalf("Fetched[repositories_selected] = %d, want 1", result.Fetched["repositories_selected"])
	}
	if result.Persisted["repositories"] != 1 {
		t.Fatalf("Persisted[repositories] = %d, want 1", result.Persisted["repositories"])
	}

	var requestedUser string
	if err := pool.QueryRow(ctx, `
		SELECT requested_user_login
		FROM github_sync_runs
		WHERE correlation_id = 'sync-user-executor-1'
		ORDER BY started_at DESC
		LIMIT 1
	`).Scan(&requestedUser); err != nil {
		t.Fatalf("select github_sync_runs.requested_user_login: %v", err)
	}
	if requestedUser != "octocat" {
		t.Fatalf("requested_user_login = %q, want octocat", requestedUser)
	}
}

func TestExecutorSyncInstallationReplaysPersistedInstallationRepositories(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_INGESTOR_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_INGESTOR_DATABASE_URL is not set")
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/repos/octo/repo-one":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":                301,
				"name":              "repo-one",
				"full_name":         "octo/repo-one",
				"private":           false,
				"fork":              false,
				"language":          "Go",
				"default_branch":    "main",
				"stargazers_count":  5,
				"forks_count":       1,
				"open_issues_count": 0,
				"archived":          false,
				"disabled":          false,
				"owner": map[string]any{
					"login": "octo",
					"type":  "Organization",
				},
			})
		case "/repos/octo/repo-two":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":                302,
				"name":              "repo-two",
				"full_name":         "octo/repo-two",
				"private":           false,
				"fork":              false,
				"language":          "TypeScript",
				"default_branch":    "main",
				"stargazers_count":  3,
				"forks_count":       1,
				"open_issues_count": 1,
				"archived":          false,
				"disabled":          false,
				"owner": map[string]any{
					"login": "octo",
					"type":  "Organization",
				},
			})
		case "/repos/octo/repo-one/pulls", "/repos/octo/repo-two/pulls":
			_ = json.NewEncoder(w).Encode([]map[string]any{})
		case "/repos/octo/repo-one/issues", "/repos/octo/repo-two/issues":
			_ = json.NewEncoder(w).Encode([]map[string]any{})
		case "/repos/octo/repo-one/commits", "/repos/octo/repo-two/commits":
			_ = json.NewEncoder(w).Encode([]map[string]any{})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	now := time.Now().UTC()
	persistence := NewStore(pool)
	_, err = persistence.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		_, _, err := tx.UpsertInstallation(map[string]any{
			"installation": map[string]any{
				"id":                   12001,
				"app_id":               0,
				"app_slug":             "",
				"target_type":          "Organization",
				"repository_selection": "selected",
				"account": map[string]any{
					"login": "octo",
					"type":  "Organization",
				},
			},
			"repositories": []map[string]any{
				{
					"id":                301,
					"name":              "repo-one",
					"full_name":         "octo/repo-one",
					"private":           false,
					"fork":              false,
					"language":          "Go",
					"default_branch":    "main",
					"stargazers_count":  5,
					"forks_count":       1,
					"open_issues_count": 0,
					"archived":          false,
					"disabled":          false,
					"owner": map[string]any{
						"login": "octo",
						"type":  "Organization",
					},
				},
				{
					"id":                302,
					"name":              "repo-two",
					"full_name":         "octo/repo-two",
					"private":           false,
					"fork":              false,
					"language":          "TypeScript",
					"default_branch":    "main",
					"stargazers_count":  3,
					"forks_count":       1,
					"open_issues_count": 1,
					"archived":          false,
					"disabled":          false,
					"owner": map[string]any{
						"login": "octo",
						"type":  "Organization",
					},
				},
			},
		}, now)
		return PersistResult{}, err
	})
	if err != nil {
		t.Fatalf("persist installation fixture: %v", err)
	}

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   4,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize: 50,
		},
	}, pool, client)

	result, err := executor.SyncInstallation(ctx, contracts.SyncRequest{
		Mode:           "installation",
		InstallationID: 12001,
	}, SyncRequestActor{
		Subject:     "installation-sync-executor",
		GitHubLogin: "octocat",
	}, "sync-installation-executor-1", now)
	if err != nil {
		t.Fatalf("SyncInstallation() error = %v", err)
	}

	if result.Status != "completed" {
		t.Fatalf("Status = %q, want completed", result.Status)
	}
	if result.Installation != 12001 {
		t.Fatalf("Installation = %d, want 12001", result.Installation)
	}
	if result.Fetched["repositories_selected"] != 2 {
		t.Fatalf("Fetched[repositories_selected] = %d, want 2", result.Fetched["repositories_selected"])
	}
	if result.Persisted["repositories"] != 2 {
		t.Fatalf("Persisted[repositories] = %d, want 2", result.Persisted["repositories"])
	}

	assertCount(t, ctx, pool, "repositories", "SELECT COUNT(*) FROM repositories WHERE github_repository_id IN (301, 302)", 2)

	var requestedInstallation int64
	if err := pool.QueryRow(ctx, `
		SELECT github_installation_id
		FROM github_sync_runs runs
		JOIN github_installations installations ON installations.id = runs.installation_id
		WHERE runs.correlation_id = 'sync-installation-executor-1'
		ORDER BY runs.started_at DESC
		LIMIT 1
	`).Scan(&requestedInstallation); err != nil {
		t.Fatalf("select github_sync_runs installation: %v", err)
	}
	if requestedInstallation != 12001 {
		t.Fatalf("github_installation_id = %d, want 12001", requestedInstallation)
	}
}

func TestExecutorSyncPullRequestFetchesAndPersistsBoundedPullRequestData(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_INGESTOR_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_INGESTOR_DATABASE_URL is not set")
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/repos/octo/repo":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":                101,
				"name":              "repo",
				"full_name":         "octo/repo",
				"private":           false,
				"fork":              false,
				"language":          "Go",
				"default_branch":    "main",
				"stargazers_count":  25,
				"forks_count":       4,
				"open_issues_count": 3,
				"archived":          false,
				"disabled":          false,
				"owner": map[string]any{
					"login": "octo",
					"type":  "User",
				},
			})
		case "/repos/octo/repo/pulls/7":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            201,
				"number":        7,
				"title":         "fix: tighten pr executor",
				"state":         "closed",
				"draft":         false,
				"merged":        true,
				"merged_at":     "2026-05-06T12:00:00Z",
				"created_at":    "2026-05-05T12:00:00Z",
				"updated_at":    "2026-05-06T12:00:00Z",
				"closed_at":     "2026-05-06T12:00:00Z",
				"changed_files": 2,
				"additions":     40,
				"deletions":     8,
				"commits":       2,
				"user": map[string]any{
					"id":    501,
					"login": "octocat",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "feature/pr-exec"},
				"labels": []map[string]any{
					{"id": 601, "name": "bug", "color": "d73a4a", "default": true},
				},
			})
		case "/repos/octo/repo/pulls/7/reviews":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":           701,
					"state":        "APPROVED",
					"submitted_at": "2026-05-06T12:30:00Z",
					"body":         "Looks good",
					"user": map[string]any{
						"id":    501,
						"login": "octocat",
					},
				},
			})
		case "/repos/octo/repo/pulls/7/comments":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":                     901,
					"pull_request_review_id": 701,
					"path":                   "internal/executor.go",
					"position":               12,
					"body":                   "please add coverage",
					"created_at":             "2026-05-06T12:31:00Z",
					"user": map[string]any{
						"id":    501,
						"login": "octocat",
					},
				},
			})
		case "/repos/octo/repo/pulls/7/files":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"filename":  "internal/executor.go",
					"status":    "modified",
					"additions": 30,
					"deletions": 6,
					"changes":   36,
					"patch":     strings.Repeat("+", maxStoredPullRequestFilePatchBytes+50),
					"blob_url":  "https://github.test/octo/repo/blob/abc/internal/executor.go",
					"raw_url":   "https://github.test/octo/repo/raw/abc/internal/executor.go",
					"content":   "full file should not be stored",
					"contents":  "full file should not be stored",
				},
				{
					"filename":          "README.md",
					"previous_filename": "docs/README.md",
					"status":            "renamed",
					"additions":         10,
					"deletions":         2,
					"changes":           12,
					"patch":             "@@ -1 +1 @@\n-old\n+new",
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   4,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize: 50,
		},
	}, pool, client)
	now := time.Now().UTC()

	result, err := executor.SyncPullRequest(ctx, contracts.SyncRequest{
		Mode:       "pull_request",
		Repository: "octo/repo",
		Number:     7,
	}, SyncRequestActor{
		Subject:     "pr-sync-executor",
		GitHubLogin: "octocat",
	}, "sync-pr-executor-1", now)
	if err != nil {
		t.Fatalf("SyncPullRequest() error = %v", err)
	}

	if result.Status != "completed" {
		t.Fatalf("Status = %q, want completed", result.Status)
	}
	if result.Repository != "octo/repo" || result.Number != 7 {
		t.Fatalf("result = %+v, want repo octo/repo number 7", result)
	}
	if result.Fetched["reviews"] != 1 {
		t.Fatalf("Fetched[reviews] = %d, want 1", result.Fetched["reviews"])
	}
	if result.Fetched["review_comments"] != 1 {
		t.Fatalf("Fetched[review_comments] = %d, want 1", result.Fetched["review_comments"])
	}
	if result.Fetched["pull_request_files"] != 2 {
		t.Fatalf("Fetched[pull_request_files] = %d, want 2", result.Fetched["pull_request_files"])
	}
	if result.Persisted["pull_requests"] != 1 {
		t.Fatalf("Persisted[pull_requests] = %d, want 1", result.Persisted["pull_requests"])
	}
	if result.Persisted["pull_request_files"] != 2 {
		t.Fatalf("Persisted[pull_request_files] = %d, want 2", result.Persisted["pull_request_files"])
	}

	assertCount(t, ctx, pool, "pull_requests", "SELECT COUNT(*) FROM pull_requests WHERE github_pull_request_id = 201", 1)
	assertCount(t, ctx, pool, "pull_request_files", "SELECT COUNT(*) FROM pull_request_files WHERE pull_request_id = (SELECT id FROM pull_requests WHERE github_pull_request_id = 201)", 2)
	assertCount(t, ctx, pool, "pull_request_reviews", "SELECT COUNT(*) FROM pull_request_reviews WHERE github_review_id = 701", 1)
	assertCount(t, ctx, pool, "pull_request_review_comments", "SELECT COUNT(*) FROM pull_request_review_comments WHERE github_review_comment_id = 901", 1)

	var patchLength int
	var hasContent bool
	var hasContents bool
	if err := pool.QueryRow(ctx, `
		SELECT length(patch), payload_jsonb ? 'content', payload_jsonb ? 'contents'
		FROM pull_request_files
		WHERE path = 'internal/executor.go'
		LIMIT 1
	`).Scan(&patchLength, &hasContent, &hasContents); err != nil {
		t.Fatalf("select pull_request_files bounded payload: %v", err)
	}
	if patchLength != maxStoredPullRequestFilePatchBytes {
		t.Fatalf("stored patch length = %d, want %d", patchLength, maxStoredPullRequestFilePatchBytes)
	}
	if hasContent || hasContents {
		t.Fatalf("sanitized payload retained content fields: content=%v contents=%v", hasContent, hasContents)
	}
}

func TestExecutorSyncReviewFetchesAndPersistsBoundedReviewSurface(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_INGESTOR_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_INGESTOR_DATABASE_URL is not set")
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/repos/octo/repo":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":                101,
				"name":              "repo",
				"full_name":         "octo/repo",
				"private":           false,
				"fork":              false,
				"language":          "Go",
				"default_branch":    "main",
				"stargazers_count":  25,
				"forks_count":       4,
				"open_issues_count": 3,
				"archived":          false,
				"disabled":          false,
				"owner": map[string]any{
					"login": "octo",
					"type":  "User",
				},
			})
		case "/repos/octo/repo/pulls/7":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            201,
				"number":        7,
				"title":         "fix: tighten review executor",
				"state":         "closed",
				"draft":         false,
				"merged":        true,
				"merged_at":     "2026-05-06T12:00:00Z",
				"created_at":    "2026-05-05T12:00:00Z",
				"updated_at":    "2026-05-06T12:00:00Z",
				"closed_at":     "2026-05-06T12:00:00Z",
				"changed_files": 2,
				"additions":     40,
				"deletions":     8,
				"commits":       2,
				"user": map[string]any{
					"id":    501,
					"login": "octocat",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "feature/review-exec"},
				"labels": []map[string]any{
					{"id": 601, "name": "bug", "color": "d73a4a", "default": true},
				},
			})
		case "/repos/octo/repo/pulls/7/reviews":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":           701,
					"state":        "APPROVED",
					"submitted_at": "2026-05-06T12:30:00Z",
					"body":         "Looks good",
					"user": map[string]any{
						"id":    501,
						"login": "octocat",
					},
				},
			})
		case "/repos/octo/repo/pulls/7/comments":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":                     901,
					"pull_request_review_id": 701,
					"path":                   "internal/executor.go",
					"position":               12,
					"body":                   "please add coverage",
					"created_at":             "2026-05-06T12:31:00Z",
					"user": map[string]any{
						"id":    501,
						"login": "octocat",
					},
				},
			})
		case "/repos/octo/repo/pulls/7/files":
			_ = json.NewEncoder(w).Encode([]map[string]any{})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   4,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize: 50,
		},
	}, pool, client)
	now := time.Now().UTC()

	result, err := executor.SyncReview(ctx, contracts.SyncRequest{
		Mode:       "review",
		Repository: "octo/repo",
		Number:     7,
	}, SyncRequestActor{
		Subject:     "review-sync-executor",
		GitHubLogin: "octocat",
	}, "sync-review-executor-1", now)
	if err != nil {
		t.Fatalf("SyncReview() error = %v", err)
	}

	if result.Status != "completed" {
		t.Fatalf("Status = %q, want completed", result.Status)
	}
	if result.Mode != "review" || result.Repository != "octo/repo" || result.Number != 7 {
		t.Fatalf("result = %+v, want review mode repo octo/repo number 7", result)
	}
	if result.Fetched["reviews"] != 1 {
		t.Fatalf("Fetched[reviews] = %d, want 1", result.Fetched["reviews"])
	}
	if result.Fetched["review_comments"] != 1 {
		t.Fatalf("Fetched[review_comments] = %d, want 1", result.Fetched["review_comments"])
	}

	assertCount(t, ctx, pool, "pull_request_reviews", "SELECT COUNT(*) FROM pull_request_reviews WHERE github_review_id = 701", 1)
	assertCount(t, ctx, pool, "pull_request_review_comments", "SELECT COUNT(*) FROM pull_request_review_comments WHERE github_review_comment_id = 901", 1)
}

func TestExecutorSyncIssueFetchesAndPersistsBoundedIssueData(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_INGESTOR_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_INGESTOR_DATABASE_URL is not set")
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/repos/octo/repo":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":                101,
				"name":              "repo",
				"full_name":         "octo/repo",
				"private":           false,
				"fork":              false,
				"language":          "Go",
				"default_branch":    "main",
				"stargazers_count":  25,
				"forks_count":       4,
				"open_issues_count": 3,
				"archived":          false,
				"disabled":          false,
				"owner": map[string]any{
					"login": "octo",
					"type":  "User",
				},
			})
		case "/repos/octo/repo/issues/3":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":         801,
				"number":     3,
				"title":      "Track sync backlog",
				"state":      "open",
				"locked":     false,
				"created_at": "2026-05-05T10:00:00Z",
				"updated_at": "2026-05-06T10:00:00Z",
				"user": map[string]any{
					"id":    501,
					"login": "octocat",
				},
				"labels": []map[string]any{
					{"id": 603, "name": "tracking", "color": "0366d6", "default": false},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   4,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize: 50,
		},
	}, pool, client)
	now := time.Now().UTC()

	result, err := executor.SyncIssue(ctx, contracts.SyncRequest{
		Mode:       "issue",
		Repository: "octo/repo",
		Number:     3,
	}, SyncRequestActor{
		Subject:     "issue-sync-executor",
		GitHubLogin: "octocat",
	}, "sync-issue-executor-1", now)
	if err != nil {
		t.Fatalf("SyncIssue() error = %v", err)
	}

	if result.Status != "completed" {
		t.Fatalf("Status = %q, want completed", result.Status)
	}
	if result.Repository != "octo/repo" || result.Number != 3 {
		t.Fatalf("result = %+v, want repo octo/repo number 3", result)
	}
	if result.Fetched["issues"] != 1 {
		t.Fatalf("Fetched[issues] = %d, want 1", result.Fetched["issues"])
	}
	if result.Persisted["issues"] != 1 {
		t.Fatalf("Persisted[issues] = %d, want 1", result.Persisted["issues"])
	}

	assertCount(t, ctx, pool, "repository_issues", "SELECT COUNT(*) FROM repository_issues WHERE github_issue_id = 801", 1)

	var requestedRepository string
	if err := pool.QueryRow(ctx, `
		SELECT requested_repository_full_name
		FROM github_sync_runs
		WHERE correlation_id = 'sync-issue-executor-1'
		ORDER BY started_at DESC
		LIMIT 1
	`).Scan(&requestedRepository); err != nil {
		t.Fatalf("select github_sync_runs.requested_repository_full_name: %v", err)
	}
	if requestedRepository != "octo/repo" {
		t.Fatalf("requested_repository_full_name = %q, want octo/repo", requestedRepository)
	}
}

func TestExecutorSyncCommitFetchesAndPersistsBoundedCommitData(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_INGESTOR_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_INGESTOR_DATABASE_URL is not set")
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/repos/octo/repo":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":                101,
				"name":              "repo",
				"full_name":         "octo/repo",
				"private":           false,
				"fork":              false,
				"language":          "Go",
				"default_branch":    "main",
				"stargazers_count":  25,
				"forks_count":       4,
				"open_issues_count": 3,
				"archived":          false,
				"disabled":          false,
				"owner": map[string]any{
					"login": "octo",
					"type":  "User",
				},
			})
		case "/repos/octo/repo/commits/abc123":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"sha": "abc123",
				"commit": map[string]any{
					"message": "seed repository state",
					"author":  map[string]any{"date": "2026-05-06T09:00:00Z"},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   4,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize: 50,
		},
	}, pool, client)
	now := time.Now().UTC()

	result, err := executor.SyncCommit(ctx, contracts.SyncRequest{
		Mode:       "commit",
		Repository: "octo/repo",
		SHA:        "abc123",
	}, SyncRequestActor{
		Subject:     "commit-sync-executor",
		GitHubLogin: "octocat",
	}, "sync-commit-executor-1", now)
	if err != nil {
		t.Fatalf("SyncCommit() error = %v", err)
	}

	if result.Status != "completed" {
		t.Fatalf("Status = %q, want completed", result.Status)
	}
	if result.Repository != "octo/repo" || result.SHA != "abc123" {
		t.Fatalf("result = %+v, want repo octo/repo sha abc123", result)
	}
	if result.Fetched["commits"] != 1 {
		t.Fatalf("Fetched[commits] = %d, want 1", result.Fetched["commits"])
	}
	if result.Persisted["commits"] != 1 {
		t.Fatalf("Persisted[commits] = %d, want 1", result.Persisted["commits"])
	}

	assertCount(t, ctx, pool, "repository_commits", "SELECT COUNT(*) FROM repository_commits WHERE sha = 'abc123'", 1)

	var requestedRepository string
	if err := pool.QueryRow(ctx, `
		SELECT requested_repository_full_name
		FROM github_sync_runs
		WHERE correlation_id = 'sync-commit-executor-1'
		ORDER BY started_at DESC
		LIMIT 1
	`).Scan(&requestedRepository); err != nil {
		t.Fatalf("select github_sync_runs.requested_repository_full_name: %v", err)
	}
	if requestedRepository != "octo/repo" {
		t.Fatalf("requested_repository_full_name = %q, want octo/repo", requestedRepository)
	}
}
