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
