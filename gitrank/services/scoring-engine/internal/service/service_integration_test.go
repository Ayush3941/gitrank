package service

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestReplayUserPersistsLedgerAndSnapshot(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_SCORING_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_SCORING_DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	svc, err := New(config.App{ServiceName: "scoring-engine"}, pool, testLogger())
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	now := time.Now().UTC()
	suffix := now.UnixNano()

	var userID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO users (display_name, public_handle, avatar_url)
		VALUES ($1, $2, $3)
		RETURNING id::text
	`, fmt.Sprintf("Replay User %d", suffix), fmt.Sprintf("replay-%d", suffix), "https://avatars.example.test/u/9").Scan(&userID); err != nil {
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
			linked_at,
			link_status
		) VALUES (
			$1::uuid, $2, $3, $4, 'oauth', ARRAY['read:user','user:email']::text[], $5, 'linked'
		)
		RETURNING id::text
	`, userID, 800000+suffix%100000, fmt.Sprintf("replay-%d", suffix), fmt.Sprintf("node-%d", suffix), now).Scan(&accountID); err != nil {
		t.Fatalf("insert github account: %v", err)
	}

	var repositoryID string
	repositoryOwner := fmt.Sprintf("owner-%d", suffix)
	repositoryFullName := fmt.Sprintf("%s/replay-repo", repositoryOwner)
	if err := pool.QueryRow(ctx, `
		INSERT INTO repositories (
			github_repository_id,
			owner_login,
			name,
			full_name,
			is_private,
			primary_language,
			default_branch,
			stars_count
		) VALUES (
			$1, $2, $3, $4, FALSE, 'Go', 'main', 900
		)
		RETURNING id::text
	`, 910000+suffix%100000, repositoryOwner, "replay-repo", repositoryFullName).Scan(&repositoryID); err != nil {
		t.Fatalf("insert repository: %v", err)
	}

	var pullRequestID string
	occurredAt := now.Add(-48 * time.Hour)
	if err := pool.QueryRow(ctx, `
		INSERT INTO pull_requests (
			github_pull_request_id,
			repository_id,
			author_github_account_id,
			number,
			title,
			state,
			merged,
			merged_at,
			created_at_source,
			updated_at_source,
			base_branch,
			head_branch,
			changed_files,
			additions,
			deletions,
			commits,
			payload_jsonb
		) VALUES (
			$1, $2::uuid, $3::uuid, 17, 'Replay scoring route hardening', 'closed', TRUE, $4, $4, $4, 'main', 'feature/replay', 3, 120, 30, 2, '{"body":"Closes #42"}'::jsonb
		)
		RETURNING id::text
	`, 920000+suffix%100000, repositoryID, accountID, occurredAt).Scan(&pullRequestID); err != nil {
		t.Fatalf("insert pull request: %v", err)
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO pull_request_files (pull_request_id, path, status, additions, deletions, changes)
		VALUES
			($1::uuid, 'internal/httpapi/router.go', 'modified', 90, 20, 110),
			($1::uuid, 'internal/httpapi/router_test.go', 'modified', 30, 10, 40)
	`, pullRequestID); err != nil {
		t.Fatalf("insert pull request files: %v", err)
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO pull_request_reviews (github_review_id, pull_request_id, state, submitted_at_source, payload_jsonb)
		VALUES
			($1, $2::uuid, 'APPROVED', $3, '{"author_association":"MEMBER"}'::jsonb),
			($4, $2::uuid, 'COMMENTED', $3, '{"author_association":"MEMBER"}'::jsonb)
	`, 930000+suffix%100000, pullRequestID, occurredAt.Add(2*time.Hour), 940000+suffix%100000); err != nil {
		t.Fatalf("insert pull request reviews: %v", err)
	}

	if err := pool.QueryRow(ctx, `
		INSERT INTO contribution_analyses (
			pull_request_id,
			analyzer_version,
			prompt_version,
			model_name,
			analysis_source,
			classification,
			confidence,
			summary,
			signals_jsonb,
			created_at
		) VALUES (
			$1::uuid, 'deterministic.v1', '', '', 'deterministic', 'feature', 0.83, 'Replay-worthy feature contribution.', '["criticality=api_surface","languages=Go"]'::jsonb, $2
		)
		RETURNING id::text
	`, pullRequestID, occurredAt.Add(3*time.Hour)).Scan(new(string)); err != nil {
		t.Fatalf("insert analysis: %v", err)
	}

	firstRun, err := svc.ReplayUser(ctx, userID, contracts.ReplayUserScoresRequest{TriggerType: "replay"}, now)
	if err != nil {
		t.Fatalf("ReplayUser() error = %v", err)
	}
	if firstRun.Events != 1 {
		t.Fatalf("ReplayUser() events = %d, want 1", firstRun.Events)
	}
	if firstRun.Snapshot.TotalXP <= 0 {
		t.Fatalf("ReplayUser() total_xp = %d, want positive", firstRun.Snapshot.TotalXP)
	}
	if len(firstRun.Badges) == 0 || firstRun.Badges[0].Key != "first_merged_pr" {
		t.Fatalf("ReplayUser() badges = %+v, want first_merged_pr", firstRun.Badges)
	}

	secondRun, err := svc.ReplayUser(ctx, userID, contracts.ReplayUserScoresRequest{TriggerType: "replay"}, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("ReplayUser() second run error = %v", err)
	}
	if secondRun.Snapshot.ReplayRunID == firstRun.Snapshot.ReplayRunID {
		t.Fatalf("second replay_run_id = %q, want new replay run", secondRun.Snapshot.ReplayRunID)
	}
	if secondRun.Snapshot.TotalXP != firstRun.Snapshot.TotalXP {
		t.Fatalf("second total_xp = %d, want %d", secondRun.Snapshot.TotalXP, firstRun.Snapshot.TotalXP)
	}

	snapshot, err := svc.LatestSnapshot(ctx, userID, now.Add(2*time.Minute))
	if err != nil {
		t.Fatalf("LatestSnapshot() error = %v", err)
	}
	if snapshot.ReplayRunID != secondRun.Snapshot.ReplayRunID {
		t.Fatalf("LatestSnapshot() replay_run_id = %q, want %q", snapshot.ReplayRunID, secondRun.Snapshot.ReplayRunID)
	}

	events, err := svc.Events(ctx, userID, now.Add(2*time.Minute))
	if err != nil {
		t.Fatalf("Events() error = %v", err)
	}
	if len(events.Events) != 1 {
		t.Fatalf("Events() len = %d, want 1", len(events.Events))
	}
	if events.Events[0].PullRequest == nil || events.Events[0].PullRequest.Number != 17 {
		t.Fatalf("Events() pull request = %+v, want #17", events.Events[0].PullRequest)
	}

	verification, err := svc.VerifyReplay(ctx, userID, contracts.VerifyScoreReplayRequest{
		Repository:   repositoryFullName,
		From:         occurredAt.Add(-time.Hour),
		To:           occurredAt.Add(time.Hour),
		ScoreVersion: firstRun.Snapshot.ScoreVersion,
	}, now.Add(3*time.Minute))
	if err != nil {
		t.Fatalf("VerifyReplay() error = %v", err)
	}
	if verification.Persisted {
		t.Fatalf("VerifyReplay() persisted = true, want false")
	}
	if verification.TotalXP != firstRun.Snapshot.TotalXP {
		t.Fatalf("VerifyReplay() total_xp = %d, want %d", verification.TotalXP, firstRun.Snapshot.TotalXP)
	}
	if verification.ContributionCount != 1 || len(verification.Events) != 1 {
		t.Fatalf("VerifyReplay() contributions/events = %d/%d, want 1/1", verification.ContributionCount, len(verification.Events))
	}
	if verification.Events[0].PullRequest == nil || verification.Events[0].PullRequest.Repository != repositoryFullName || verification.Events[0].PullRequest.Number != 17 {
		t.Fatalf("VerifyReplay() event PR = %+v, want %s#17", verification.Events[0].PullRequest, repositoryFullName)
	}
	if verification.From == nil || verification.To == nil {
		t.Fatalf("VerifyReplay() window = %v..%v, want populated pointers", verification.From, verification.To)
	}

	emptyWindow, err := svc.VerifyReplay(ctx, userID, contracts.VerifyScoreReplayRequest{
		From:         now.Add(-time.Hour),
		To:           now,
		ScoreVersion: firstRun.Snapshot.ScoreVersion,
	}, now.Add(4*time.Minute))
	if err != nil {
		t.Fatalf("VerifyReplay() empty window error = %v", err)
	}
	if emptyWindow.Persisted || emptyWindow.TotalXP != 0 || emptyWindow.ContributionCount != 0 || len(emptyWindow.Events) != 0 {
		t.Fatalf("VerifyReplay() empty window = %+v, want non-persisted empty result", emptyWindow)
	}

	assertCount(t, ctx, pool, "score_replay_runs", "SELECT COUNT(*) FROM score_replay_runs WHERE user_id = $1::uuid", userID, 2)
	assertCount(t, ctx, pool, "score_snapshots", "SELECT COUNT(*) FROM score_snapshots WHERE user_id = $1::uuid", userID, 2)
	assertCount(t, ctx, pool, "score_events", "SELECT COUNT(*) FROM score_events WHERE user_id = $1::uuid", userID, 2)
	assertCount(t, ctx, pool, "user_badges", "SELECT COUNT(*) FROM user_badges WHERE user_id = $1::uuid AND badge_key = 'first_merged_pr'", userID, 1)
}

func assertCount(t *testing.T, ctx context.Context, pool *pgxpool.Pool, name, query, userID string, want int) {
	t.Helper()

	var got int
	if err := pool.QueryRow(ctx, query, userID).Scan(&got); err != nil {
		t.Fatalf("count %s: %v", name, err)
	}
	if got != want {
		t.Fatalf("%s count = %d, want %d", name, got, want)
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}
