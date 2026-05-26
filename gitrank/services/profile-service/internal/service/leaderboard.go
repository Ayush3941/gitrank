package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5"
)

const (
	leaderboardSeasonSnapshotVersion = "leaderboard-season/v1"
	leaderboardSeasonRefreshTTL      = 5 * time.Minute
)

type leaderboardSeasonRecord struct {
	ID              string
	SeasonKey       string
	SeasonType      string
	Status          string
	SnapshotVersion string
	ScoreVersion    string
	WindowStart     time.Time
	WindowEnd       time.Time
	SourceWatermark time.Time
	GeneratedAt     time.Time
	EntryCount      int
}

type leaderboardSeasonSnapshotRecord struct {
	Season              leaderboardSeasonRecord
	Snapshot            snapshotRecord
	SeasonSnapshotID    string
	Rank                int
	Movement            int
	RankMovementEventID string
	WeeklyXP            int
	Focus               string
}

type previousLeaderboardRank struct {
	Rank    int
	TotalXP int
}

func (s *Store) LoadFreshLeaderboardSeason(ctx context.Context, now time.Time, limit int) (leaderboardSeasonRecord, []leaderboardSeasonSnapshotRecord, bool, error) {
	seasonKey, _, _ := currentLeaderboardSeason(now.UTC())
	rows, err := s.pool.Query(ctx, `
		SELECT
			ls.id::text,
			ls.season_key,
			ls.season_type,
			ls.status,
			ls.snapshot_version,
			ls.score_version,
			ls.window_start_at,
			ls.window_end_at,
			ls.source_watermark,
			ls.generated_at,
			ls.entry_count,
			lss.id::text,
			lss.rank,
			lss.movement,
			COALESCE(lss.rank_movement_event_id::text, ''),
			lss.weekly_xp,
			lss.focus,
			ps.id::text,
			ps.user_id::text,
			ps.snapshot_version,
			ps.total_score,
			ps.level,
			ps.summary_jsonb,
			ps.top_skills_jsonb,
			ps.badges_jsonb,
			ps.trend_jsonb,
			ps.repositories_jsonb,
			ps.score_history_jsonb,
			ps.share_card_jsonb,
			ps.refreshed_at,
			COALESCE(ps.stale_after, ps.refreshed_at),
			COALESCE(ps.source_watermark, ps.refreshed_at)
		FROM leaderboard_seasons ls
		JOIN leaderboard_season_snapshots lss ON lss.season_id = ls.id
		JOIN profile_snapshots ps ON ps.id = lss.profile_snapshot_id
		WHERE ls.season_key = $1
		  AND ls.generated_at >= $2
		ORDER BY lss.rank ASC
		LIMIT $3
	`, seasonKey, now.UTC().Add(-leaderboardSeasonRefreshTTL), limit)
	if err != nil {
		return leaderboardSeasonRecord{}, nil, false, err
	}
	defer rows.Close()

	entries := make([]leaderboardSeasonSnapshotRecord, 0)
	var season leaderboardSeasonRecord
	for rows.Next() {
		record, err := scanLeaderboardSeasonSnapshot(rows)
		if err != nil {
			return leaderboardSeasonRecord{}, nil, false, err
		}
		if season.ID == "" {
			season = record.Season
		}
		entries = append(entries, record)
	}
	if err := rows.Err(); err != nil {
		return leaderboardSeasonRecord{}, nil, false, err
	}
	if season.ID == "" {
		return leaderboardSeasonRecord{}, nil, false, nil
	}
	return season, entries, true, nil
}

func (s *Store) MaterializeLeaderboardSeason(ctx context.Context, now time.Time, limit int) (leaderboardSeasonRecord, []leaderboardSeasonSnapshotRecord, error) {
	if limit <= 0 {
		limit = 1
	}
	generatedAt := now.UTC()
	seasonKey, windowStart, windowEnd := currentLeaderboardSeason(generatedAt)

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return leaderboardSeasonRecord{}, nil, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	candidates, err := loadRankedLeaderboardCandidates(ctx, tx, generatedAt, limit)
	if err != nil {
		return leaderboardSeasonRecord{}, nil, err
	}

	var sourceWatermark time.Time
	scoreVersion := ""
	for _, candidate := range candidates {
		if sourceWatermark.IsZero() || candidate.Snapshot.SourceWatermark.After(sourceWatermark) {
			sourceWatermark = candidate.Snapshot.SourceWatermark.UTC()
		}
		candidateScoreVersion := strings.TrimSpace(scoreVersionFromSnapshot(candidate.Snapshot))
		switch {
		case candidateScoreVersion == "":
		case scoreVersion == "":
			scoreVersion = candidateScoreVersion
		case scoreVersion != candidateScoreVersion:
			scoreVersion = "mixed"
		}
	}
	if sourceWatermark.IsZero() {
		sourceWatermark = generatedAt
	}

	season, err := upsertLeaderboardSeason(ctx, tx, leaderboardSeasonRecord{
		SeasonKey:       seasonKey,
		SeasonType:      "weekly",
		Status:          "active",
		SnapshotVersion: leaderboardSeasonSnapshotVersion,
		ScoreVersion:    scoreVersion,
		WindowStart:     windowStart,
		WindowEnd:       windowEnd,
		SourceWatermark: sourceWatermark,
		GeneratedAt:     generatedAt,
		EntryCount:      len(candidates),
	})
	if err != nil {
		return leaderboardSeasonRecord{}, nil, err
	}

	previousRanks, err := loadPreviousLeaderboardRanks(ctx, tx, season.ID)
	if err != nil {
		return leaderboardSeasonRecord{}, nil, err
	}

	entries := make([]leaderboardSeasonSnapshotRecord, 0, len(candidates))
	candidateUserIDs := make(map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		candidateUserIDs[candidate.Snapshot.UserID] = struct{}{}
		entry, err := upsertLeaderboardSeasonSnapshot(ctx, tx, season, candidate, previousRanks[candidate.Snapshot.UserID], generatedAt)
		if err != nil {
			return leaderboardSeasonRecord{}, nil, err
		}
		entries = append(entries, entry)
	}
	if err := deleteStaleLeaderboardSeasonSnapshots(ctx, tx, season.ID, candidateUserIDs); err != nil {
		return leaderboardSeasonRecord{}, nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return leaderboardSeasonRecord{}, nil, err
	}
	return season, entries, nil
}

func currentLeaderboardSeason(now time.Time) (string, time.Time, time.Time) {
	start := startOfWeek(now.UTC())
	year, week := start.ISOWeek()
	return fmt.Sprintf("weekly:%04d-W%02d", year, week), start, start.AddDate(0, 0, 7)
}

func loadRankedLeaderboardCandidates(ctx context.Context, tx pgx.Tx, asOf time.Time, limit int) ([]leaderboardSeasonSnapshotRecord, error) {
	rows, err := tx.Query(ctx, `
		WITH latest_snapshots AS (
			SELECT DISTINCT ON (ps.user_id)
				ps.id,
				ps.user_id,
				ps.snapshot_version,
				ps.total_score,
				ps.level,
				ps.summary_jsonb,
				ps.top_skills_jsonb,
				ps.badges_jsonb,
				ps.trend_jsonb,
				ps.repositories_jsonb,
				ps.score_history_jsonb,
				ps.share_card_jsonb,
				ps.refreshed_at,
				COALESCE(ps.stale_after, ps.refreshed_at) AS stale_after,
				COALESCE(ps.source_watermark, ps.refreshed_at) AS source_watermark,
				ps.created_at
			FROM profile_snapshots ps
			WHERE ps.refreshed_at <= $1
			ORDER BY ps.user_id, ps.refreshed_at DESC, ps.created_at DESC
		), ranked AS (
			SELECT
				ROW_NUMBER() OVER (
					ORDER BY ls.total_score DESC, ls.refreshed_at DESC, ls.created_at DESC, ls.user_id
				)::integer AS rank,
				ls.*
			FROM latest_snapshots ls
			JOIN users u ON u.id = ls.user_id
			LEFT JOIN user_profile_settings ups ON ups.user_id = u.id
			WHERE LOWER(COALESCE(u.profile_visibility, 'public')) = 'public'
			  AND COALESCE(u.public_handle, '') <> ''
			  AND COALESCE(ups.show_leaderboard_participation, TRUE)
		)
		SELECT
			rank,
			id::text,
			user_id::text,
			snapshot_version,
			total_score,
			level,
			summary_jsonb,
			top_skills_jsonb,
			badges_jsonb,
			trend_jsonb,
			repositories_jsonb,
			score_history_jsonb,
			share_card_jsonb,
			refreshed_at,
			stale_after,
			source_watermark
		FROM ranked
		ORDER BY rank ASC
		LIMIT $2
	`, asOf.UTC(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := make([]leaderboardSeasonSnapshotRecord, 0)
	for rows.Next() {
		record, err := scanRankedLeaderboardCandidate(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
}

func scanRankedLeaderboardCandidate(row rowScanner) (leaderboardSeasonSnapshotRecord, error) {
	var record leaderboardSeasonSnapshotRecord
	var summaryRaw, skillsRaw, badgesRaw, timelineRaw, reposRaw, historyRaw, cardRaw []byte
	if err := row.Scan(
		&record.Rank,
		&record.Snapshot.ID,
		&record.Snapshot.UserID,
		&record.Snapshot.SnapshotVersion,
		&record.Snapshot.TotalXP,
		&record.Snapshot.LevelLabel,
		&summaryRaw,
		&skillsRaw,
		&badgesRaw,
		&timelineRaw,
		&reposRaw,
		&historyRaw,
		&cardRaw,
		&record.Snapshot.RefreshedAt,
		&record.Snapshot.StaleAfter,
		&record.Snapshot.SourceWatermark,
	); err != nil {
		return leaderboardSeasonSnapshotRecord{}, err
	}
	decodeSnapshotJSON(&record.Snapshot, summaryRaw, skillsRaw, badgesRaw, timelineRaw, reposRaw, historyRaw, cardRaw)
	record.WeeklyXP = weeklyXPFromSnapshot(record.Snapshot)
	record.Focus = leaderboardFocus(record.Snapshot)
	return record, nil
}

func upsertLeaderboardSeason(ctx context.Context, tx pgx.Tx, season leaderboardSeasonRecord) (leaderboardSeasonRecord, error) {
	row := tx.QueryRow(ctx, `
		INSERT INTO leaderboard_seasons (
			season_key,
			season_type,
			status,
			snapshot_version,
			score_version,
			window_start_at,
			window_end_at,
			source_watermark,
			generated_at,
			entry_count,
			updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9
		)
		ON CONFLICT (season_key) DO UPDATE
		SET season_type = EXCLUDED.season_type,
		    status = EXCLUDED.status,
		    snapshot_version = EXCLUDED.snapshot_version,
		    score_version = EXCLUDED.score_version,
		    window_start_at = EXCLUDED.window_start_at,
		    window_end_at = EXCLUDED.window_end_at,
		    source_watermark = EXCLUDED.source_watermark,
		    generated_at = EXCLUDED.generated_at,
		    entry_count = EXCLUDED.entry_count,
		    updated_at = EXCLUDED.updated_at
		RETURNING
			id::text,
			season_key,
			season_type,
			status,
			snapshot_version,
			score_version,
			window_start_at,
			window_end_at,
			source_watermark,
			generated_at,
			entry_count
	`, season.SeasonKey, season.SeasonType, season.Status, season.SnapshotVersion, season.ScoreVersion, season.WindowStart.UTC(), season.WindowEnd.UTC(), season.SourceWatermark.UTC(), season.GeneratedAt.UTC(), season.EntryCount)
	if err := row.Scan(
		&season.ID,
		&season.SeasonKey,
		&season.SeasonType,
		&season.Status,
		&season.SnapshotVersion,
		&season.ScoreVersion,
		&season.WindowStart,
		&season.WindowEnd,
		&season.SourceWatermark,
		&season.GeneratedAt,
		&season.EntryCount,
	); err != nil {
		return leaderboardSeasonRecord{}, err
	}
	return season, nil
}

func loadPreviousLeaderboardRanks(ctx context.Context, tx pgx.Tx, seasonID string) (map[string]previousLeaderboardRank, error) {
	rows, err := tx.Query(ctx, `
		SELECT user_id::text, rank, total_xp
		FROM leaderboard_season_snapshots
		WHERE season_id = $1::uuid
	`, seasonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]previousLeaderboardRank)
	for rows.Next() {
		var userID string
		var previous previousLeaderboardRank
		if err := rows.Scan(&userID, &previous.Rank, &previous.TotalXP); err != nil {
			return nil, err
		}
		out[userID] = previous
	}
	return out, rows.Err()
}

func upsertLeaderboardSeasonSnapshot(ctx context.Context, tx pgx.Tx, season leaderboardSeasonRecord, candidate leaderboardSeasonSnapshotRecord, previous previousLeaderboardRank, generatedAt time.Time) (leaderboardSeasonSnapshotRecord, error) {
	movement := 0
	var previousRank, previousTotalXP any
	if previous.Rank > 0 {
		movement = previous.Rank - candidate.Rank
		previousRank = previous.Rank
		previousTotalXP = previous.TotalXP
	}

	scoreVersion := scoreVersionFromSnapshot(candidate.Snapshot)
	movementEventID, err := upsertLeaderboardRankMovement(ctx, tx, season, candidate, previousRank, previousTotalXP, movement, scoreVersion, generatedAt.UTC())
	if err != nil {
		return leaderboardSeasonSnapshotRecord{}, err
	}

	snapshotPayload, err := json.Marshal(map[string]any{
		"profile_snapshot_id":      candidate.Snapshot.ID,
		"profile_snapshot_version": candidate.Snapshot.SnapshotVersion,
		"score_version":            scoreVersion,
		"source_watermark":         candidate.Snapshot.SourceWatermark.UTC(),
		"rank_basis":               "total_xp_desc",
	})
	if err != nil {
		return leaderboardSeasonSnapshotRecord{}, err
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO leaderboard_season_snapshots (
			season_id,
			user_id,
			profile_snapshot_id,
			rank_movement_event_id,
			rank,
			rank_tier,
			total_xp,
			weekly_xp,
			movement,
			focus,
			score_version,
			profile_snapshot_version,
			source_watermark,
			refreshed_at,
			stale_after,
			snapshot_jsonb,
			generated_at,
			updated_at
		) VALUES (
			$1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $17
		)
		ON CONFLICT (season_id, user_id) DO UPDATE
		SET profile_snapshot_id = EXCLUDED.profile_snapshot_id,
		    rank_movement_event_id = EXCLUDED.rank_movement_event_id,
		    rank = EXCLUDED.rank,
		    rank_tier = EXCLUDED.rank_tier,
		    total_xp = EXCLUDED.total_xp,
		    weekly_xp = EXCLUDED.weekly_xp,
		    movement = EXCLUDED.movement,
		    focus = EXCLUDED.focus,
		    score_version = EXCLUDED.score_version,
		    profile_snapshot_version = EXCLUDED.profile_snapshot_version,
		    source_watermark = EXCLUDED.source_watermark,
		    refreshed_at = EXCLUDED.refreshed_at,
		    stale_after = EXCLUDED.stale_after,
		    snapshot_jsonb = EXCLUDED.snapshot_jsonb,
		    generated_at = EXCLUDED.generated_at,
		    updated_at = EXCLUDED.updated_at
		RETURNING id::text
	`, season.ID, candidate.Snapshot.UserID, candidate.Snapshot.ID, movementEventID, candidate.Rank, rankTierForXP(candidate.Snapshot.TotalXP), candidate.Snapshot.TotalXP, candidate.WeeklyXP, movement, candidate.Focus, scoreVersion, candidate.Snapshot.SnapshotVersion, candidate.Snapshot.SourceWatermark.UTC(), candidate.Snapshot.RefreshedAt.UTC(), candidate.Snapshot.StaleAfter.UTC(), string(snapshotPayload), generatedAt.UTC())
	if err := row.Scan(&candidate.SeasonSnapshotID); err != nil {
		return leaderboardSeasonSnapshotRecord{}, err
	}

	candidate.Season = season
	candidate.Movement = movement
	candidate.RankMovementEventID = movementEventID
	return candidate, nil
}

func upsertLeaderboardRankMovement(ctx context.Context, tx pgx.Tx, season leaderboardSeasonRecord, candidate leaderboardSeasonSnapshotRecord, previousRank, previousTotalXP any, movement int, scoreVersion string, generatedAt time.Time) (string, error) {
	eventKey := fmt.Sprintf("leaderboard_rank:%s:%s:%s:%d", season.SeasonKey, candidate.Snapshot.UserID, candidate.Snapshot.ID, candidate.Rank)
	evidence, err := json.Marshal(map[string]any{
		"season_key":               season.SeasonKey,
		"season_snapshot_version":  season.SnapshotVersion,
		"profile_snapshot_id":      candidate.Snapshot.ID,
		"profile_snapshot_version": candidate.Snapshot.SnapshotVersion,
		"source_watermark":         candidate.Snapshot.SourceWatermark.UTC(),
		"rank_basis":               "total_xp_desc",
	})
	if err != nil {
		return "", err
	}

	var eventID string
	row := tx.QueryRow(ctx, `
		INSERT INTO leaderboard_rank_movement_events (
			season_id,
			user_id,
			profile_snapshot_id,
			event_key,
			previous_rank,
			current_rank,
			movement_delta,
			previous_total_xp,
			current_total_xp,
			score_version,
			evidence_jsonb,
			created_at
		) VALUES (
			$1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12
		)
		ON CONFLICT (event_key) DO UPDATE
		SET previous_rank = EXCLUDED.previous_rank,
		    current_rank = EXCLUDED.current_rank,
		    movement_delta = EXCLUDED.movement_delta,
		    previous_total_xp = EXCLUDED.previous_total_xp,
		    current_total_xp = EXCLUDED.current_total_xp,
		    score_version = EXCLUDED.score_version,
		    evidence_jsonb = EXCLUDED.evidence_jsonb
		RETURNING id::text
	`, season.ID, candidate.Snapshot.UserID, candidate.Snapshot.ID, eventKey, previousRank, candidate.Rank, movement, previousTotalXP, candidate.Snapshot.TotalXP, scoreVersion, string(evidence), generatedAt.UTC())
	if err := row.Scan(&eventID); err != nil {
		return "", err
	}
	return eventID, nil
}

func deleteStaleLeaderboardSeasonSnapshots(ctx context.Context, tx pgx.Tx, seasonID string, candidateUserIDs map[string]struct{}) error {
	rows, err := tx.Query(ctx, `
		SELECT user_id::text
		FROM leaderboard_season_snapshots
		WHERE season_id = $1::uuid
	`, seasonID)
	if err != nil {
		return err
	}
	defer rows.Close()

	staleUserIDs := make([]string, 0)
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return err
		}
		if _, ok := candidateUserIDs[userID]; !ok {
			staleUserIDs = append(staleUserIDs, userID)
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, userID := range staleUserIDs {
		if _, err := tx.Exec(ctx, `
			DELETE FROM leaderboard_season_snapshots
			WHERE season_id = $1::uuid
			  AND user_id = $2::uuid
		`, seasonID, userID); err != nil {
			return err
		}
	}
	return nil
}

func scanLeaderboardSeasonSnapshot(row rowScanner) (leaderboardSeasonSnapshotRecord, error) {
	var record leaderboardSeasonSnapshotRecord
	var summaryRaw, skillsRaw, badgesRaw, timelineRaw, reposRaw, historyRaw, cardRaw []byte
	if err := row.Scan(
		&record.Season.ID,
		&record.Season.SeasonKey,
		&record.Season.SeasonType,
		&record.Season.Status,
		&record.Season.SnapshotVersion,
		&record.Season.ScoreVersion,
		&record.Season.WindowStart,
		&record.Season.WindowEnd,
		&record.Season.SourceWatermark,
		&record.Season.GeneratedAt,
		&record.Season.EntryCount,
		&record.SeasonSnapshotID,
		&record.Rank,
		&record.Movement,
		&record.RankMovementEventID,
		&record.WeeklyXP,
		&record.Focus,
		&record.Snapshot.ID,
		&record.Snapshot.UserID,
		&record.Snapshot.SnapshotVersion,
		&record.Snapshot.TotalXP,
		&record.Snapshot.LevelLabel,
		&summaryRaw,
		&skillsRaw,
		&badgesRaw,
		&timelineRaw,
		&reposRaw,
		&historyRaw,
		&cardRaw,
		&record.Snapshot.RefreshedAt,
		&record.Snapshot.StaleAfter,
		&record.Snapshot.SourceWatermark,
	); err != nil {
		return leaderboardSeasonSnapshotRecord{}, err
	}
	decodeSnapshotJSON(&record.Snapshot, summaryRaw, skillsRaw, badgesRaw, timelineRaw, reposRaw, historyRaw, cardRaw)
	return record, nil
}

func decodeSnapshotJSON(record *snapshotRecord, summaryRaw, skillsRaw, badgesRaw, timelineRaw, reposRaw, historyRaw, cardRaw []byte) {
	_ = json.Unmarshal(summaryRaw, &record.Summary)
	_ = json.Unmarshal(skillsRaw, &record.TopSkills)
	_ = json.Unmarshal(badgesRaw, &record.Badges)
	_ = json.Unmarshal(timelineRaw, &record.Timeline)
	_ = json.Unmarshal(reposRaw, &record.Repositories)
	_ = json.Unmarshal(historyRaw, &record.ScoreHistory)
	_ = json.Unmarshal(cardRaw, &record.ShareCard)
}

func leaderboardEntryFromSeasonSnapshot(record leaderboardSeasonSnapshotRecord, now time.Time) contracts.LeaderboardEntryView {
	entry := leaderboardEntryFromSnapshot(record.Snapshot, record.Rank, now.UTC())
	entry.SeasonKey = record.Season.SeasonKey
	entry.SeasonSnapshotID = record.SeasonSnapshotID
	entry.RankMovementEventID = record.RankMovementEventID
	entry.Movement = record.Movement
	entry.WeeklyXP = record.WeeklyXP
	entry.Focus = record.Focus
	entry.RankEvidenceState, entry.RankEvidenceMissing = leaderboardRankEvidenceStateFromSeason(record, entry.ScoreVersion)
	return entry
}

func leaderboardRankEvidenceStateFromSeason(record leaderboardSeasonSnapshotRecord, scoreVersion string) (string, []string) {
	missing := make([]string, 0, 5)
	if strings.TrimSpace(record.SeasonSnapshotID) == "" {
		missing = append(missing, "season_snapshot")
	}
	if strings.TrimSpace(record.RankMovementEventID) == "" {
		missing = append(missing, "rank_movement_event")
	}
	if strings.TrimSpace(record.Snapshot.ID) == "" {
		missing = append(missing, "profile_snapshot")
	}
	if strings.TrimSpace(scoreVersion) == "" {
		missing = append(missing, "score_version")
	}
	if record.Snapshot.SourceWatermark.IsZero() {
		missing = append(missing, "source_watermark")
	}
	if len(missing) > 0 {
		return "partial", missing
	}
	return "complete", nil
}

func weeklyXPFromSnapshot(snapshot snapshotRecord) int {
	if points := snapshot.Timeline.Points; len(points) > 0 {
		return points[len(points)-1].DeltaXP
	}
	return 0
}

func leaderboardFocus(snapshot snapshotRecord) string {
	if len(snapshot.Summary.TopSkills) > 0 {
		return snapshot.Summary.TopSkills[0]
	}
	if len(snapshot.TopSkills) > 0 {
		return snapshot.TopSkills[0].Key
	}
	return ""
}
