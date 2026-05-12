package service

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestLeaderboardMaterializesSeasonSnapshotsAndRankMovements(t *testing.T) {
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
			SessionSecret:     "profile-leaderboard-test-secret",
			SessionCookieName: "gitrank_session",
			CSRFCookieName:    "gitrank_csrf",
		},
	}
	svc, err := New(cfg, pool, &Cache{}, profileTestLogger())
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	rawNow := time.Now().UTC()
	now := time.Date(2026, 5, 6, 12, 0, 0, 0, time.UTC).Add(time.Duration(rawNow.UnixNano()%1000) * time.Millisecond)
	suffix := rawNow.UnixNano() % 1000000000
	alphaID := insertLeaderboardUserWithScore(t, ctx, pool, fmt.Sprintf("leaderboard-alpha-%d", suffix), 500, now.Add(-2*time.Hour))
	bravoID := insertLeaderboardUserWithScore(t, ctx, pool, fmt.Sprintf("leaderboard-bravo-%d", suffix), 300, now.Add(-90*time.Minute))

	if _, err := svc.RefreshProfileByUserID(ctx, alphaID, now.Add(-time.Hour)); err != nil {
		t.Fatalf("RefreshProfileByUserID(alpha) error = %v", err)
	}
	if _, err := svc.RefreshProfileByUserID(ctx, bravoID, now.Add(-time.Hour)); err != nil {
		t.Fatalf("RefreshProfileByUserID(bravo) error = %v", err)
	}

	first, err := svc.Leaderboard(ctx, 10, now)
	if err != nil {
		t.Fatalf("Leaderboard(first) error = %v", err)
	}
	if len(first.Entries) < 2 {
		t.Fatalf("first leaderboard entries = %d, want at least 2", len(first.Entries))
	}
	if first.SeasonKey == "" || first.SeasonSnapshotVersion != leaderboardSeasonSnapshotVersion || first.ScoringVersion != "score/v-leaderboard-test" {
		t.Fatalf("first season metadata = %+v, want persisted season metadata", first)
	}
	alphaFirst := findLeaderboardEntry(t, first.Entries, "leaderboard-alpha", suffix)
	if alphaFirst.Rank != 1 || alphaFirst.SeasonSnapshotID == "" || alphaFirst.RankMovementEventID == "" {
		t.Fatalf("alpha first entry = %+v, want rank 1 with persisted season and movement evidence", alphaFirst)
	}
	if alphaFirst.RankEvidenceState != "complete" || len(alphaFirst.RankEvidenceMissing) != 0 {
		t.Fatalf("alpha rank evidence = %q/%+v, want complete", alphaFirst.RankEvidenceState, alphaFirst.RankEvidenceMissing)
	}

	insertLeaderboardScore(t, ctx, pool, bravoID, 450, now.Add(30*time.Minute))
	if _, err := svc.RefreshProfileByUserID(ctx, bravoID, now.Add(31*time.Minute)); err != nil {
		t.Fatalf("RefreshProfileByUserID(bravo second) error = %v", err)
	}

	second, err := svc.Leaderboard(ctx, 10, now.Add(40*time.Minute))
	if err != nil {
		t.Fatalf("Leaderboard(second) error = %v", err)
	}
	bravoSecond := findLeaderboardEntry(t, second.Entries, "leaderboard-bravo", suffix)
	if bravoSecond.Rank != 1 || bravoSecond.Movement != 1 {
		t.Fatalf("bravo second entry = %+v, want rank 1 with +1 movement", bravoSecond)
	}
	if bravoSecond.SeasonSnapshotID == "" || bravoSecond.RankMovementEventID == "" || bravoSecond.RankEvidenceState != "complete" {
		t.Fatalf("bravo second evidence = %+v, want complete persisted rank evidence", bravoSecond)
	}

	assertLeaderboardSeasonRows(t, ctx, pool, second.SeasonKey, 2)
}

func insertLeaderboardUserWithScore(t *testing.T, ctx context.Context, pool *pgxpool.Pool, handle string, xp int, createdAt time.Time) string {
	t.Helper()

	var userID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO users (display_name, public_handle, avatar_url)
		VALUES ($1, $2, $3)
		RETURNING id::text
	`, handle, handle, "https://avatars.example.test/u/"+handle).Scan(&userID); err != nil {
		t.Fatalf("insert leaderboard user: %v", err)
	}
	insertLeaderboardScore(t, ctx, pool, userID, xp, createdAt)
	return userID
}

func insertLeaderboardScore(t *testing.T, ctx context.Context, pool *pgxpool.Pool, userID string, xp int, createdAt time.Time) {
	t.Helper()

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
			'score/v-leaderboard-test',
			'score.computed',
			$2,
			'{"backend":100}'::jsonb,
			'["Leaderboard ranking uses persisted score evidence."]'::jsonb,
			'{"score_formula_inputs_version":"score-components/v1"}'::jsonb,
			$3
		)
	`, userID, xp, createdAt.UTC()); err != nil {
		t.Fatalf("insert leaderboard score: %v", err)
	}
}

func findLeaderboardEntry(t *testing.T, entries []contracts.LeaderboardEntryView, prefix string, suffix int64) contracts.LeaderboardEntryView {
	t.Helper()

	handle := fmt.Sprintf("%s-%d", prefix, suffix)
	for _, entry := range entries {
		if entry.Handle == handle {
			return entry
		}
	}
	t.Fatalf("leaderboard entry %q not found in %+v", handle, entries)
	return contracts.LeaderboardEntryView{}
}

func assertLeaderboardSeasonRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool, seasonKey string, want int) {
	t.Helper()

	var snapshotCount, movementCount int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM leaderboard_season_snapshots lss
		JOIN leaderboard_seasons ls ON ls.id = lss.season_id
		WHERE ls.season_key = $1
		  AND lss.rank_movement_event_id IS NOT NULL
	`, seasonKey).Scan(&snapshotCount); err != nil {
		t.Fatalf("count leaderboard snapshots: %v", err)
	}
	if snapshotCount < want {
		t.Fatalf("leaderboard season snapshot count = %d, want at least %d", snapshotCount, want)
	}
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM leaderboard_rank_movement_events lrme
		JOIN leaderboard_seasons ls ON ls.id = lrme.season_id
		WHERE ls.season_key = $1
	`, seasonKey).Scan(&movementCount); err != nil {
		t.Fatalf("count leaderboard rank movements: %v", err)
	}
	if movementCount < want {
		t.Fatalf("leaderboard movement events = %d, want at least %d", movementCount, want)
	}
}
