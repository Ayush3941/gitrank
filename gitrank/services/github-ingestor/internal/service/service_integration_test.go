package service

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/githubapi"
	"github.com/gitrank/gitrank/packages/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPersistWebhookNormalizesEntitiesIdempotently(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_INGESTOR_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_INGESTOR_DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	svc := New(pool)
	now := time.Now().UTC()
	suffix := now.UnixNano()

	var userID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO users (display_name, avatar_url, profile_visibility)
		VALUES ($1, $2, 'private')
		RETURNING id::text
	`, fmt.Sprintf("Ingestor User %d", suffix), "https://avatars.example.test/u/77").Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	var accountID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO github_accounts (
			user_id,
			github_user_id,
			login,
			node_id,
			access_mode,
			oauth_scopes,
			email,
			avatar_url,
			display_name,
			user_type,
			site_admin,
			linked_at,
			link_status,
			created_at,
			updated_at
		) VALUES (
			$1::uuid, $2, $3, $4, 'oauth', ARRAY['read:user']::text[], '', $5, $6, 'User', false, $7, 'linked', $7, $7
		)
		RETURNING id::text
	`, userID, 910000+suffix%100000, fmt.Sprintf("ingestor-%d", suffix), fmt.Sprintf("node-%d", suffix), "https://avatars.example.test/u/77", "Ingestor User", now).Scan(&accountID); err != nil {
		t.Fatalf("insert github account: %v", err)
	}

	repositoryFullName := fmt.Sprintf("owner-%d/ingestor-repo", suffix)
	authorGitHubID := int64(910000 + suffix%100000)
	prPayload := []byte(fmt.Sprintf(`{
		"action":"closed",
		"number":17,
		"installation":{"id":12001,"repository_selection":"selected","account":{"login":"owner-%d","type":"Organization"}},
		"repository":{"id":22001,"name":"ingestor-repo","full_name":"%s","private":false,"fork":false,"language":"Go","default_branch":"main","stargazers_count":91,"forks_count":12,"open_issues_count":3,"archived":false,"disabled":false,"owner":{"login":"owner-%d","type":"Organization"}},
		"pull_request":{
			"id":33001,
			"number":17,
			"title":"Persist webhook-backed PR data",
			"state":"closed",
			"draft":false,
			"merged":true,
			"merged_at":"2026-05-06T12:00:00Z",
			"created_at":"2026-05-05T12:00:00Z",
			"updated_at":"2026-05-06T12:00:00Z",
			"closed_at":"2026-05-06T12:00:00Z",
			"base":{"ref":"main"},
			"head":{"ref":"feature/persist","sha":"abc123"},
			"changed_files":3,
			"additions":120,
			"deletions":25,
			"commits":2,
			"user":{"id":%d,"login":"ingestor-%d"},
			"labels":[
				{"id":44001,"name":"bug","color":"d73a4a","description":"Bug fix","default":true}
			]
		}
	}`, suffix, repositoryFullName, suffix, authorGitHubID, suffix))

	envelope := githubapi.WebhookEnvelope{
		DeliveryID:   fmt.Sprintf("delivery-pr-%d", suffix),
		EventType:    "pull_request",
		Repository:   repositoryFullName,
		RepositoryID: 22001,
		Installation: 12001,
		Number:       17,
		CommitSHA:    "abc123",
		Payload:      prPayload,
	}

	if _, err := svc.PersistWebhook(ctx, envelope, "req-pr", now); err != nil {
		t.Fatalf("PersistWebhook(pull_request) error = %v", err)
	}
	if _, err := svc.PersistWebhook(ctx, envelope, "req-pr-repeat", now.Add(time.Minute)); err != nil {
		t.Fatalf("PersistWebhook(repeated pull_request) error = %v", err)
	}

	reviewPayload := []byte(fmt.Sprintf(`{
		"action":"created",
		"number":17,
		"installation":{"id":12001},
		"repository":{"id":22001,"name":"ingestor-repo","full_name":"%s","owner":{"login":"owner-%d"}},
		"pull_request":{"id":33001,"number":17,"title":"Persist webhook-backed PR data","state":"closed","merged":true,"draft":false,"created_at":"2026-05-05T12:00:00Z","updated_at":"2026-05-06T12:00:00Z","base":{"ref":"main"},"head":{"ref":"feature/persist"},"user":{"id":%d,"login":"ingestor-%d"}},
		"review":{"id":55001,"state":"commented","submitted_at":"2026-05-06T12:30:00Z","body":"Looks good","user":{"id":%d,"login":"ingestor-%d"}},
		"comment":{"id":66001,"pull_request_review_id":55001,"path":"internal/httpapi/router.go","position":42,"body":"Looks good","created_at":"2026-05-06T12:31:00Z","user":{"id":%d,"login":"ingestor-%d"}}
	}`, repositoryFullName, suffix, authorGitHubID, suffix, authorGitHubID, suffix, authorGitHubID, suffix))

	if _, err := svc.PersistWebhook(ctx, githubapi.WebhookEnvelope{
		DeliveryID:   fmt.Sprintf("delivery-review-%d", suffix),
		EventType:    "pull_request_review_comment",
		Repository:   repositoryFullName,
		RepositoryID: 22001,
		Installation: 12001,
		Number:       17,
		Payload:      reviewPayload,
	}, "req-review", now.Add(2*time.Minute)); err != nil {
		t.Fatalf("PersistWebhook(pull_request_review_comment) error = %v", err)
	}

	issuePayload := []byte(fmt.Sprintf(`{
		"action":"opened",
		"installation":{"id":12001},
		"repository":{"id":22001,"name":"ingestor-repo","full_name":"%s","owner":{"login":"owner-%d"}},
		"issue":{
			"id":77001,
			"number":4,
			"title":"Track ingestion follow-up",
			"state":"open",
			"locked":false,
			"created_at":"2026-05-06T13:00:00Z",
			"updated_at":"2026-05-06T13:00:00Z",
			"user":{"id":%d,"login":"ingestor-%d"},
			"labels":[
				{"id":44001,"name":"bug","color":"d73a4a","description":"Bug fix","default":true},
				{"id":44002,"name":"tracking","color":"0366d6","description":"Tracking","default":false}
			]
		}
	}`, repositoryFullName, suffix, authorGitHubID, suffix))

	if _, err := svc.PersistWebhook(ctx, githubapi.WebhookEnvelope{
		DeliveryID:   fmt.Sprintf("delivery-issue-%d", suffix),
		EventType:    "issues",
		Repository:   repositoryFullName,
		RepositoryID: 22001,
		Installation: 12001,
		Number:       4,
		Payload:      issuePayload,
	}, "req-issue", now.Add(3*time.Minute)); err != nil {
		t.Fatalf("PersistWebhook(issues) error = %v", err)
	}

	pushPayload := []byte(fmt.Sprintf(`{
		"ref":"refs/heads/main",
		"after":"def456",
		"installation":{"id":12001},
		"repository":{"id":22001,"name":"ingestor-repo","full_name":"%s","owner":{"login":"owner-%d"}},
		"commits":[
			{"id":"abc123","message":"first commit","timestamp":"2026-05-06T13:10:00Z"},
			{"id":"def456","message":"second commit","timestamp":"2026-05-06T13:11:00Z"}
		]
	}`, repositoryFullName, suffix))

	if _, err := svc.PersistWebhook(ctx, githubapi.WebhookEnvelope{
		DeliveryID:   fmt.Sprintf("delivery-push-%d", suffix),
		EventType:    "push",
		Repository:   repositoryFullName,
		RepositoryID: 22001,
		Installation: 12001,
		CommitSHA:    "def456",
		Payload:      pushPayload,
	}, "req-push", now.Add(4*time.Minute)); err != nil {
		t.Fatalf("PersistWebhook(push) error = %v", err)
	}

	queuedJobs, err := store.BuildSyncJobs(contracts.SyncRequest{
		Mode:       "repository",
		Repository: repositoryFullName,
	}, "github-sync", "req-manual", 3)
	if err != nil {
		t.Fatalf("BuildSyncJobs(repository) error = %v", err)
	}
	if err := svc.RecordQueuedSyncRequest(ctx, contracts.SyncRequest{
		Mode:       "repository",
		Repository: repositoryFullName,
	}, SyncRequestActor{
		Subject:     userID,
		GitHubLogin: fmt.Sprintf("ingestor-%d", suffix),
	}, queuedJobs, "req-manual", now.Add(5*time.Minute)); err != nil {
		t.Fatalf("RecordQueuedSyncRequest(repository) error = %v", err)
	}

	runs, err := svc.ListSyncRuns(ctx, contracts.GitHubSyncRunFilter{
		Repository: repositoryFullName,
		User:       "",
		Limit:      10,
	})
	if err != nil {
		t.Fatalf("ListSyncRuns(repository) error = %v", err)
	}
	if len(runs.Runs) == 0 {
		t.Fatal("ListSyncRuns(repository) returned no runs, want at least one")
	}
	if runs.Runs[0].RequestedRepository != repositoryFullName {
		t.Fatalf("RequestedRepository = %q, want %q", runs.Runs[0].RequestedRepository, repositoryFullName)
	}

	requesterRuns, err := svc.ListSyncRuns(ctx, contracts.GitHubSyncRunFilter{
		RequestedByGitHubLogin: strings.ToUpper("@" + fmt.Sprintf("ingestor-%d", suffix)),
		Limit:                  10,
	})
	if err != nil {
		t.Fatalf("ListSyncRuns(requested_by_github_login) error = %v", err)
	}
	if len(requesterRuns.Runs) == 0 {
		t.Fatal("ListSyncRuns(requested_by_github_login) returned no runs, want at least one")
	}

	assertCount(t, ctx, pool, "github_installations", "SELECT COUNT(*) FROM github_installations WHERE github_installation_id = 12001", 1)
	assertCount(t, ctx, pool, "repositories", "SELECT COUNT(*) FROM repositories WHERE github_repository_id = 22001", 1)
	assertCount(t, ctx, pool, "pull_requests", "SELECT COUNT(*) FROM pull_requests WHERE github_pull_request_id = 33001", 1)
	assertCount(t, ctx, pool, "pull_request_reviews", "SELECT COUNT(*) FROM pull_request_reviews WHERE github_review_id = 55001", 1)
	assertCount(t, ctx, pool, "pull_request_review_comments", "SELECT COUNT(*) FROM pull_request_review_comments WHERE github_review_comment_id = 66001", 1)
	assertCount(t, ctx, pool, "repository_issues", "SELECT COUNT(*) FROM repository_issues WHERE github_issue_id = 77001", 1)
	assertCount(t, ctx, pool, "repository_labels", "SELECT COUNT(*) FROM repository_labels WHERE github_label_id IN (44001, 44002)", 2)
	assertCount(t, ctx, pool, "pull_request_labels", "SELECT COUNT(*) FROM pull_request_labels WHERE pull_request_id = (SELECT id FROM pull_requests WHERE github_pull_request_id = 33001)", 1)
	assertCount(t, ctx, pool, "repository_issue_labels", "SELECT COUNT(*) FROM repository_issue_labels WHERE issue_id = (SELECT id FROM repository_issues WHERE github_issue_id = 77001)", 2)
	assertCount(t, ctx, pool, "repository_commits", "SELECT COUNT(*) FROM repository_commits WHERE repository_id = (SELECT id FROM repositories WHERE github_repository_id = 22001)", 2)
	assertCount(t, ctx, pool, "github_sync_runs", "SELECT COUNT(*) FROM github_sync_runs WHERE github_delivery_id LIKE 'delivery-%' OR correlation_id = 'req-manual'", 6)

	var persistedAuthor string
	if err := pool.QueryRow(ctx, `SELECT COALESCE(author_github_account_id::text, '') FROM pull_requests WHERE github_pull_request_id = 33001`).Scan(&persistedAuthor); err != nil {
		t.Fatalf("select pull request author: %v", err)
	}
	if persistedAuthor != accountID {
		t.Fatalf("author_github_account_id = %q, want %q", persistedAuthor, accountID)
	}
}

func assertCount(t *testing.T, ctx context.Context, pool *pgxpool.Pool, name, query string, want int) {
	t.Helper()

	var got int
	if err := pool.QueryRow(ctx, query).Scan(&got); err != nil {
		t.Fatalf("count %s: %v", name, err)
	}
	if got != want {
		t.Fatalf("%s count = %d, want %d", name, got, want)
	}
}
