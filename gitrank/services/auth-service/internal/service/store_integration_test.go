package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestDeleteAccountIntegration(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_AUTH_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_AUTH_DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	store := NewStore(pool)
	now := time.Now().UTC()
	suffix := now.UnixNano()

	var userID string
	err = pool.QueryRow(ctx, `
		INSERT INTO users (display_name, public_handle, avatar_url)
		VALUES ($1, $2, $3)
		RETURNING id::text
	`, fmt.Sprintf("Octo %d", suffix), fmt.Sprintf("octo-%d", suffix), "https://avatars.example.test/u/1").Scan(&userID)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	var accountID string
	err = pool.QueryRow(ctx, `
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
			$1::uuid, $2, $3, $4, 'oauth', ARRAY['read:user','user:email']::text[], $5, $6, $7, 'User', false, $8, 'linked', $8, $8
		)
		RETURNING id::text
	`, userID, 900000+suffix%100000, fmt.Sprintf("octo-%d", suffix), fmt.Sprintf("node-%d", suffix), "octo@example.test", "https://avatars.example.test/u/1", "Octo", now).Scan(&accountID)
	if err != nil {
		t.Fatalf("insert github account: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO github_user_tokens (
			github_account_id,
			access_token_encrypted,
			refresh_token_encrypted,
			token_type,
			scope,
			issued_at,
			last_used_at,
			last_refreshed_at,
			last_refresh_error,
			revoked_reason
		) VALUES (
			$1::uuid, 'enc-access', 'enc-refresh', 'bearer', 'read:user,user:email', $2, $2, $2, '', ''
		)
	`, accountID, now)
	if err != nil {
		t.Fatalf("insert github token: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO auth_sessions (
			user_id,
			github_account_id,
			session_token_hash,
			csrf_token_hash,
			roles,
			request_ip,
			user_agent,
			github_authorization_status,
			created_at,
			last_seen_at,
			last_refreshed_at,
			rotated_at,
			expires_at,
			idle_expires_at
		) VALUES (
			$1::uuid, $2::uuid, $3, $4, ARRAY['user']::text[], '127.0.0.1', 'go-test', 'active', $5, $5, $5, $5, $6, $6
		)
	`, userID, accountID, fmt.Sprintf("session-%d", suffix), fmt.Sprintf("csrf-%d", suffix), now, now.Add(24*time.Hour))
	if err != nil {
		t.Fatalf("insert auth session: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO user_profile_settings (user_id)
		VALUES ($1::uuid)
	`, userID)
	if err != nil {
		t.Fatalf("insert user_profile_settings: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO profile_snapshots (
			user_id,
			snapshot_version,
			total_score,
			level,
			top_skills_jsonb,
			badges_jsonb,
			trend_jsonb,
			summary_jsonb,
			repositories_jsonb,
			score_history_jsonb,
			share_card_jsonb,
			refreshed_at
		) VALUES (
			$1::uuid, 'v1', 25, 'Explorer', '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, $2
		)
	`, userID, now)
	if err != nil {
		t.Fatalf("insert profile snapshot: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO score_events (
			user_id,
			score_version,
			event_type,
			delta_total_xp,
			delta_skill_jsonb,
			explanation_jsonb,
			created_at
		) VALUES (
			$1::uuid, 'v1', 'score.computed', 25, '{}'::jsonb, '{}'::jsonb, $2
		)
	`, userID, now)
	if err != nil {
		t.Fatalf("insert score event: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO user_badges (user_id, badge_key, awarded_at, evidence_jsonb)
		VALUES ($1::uuid, $2, $3, '{}'::jsonb)
	`, userID, fmt.Sprintf("first-pr-%d", suffix), now)
	if err != nil {
		t.Fatalf("insert user badge: %v", err)
	}

	if err := store.DeleteAccount(ctx, userID, accountID, now); err != nil {
		t.Fatalf("DeleteAccount() error = %v", err)
	}

	assertZeroRows(t, ctx, pool, "users", "SELECT COUNT(*) FROM users WHERE id = $1::uuid", userID)
	assertZeroRows(t, ctx, pool, "github_accounts", "SELECT COUNT(*) FROM github_accounts WHERE id = $1::uuid", accountID)
	assertZeroRows(t, ctx, pool, "github_user_tokens", "SELECT COUNT(*) FROM github_user_tokens WHERE github_account_id = $1::uuid", accountID)
	assertZeroRows(t, ctx, pool, "auth_sessions", "SELECT COUNT(*) FROM auth_sessions WHERE user_id = $1::uuid", userID)
	assertZeroRows(t, ctx, pool, "user_profile_settings", "SELECT COUNT(*) FROM user_profile_settings WHERE user_id = $1::uuid", userID)
	assertZeroRows(t, ctx, pool, "profile_snapshots", "SELECT COUNT(*) FROM profile_snapshots WHERE user_id = $1::uuid", userID)
	assertZeroRows(t, ctx, pool, "score_events", "SELECT COUNT(*) FROM score_events WHERE user_id = $1::uuid", userID)
	assertZeroRows(t, ctx, pool, "user_badges", "SELECT COUNT(*) FROM user_badges WHERE user_id = $1::uuid", userID)

	var metadataRaw []byte
	err = pool.QueryRow(ctx, `
		SELECT metadata_jsonb
		FROM audit_logs
		WHERE action = 'auth.account_deleted'
		  AND actor_id = $1
		  AND target_type = 'user'
		  AND target_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, userID).Scan(&metadataRaw)
	if err != nil {
		t.Fatalf("select audit log: %v", err)
	}

	var metadata map[string]any
	if err := json.Unmarshal(metadataRaw, &metadata); err != nil {
		t.Fatalf("unmarshal audit metadata: %v", err)
	}
	if metadata["mode"] != "hard_delete_v1" {
		t.Fatalf("audit mode = %v, want hard_delete_v1", metadata["mode"])
	}
	if metadata["github_account_id"] != accountID {
		t.Fatalf("audit github_account_id = %v, want %q", metadata["github_account_id"], accountID)
	}
}

func assertZeroRows(t *testing.T, ctx context.Context, pool *pgxpool.Pool, name, query string, arg string) {
	t.Helper()

	var count int
	if err := pool.QueryRow(ctx, query, arg).Scan(&count); err != nil {
		t.Fatalf("count %s: %v", name, err)
	}
	if count != 0 {
		t.Fatalf("%s rows = %d, want 0", name, count)
	}
}
