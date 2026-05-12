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

func TestRefreshProfileByUserIDPersistsFreshSnapshot(t *testing.T) {
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
			SessionSecret:     "profile-refresh-test-secret",
			SessionCookieName: "gitrank_session",
			CSRFCookieName:    "gitrank_csrf",
		},
	}
	svc, err := New(cfg, pool, &Cache{}, profileTestLogger())
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	now := time.Now().UTC()
	suffix := now.UnixNano()
	handle := fmt.Sprintf("refresh-%d", suffix%1000000000)

	var userID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO users (display_name, public_handle, avatar_url)
		VALUES ($1, $2, $3)
		RETURNING id::text
	`, "Profile Refresh User", handle, "https://avatars.example.test/u/refresh").Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO score_events (
			user_id,
			score_version,
			event_type,
			delta_total_xp,
			delta_skill_jsonb,
			explanation_jsonb,
			metadata_jsonb,
			created_at
		) VALUES (
			$1::uuid,
			'score/v-refresh-test',
			'score.computed',
			150,
			'{"backend":90,"testing":60}'::jsonb,
			'["Profile refresh uses persisted score evidence."]'::jsonb,
			'{"score_formula_inputs_version":"score-components/v1"}'::jsonb,
			$2
		)
	`, userID, now.Add(-time.Hour)); err != nil {
		t.Fatalf("insert score event: %v", err)
	}

	first, err := svc.RefreshProfileByUserID(ctx, userID, now)
	if err != nil {
		t.Fatalf("RefreshProfileByUserID() error = %v", err)
	}
	if first.Status != "completed" || first.UserID != userID || first.ProfileSnapshotID == "" {
		t.Fatalf("first refresh = %+v, want completed persisted snapshot", first)
	}
	if first.TotalXP != 150 || first.ScoreVersion != "score/v-refresh-test" || first.ProfileSnapshotVersion != profileSnapshotVersion {
		t.Fatalf("first refresh = %+v, want persisted score-backed snapshot", first)
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO score_events (
			user_id,
			score_version,
			event_type,
			delta_total_xp,
			delta_skill_jsonb,
			explanation_jsonb,
			metadata_jsonb,
			created_at
		) VALUES (
			$1::uuid,
			'score/v-refresh-test',
			'score.computed',
			50,
			'{"backend":50}'::jsonb,
			'["Second score event is included by forced refresh."]'::jsonb,
			'{"score_formula_inputs_version":"score-components/v1"}'::jsonb,
			$2
		)
	`, userID, now.Add(-30*time.Minute)); err != nil {
		t.Fatalf("insert second score event: %v", err)
	}

	second, err := svc.RefreshProfileByUserID(ctx, userID, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("RefreshProfileByUserID(second) error = %v", err)
	}
	if second.ProfileSnapshotID == first.ProfileSnapshotID {
		t.Fatalf("second snapshot id = %q, want forced rebuild to create a new snapshot", second.ProfileSnapshotID)
	}
	if second.TotalXP != 200 {
		t.Fatalf("second total_xp = %d, want 200", second.TotalXP)
	}

	assertProfileSnapshotCount(t, ctx, pool, userID, 2)
}

func TestRefreshProfileByUserIDNormalizesLegacyBadgeEvidence(t *testing.T) {
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
			SessionSecret:     "profile-refresh-badge-test-secret",
			SessionCookieName: "gitrank_session",
			CSRFCookieName:    "gitrank_csrf",
		},
	}
	svc, err := New(cfg, pool, &Cache{}, profileTestLogger())
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	now := time.Now().UTC()
	suffix := now.UnixNano()
	handle := fmt.Sprintf("refresh-badge-%d", suffix%1000000000)

	var userID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO users (display_name, public_handle, avatar_url)
		VALUES ($1, $2, $3)
		RETURNING id::text
	`, "Profile Badge Normalization User", handle, "https://avatars.example.test/u/refresh-badge").Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	const legacyPRID = "44444444-4444-4444-4444-444444444444"
	if _, err := pool.Exec(ctx, `
		INSERT INTO user_badges (
			user_id,
			badge_key,
			awarded_at,
			evidence_jsonb
		) VALUES (
			$1::uuid,
			$2,
			$3,
			$4::jsonb
		)
	`, userID, "legacy-badge", now.Add(-time.Hour), `{"pull_request_id":"`+legacyPRID+`"}`); err != nil {
		t.Fatalf("insert legacy badge: %v", err)
	}

	if _, err := svc.RefreshProfileByUserID(ctx, userID, now); err != nil {
		t.Fatalf("RefreshProfileByUserID() error = %v", err)
	}

	var rule, version string
	var idsCount int
	if err := pool.QueryRow(ctx, `
		SELECT
			COALESCE(evidence_jsonb->>'rule', ''),
			COALESCE(evidence_jsonb->>'rule_version', ''),
			COALESCE(jsonb_array_length(COALESCE(evidence_jsonb->'evidence_pr_ids', '[]'::jsonb)), 0)::int
		FROM user_badges
		WHERE user_id = $1::uuid
		  AND badge_key = 'legacy-badge'
	`, userID).Scan(&rule, &version, &idsCount); err != nil {
		t.Fatalf("load normalized badge: %v", err)
	}
	if rule != "legacy-badge" || version != "badges/v1" || idsCount != 1 {
		t.Fatalf("normalized badge evidence = rule=%q version=%q ids=%d, want legacy-badge/badges/v1/1", rule, version, idsCount)
	}
}

func TestRefreshProfileByUserIDBackfillsLegacyScoreEventEvidenceLinks(t *testing.T) {
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
			SessionSecret:     "profile-refresh-legacy-score-secret",
			SessionCookieName: "gitrank_session",
			CSRFCookieName:    "gitrank_csrf",
		},
	}
	svc, err := New(cfg, pool, &Cache{}, profileTestLogger())
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	now := time.Now().UTC().Truncate(time.Second)
	suffix := now.UnixNano()
	handle := fmt.Sprintf("refresh-legacy-score-%d", suffix%1000000000)

	var userID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO users (display_name, public_handle, avatar_url)
		VALUES ($1, $2, $3)
		RETURNING id::text
	`, "Profile Legacy Score User", handle, "https://avatars.example.test/u/refresh-legacy-score").Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	var githubAccountID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO github_accounts (user_id, github_user_id, login, node_id)
		VALUES ($1::uuid, $2, $3, $4)
		RETURNING id::text
	`, userID, 9100000000+suffix, handle, fmt.Sprintf("U_refresh_legacy_score_%d", suffix)).Scan(&githubAccountID); err != nil {
		t.Fatalf("insert github account: %v", err)
	}

	var repositoryID string
	repository := handle + "/repo"
	if err := pool.QueryRow(ctx, `
		INSERT INTO repositories (github_repository_id, owner_login, name, full_name)
		VALUES ($1, $2, 'repo', $3)
		RETURNING id::text
	`, 9200000000+suffix, handle, repository).Scan(&repositoryID); err != nil {
		t.Fatalf("insert repository: %v", err)
	}

	var pullRequestID string
	number := int(suffix%1000) + 20
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
			updated_at_source
		) VALUES (
			$1,
			$2::uuid,
			$3::uuid,
			$4,
			'fix: preserve score evidence links',
			'closed',
			true,
			$5,
			$6,
			$7
		)
		RETURNING id::text
	`, 9300000000+suffix, repositoryID, githubAccountID, number, now.Add(-2*time.Hour), now.Add(-3*time.Hour), now.Add(-time.Hour)).Scan(&pullRequestID); err != nil {
		t.Fatalf("insert pull request: %v", err)
	}

	var analysisID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO contribution_analyses (
			pull_request_id,
			analyzer_version,
			analysis_source,
			classification,
			confidence,
			summary
		) VALUES (
			$1::uuid,
			'deterministic.v1',
			'deterministic',
			'feature',
			0.87,
			'Legacy score event linkage test analysis.'
		)
		RETURNING id::text
	`, pullRequestID).Scan(&analysisID); err != nil {
		t.Fatalf("insert analysis: %v", err)
	}

	legacyEventKey := fmt.Sprintf("pr:%s:analysis:%s:score:v1alpha1", pullRequestID, analysisID)
	if _, err := pool.Exec(ctx, `
		INSERT INTO score_events (
			user_id,
			replay_run_id,
			event_key,
			score_version,
			event_type,
			delta_total_xp,
			delta_skill_jsonb,
			explanation_jsonb,
			metadata_jsonb,
			created_at
		) VALUES (
			$1::uuid,
			NULL,
			$2,
			'score/v-refresh-legacy-test',
			'score.computed',
			180,
			'{"backend":120,"testing":60}'::jsonb,
			'["Legacy score event should still produce linked evidence."]'::jsonb,
			'{"formula_version":"score-components/v1"}'::jsonb,
			$3
		)
	`, userID, legacyEventKey, now.Add(-30*time.Minute)); err != nil {
		t.Fatalf("insert legacy score event: %v", err)
	}

	if _, err := svc.RefreshProfileByUserID(ctx, userID, now); err != nil {
		t.Fatalf("RefreshProfileByUserID() error = %v", err)
	}

	var linkedPullRequestID, linkedAnalysisID, linkedFormulaVersion, linkedEvidenceState string
	if err := pool.QueryRow(ctx, `
		SELECT
			COALESCE(score_history_jsonb->0->>'pull_request_id', ''),
			COALESCE(score_history_jsonb->0->>'analysis_id', ''),
			COALESCE(score_history_jsonb->0->>'formula_version', ''),
			COALESCE(score_history_jsonb->0->>'evidence_state', '')
		FROM profile_snapshots
		WHERE user_id = $1::uuid
		ORDER BY refreshed_at DESC, created_at DESC
		LIMIT 1
	`, userID).Scan(&linkedPullRequestID, &linkedAnalysisID, &linkedFormulaVersion, &linkedEvidenceState); err != nil {
		t.Fatalf("load score history evidence links: %v", err)
	}
	if linkedPullRequestID != pullRequestID || linkedAnalysisID != analysisID {
		t.Fatalf("score history links = %q/%q, want %q/%q", linkedPullRequestID, linkedAnalysisID, pullRequestID, analysisID)
	}
	if linkedFormulaVersion != "score-components/v1" {
		t.Fatalf("formula_version = %q, want score-components/v1", linkedFormulaVersion)
	}
	if linkedEvidenceState != "complete" {
		t.Fatalf("evidence_state = %q, want complete", linkedEvidenceState)
	}
}

func assertProfileSnapshotCount(t *testing.T, ctx context.Context, pool *pgxpool.Pool, userID string, want int) {
	t.Helper()

	var got int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM profile_snapshots WHERE user_id = $1::uuid`, userID).Scan(&got); err != nil {
		t.Fatalf("count profile_snapshots: %v", err)
	}
	if got != want {
		t.Fatalf("profile_snapshots count = %d, want %d", got, want)
	}
}

func profileTestLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}
