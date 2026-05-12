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

	"github.com/gitrank/gitrank/packages/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMaterializePullRequestReportPersistsIdempotentSnapshot(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_PROFILE_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_PROFILE_DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	cfg := config.App{
		ServiceName: "profile-service",
		Database:    config.Database{URL: databaseURL},
		Auth: config.Auth{
			SessionSecret:     "profile-report-test-secret",
			SessionCookieName: "gitrank_session",
			CSRFCookieName:    "gitrank_csrf",
		},
	}
	svc, err := New(cfg, pool, &Cache{}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	rawNow := time.Now().UTC()
	now := rawNow.Truncate(time.Second)
	suffix := rawNow.UnixNano() % 1000000000
	owner := fmt.Sprintf("report-%d", suffix)
	repoName := "repo"
	number := int(suffix%1000) + 1

	var userID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO users (display_name, public_handle, avatar_url)
		VALUES ($1, $2, $3)
		RETURNING id::text
	`, "Report Materialization User", owner, "https://avatars.example.test/u/report").Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	var githubAccountID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO github_accounts (user_id, github_user_id, login, node_id)
		VALUES ($1::uuid, $2, $3, $4)
		RETURNING id::text
	`, userID, 5000000000+suffix, owner, fmt.Sprintf("U_report_%d", suffix)).Scan(&githubAccountID); err != nil {
		t.Fatalf("insert github account: %v", err)
	}

	var repositoryID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO repositories (github_repository_id, owner_login, name, full_name, stars_count)
		VALUES ($1, $2, $3, $4, 120)
		RETURNING id::text
	`, 6000000000+suffix, owner, repoName, owner+"/"+repoName).Scan(&repositoryID); err != nil {
		t.Fatalf("insert repository: %v", err)
	}

	var pullRequestID string
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
			changed_files,
			additions,
			deletions,
			payload_jsonb
		) VALUES (
			$1,
			$2::uuid,
			$3::uuid,
			$4,
			'feat: persist battle report snapshots',
			'closed',
			true,
			$5,
			$6,
			$7,
			2,
			80,
			8,
			'{"body":"Fixes #44"}'::jsonb
		)
		RETURNING id::text
	`, 7000000000+suffix, repositoryID, githubAccountID, number, now.Add(-2*time.Hour), now.Add(-3*time.Hour), now.Add(-time.Hour)).Scan(&pullRequestID); err != nil {
		t.Fatalf("insert pull request: %v", err)
	}

	var analysisID string
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
			$1::uuid,
			'deterministic.v1',
			'prompt.v1',
			'',
			'deterministic',
			'feature',
			0.88,
			'Persisted report snapshot evidence.',
			'["CI passed","Maintainer reviewed"]'::jsonb,
			$2
		)
		RETURNING id::text
	`, pullRequestID, now.Add(-45*time.Minute)).Scan(&analysisID); err != nil {
		t.Fatalf("insert analysis: %v", err)
	}

	var scoreEventID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO score_events (
			user_id,
			pull_request_id,
			analysis_id,
			score_version,
			event_type,
			delta_total_xp,
			delta_skill_jsonb,
			explanation_jsonb,
			metadata_jsonb,
			created_at
		) VALUES (
			$1::uuid,
			$2::uuid,
			$3::uuid,
			'score/v-report-test',
			'score.computed',
			230,
			'{"backend":180,"testing":50}'::jsonb,
			'["Report materialization uses persisted score evidence."]'::jsonb,
			'{"technical_depth":0.7,"review_strength":0.6,"category_weight":1.1}'::jsonb,
			$4
		)
		RETURNING id::text
	`, userID, pullRequestID, analysisID, now.Add(-30*time.Minute)).Scan(&scoreEventID); err != nil {
		t.Fatalf("insert score event: %v", err)
	}

	first, err := svc.MaterializePullRequestReport(ctx, owner, repoName, number, now)
	if err != nil {
		t.Fatalf("MaterializePullRequestReport() error = %v", err)
	}
	if first.Status != "materialized" || first.PullRequestID != pullRequestID || first.ReportSnapshotID == "" {
		t.Fatalf("first materialization = %+v, want persisted report snapshot", first)
	}
	if first.ScoreEventID != scoreEventID || first.AnalysisID != analysisID || first.ReportVersion != pullRequestReportVersion {
		t.Fatalf("first materialization provenance = %+v, want score/analysis/report version", first)
	}

	second, err := svc.MaterializePullRequestReport(ctx, owner, repoName, number, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("MaterializePullRequestReport(second) error = %v", err)
	}
	if second.ReportSnapshotID != first.ReportSnapshotID {
		t.Fatalf("second snapshot id = %q, want idempotent update of %q", second.ReportSnapshotID, first.ReportSnapshotID)
	}

	assertReportSnapshot(t, ctx, pool, first.ReportSnapshotID, pullRequestID, "feat: persist battle report snapshots", 1)
}

func assertReportSnapshot(t *testing.T, ctx context.Context, pool *pgxpool.Pool, snapshotID, pullRequestID, wantTitle string, wantCount int) {
	t.Helper()

	var count int
	var title string
	if err := pool.QueryRow(ctx, `
		SELECT
			COUNT(*)::int,
			COALESCE(MAX(report_jsonb->'contribution'->>'title'), '')
		FROM pull_request_report_snapshots
		WHERE pull_request_id = $1::uuid
	`, pullRequestID).Scan(&count, &title); err != nil {
		t.Fatalf("load report snapshot count: %v", err)
	}
	if count != wantCount {
		t.Fatalf("pull_request_report_snapshots count = %d, want %d", count, wantCount)
	}
	if title != wantTitle {
		t.Fatalf("snapshot title = %q, want %q", title, wantTitle)
	}

	var exists bool
	if err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM pull_request_report_snapshots
			WHERE id = $1::uuid
			  AND jsonb_typeof(report_jsonb) = 'object'
			  AND btrim(report_version) <> ''
		)
	`, snapshotID).Scan(&exists); err != nil {
		t.Fatalf("load report snapshot shape: %v", err)
	}
	if !exists {
		t.Fatalf("snapshot %s missing valid persisted JSON report", snapshotID)
	}
}
