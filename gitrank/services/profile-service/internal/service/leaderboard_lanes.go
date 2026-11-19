package service

import (
	"context"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5"
)

func leaderboardSeasonForLane(now time.Time, lane contracts.LeaderboardLane) (string, time.Time, time.Time) {
	key, start, end := currentLeaderboardSeason(now)
	if lane != contracts.LeaderboardGlobal {
		key += ":" + string(lane)
	}
	return key, start, end
}

func loadLeaderboardCandidates(ctx context.Context, tx pgx.Tx, asOf time.Time, limit int, lane contracts.LeaderboardLane) ([]leaderboardSeasonSnapshotRecord, error) {
	globalKey, start, end := currentLeaderboardSeason(asOf)
	rows, err := tx.Query(ctx, `
		WITH latest_snapshots AS (
			SELECT DISTINCT ON (ps.user_id) ps.*
			FROM profile_snapshots ps
			WHERE ps.refreshed_at <= $1
			ORDER BY ps.user_id, ps.refreshed_at DESC, ps.created_at DESC, ps.id DESC
		), metrics AS (
			SELECT ps.*,
				COALESCE((
					SELECT SUM((point->>'delta_xp')::integer)
					FROM jsonb_array_elements(COALESCE(ps.trend_jsonb->'points', '[]'::jsonb)) point
					WHERE (point->>'bucket_start')::timestamptz >= $4
					  AND (point->>'bucket_end')::timestamptz <= $5
				), 0)::integer AS weekly_xp,
				COALESCE((
					SELECT SUM((skill->>'total_xp')::integer)
					FROM jsonb_array_elements(ps.top_skills_jsonb) skill
					WHERE LOWER(skill->>'key') = $3
				), 0)::integer AS skill_xp,
				COALESCE(previous_global.movement, 0) AS global_movement,
				COALESCE(previous_global.id::text, '') AS global_snapshot_id
			FROM latest_snapshots ps
			JOIN users u ON u.id = ps.user_id
			LEFT JOIN user_profile_settings settings ON settings.user_id = u.id
			LEFT JOIN leaderboard_seasons global_season ON global_season.season_key = $6
			LEFT JOIN leaderboard_season_snapshots previous_global
				ON previous_global.season_id = global_season.id AND previous_global.user_id = u.id
			WHERE LOWER(u.profile_visibility) = 'public'
			  AND COALESCE(u.public_handle, '') <> ''
			  AND COALESCE(settings.show_leaderboard_participation, TRUE)
		), scoped AS (
			SELECT metrics.*,
				CASE WHEN $3 = 'weekly' THEN weekly_xp
					WHEN $3 = 'rising' THEN global_movement
					WHEN $3 IN ('backend', 'testing', 'documentation') THEN skill_xp
					ELSE total_score END AS ranking_value
			FROM metrics
			WHERE $3 NOT IN ('backend', 'testing', 'documentation') OR skill_xp > 0
		), ranked AS (
			SELECT ROW_NUMBER() OVER (
				ORDER BY ranking_value DESC,
					CASE WHEN $3 = 'rising' THEN weekly_xp ELSE total_score END DESC,
					refreshed_at DESC, created_at DESC, user_id
			)::integer AS rank, scoped.*
			FROM scoped
		)
		SELECT rank, ranking_value, weekly_xp, global_snapshot_id,
			id::text, user_id::text, snapshot_version, total_score, level,
			summary_jsonb, top_skills_jsonb, badges_jsonb, trend_jsonb,
			repositories_jsonb, score_history_jsonb, share_card_jsonb,
			refreshed_at, COALESCE(stale_after, refreshed_at),
			COALESCE(source_watermark, refreshed_at)
		FROM ranked ORDER BY rank ASC LIMIT $2
	`, asOf.UTC(), limit, string(lane), start, end, globalKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var records []leaderboardSeasonSnapshotRecord
	for rows.Next() {
		record, err := scanRankedLeaderboardCandidate(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
}
