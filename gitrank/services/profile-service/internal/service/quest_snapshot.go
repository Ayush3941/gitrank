package service

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

func questRewardState(ctx context.Context, tx pgx.Tx, userID string) (string, error) {
	var state string
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(jsonb_agg(
			jsonb_build_array(grant_key, reward_type, xp_amount, badge_key)
			ORDER BY grant_key
		), '[]'::jsonb)::text
		FROM user_quest_reward_grants WHERE user_id = $1::uuid
	`, userID).Scan(&state)
	return state, err
}

func invalidateQuestSnapshots(ctx context.Context, tx pgx.Tx, userID string, now time.Time) error {
	_, err := tx.Exec(ctx, `
		UPDATE profile_snapshots SET stale_after = LEAST(COALESCE(stale_after, $2), $2)
		WHERE user_id = $1::uuid
	`, userID, now.UTC())
	return err
}
