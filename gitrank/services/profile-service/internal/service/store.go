package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const profileSnapshotVersion = "profile/v1"

type Store struct {
	pool *pgxpool.Pool
}

type userRecord struct {
	ID                string
	Handle            string
	DisplayName       string
	AvatarURL         string
	Bio               string
	ProfileVisibility string
	GitHubLogin       string
}

type sessionPrincipal struct {
	UserID string
	Roles  []string
}

type profileSettingsRecord struct {
	Settings  contracts.ProfilePrivacySettings
	UpdatedAt time.Time
}

type repositoryVisibilityRecord struct {
	RepositoryID string
	FullName     string
	Visibility   string
	Reason       string
	UpdatedAt    time.Time
}

type scoreRow struct {
	EventID     string
	EventType   string
	DeltaXP     int
	Skills      map[string]int
	Explanation []string
	CreatedAt   time.Time
	Repository  string
	Owner       string
	Name        string
	PRNumber    int
	PRTitle     string
	PRMerged    bool
}

type badgeRecord struct {
	Key       string
	AwardedAt time.Time
	Evidence  map[string]any
}

type snapshotRecord struct {
	ID              string
	UserID          string
	SnapshotVersion string
	TotalXP         int
	LevelLabel      string
	Summary         contracts.PublicProfileSummary
	TopSkills       []contracts.SkillAreaView
	Badges          []contracts.BadgeView
	Timeline        contracts.ProfileTimeline
	Repositories    []contracts.TopRepositoryView
	ScoreHistory    []contracts.ScoreHistoryEntry
	ShareCard       contracts.ShareableProfileCard
	RefreshedAt     time.Time
	StaleAfter      time.Time
	SourceWatermark time.Time
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

func (s *Store) LoadUserByHandle(ctx context.Context, handle string) (userRecord, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
			u.id::text,
			COALESCE(u.public_handle, ''),
			u.display_name,
			u.avatar_url,
			u.bio,
			u.profile_visibility,
			COALESCE(ga.login, '')
		FROM users u
		LEFT JOIN github_accounts ga
			ON ga.user_id = u.id
			AND ga.link_status = 'linked'
		WHERE LOWER(COALESCE(u.public_handle, '')) = LOWER($1)
		ORDER BY ga.linked_at DESC NULLS LAST
		LIMIT 1
	`, strings.TrimSpace(handle))

	return scanUser(row)
}

func (s *Store) LoadUserByID(ctx context.Context, userID string) (userRecord, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
			u.id::text,
			COALESCE(u.public_handle, ''),
			u.display_name,
			u.avatar_url,
			u.bio,
			u.profile_visibility,
			COALESCE(ga.login, '')
		FROM users u
		LEFT JOIN github_accounts ga
			ON ga.user_id = u.id
			AND ga.link_status = 'linked'
		WHERE u.id = $1::uuid
		ORDER BY ga.linked_at DESC NULLS LAST
		LIMIT 1
	`, userID)

	return scanUser(row)
}

func scanUser(row pgx.Row) (userRecord, error) {
	var record userRecord
	if err := row.Scan(
		&record.ID,
		&record.Handle,
		&record.DisplayName,
		&record.AvatarURL,
		&record.Bio,
		&record.ProfileVisibility,
		&record.GitHubLogin,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return userRecord{}, ErrNotFound
		}
		return userRecord{}, err
	}
	return record, nil
}

func (s *Store) LoadSessionPrincipal(ctx context.Context, sessionTokenHash string, now time.Time) (sessionPrincipal, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT user_id::text, roles
		FROM auth_sessions
		WHERE session_token_hash = $1
		  AND invalidated_at IS NULL
		  AND expires_at > $2
		  AND idle_expires_at > $2
	`, sessionTokenHash, now.UTC())

	var principal sessionPrincipal
	if err := row.Scan(&principal.UserID, &principal.Roles); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return sessionPrincipal{}, ErrUnauthorized
		}
		return sessionPrincipal{}, err
	}
	return principal, nil
}

func (s *Store) LoadLatestScoreVersion(ctx context.Context, userID string) (string, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT COALESCE(score_version, '')
		FROM score_events
		WHERE user_id = $1::uuid
		ORDER BY created_at DESC
		LIMIT 1
	`, userID)

	var scoreVersion string
	if err := row.Scan(&scoreVersion); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return scoreVersion, nil
}

func (s *Store) LoadScoreRows(ctx context.Context, userID, scoreVersion string) ([]scoreRow, error) {
	if strings.TrimSpace(scoreVersion) == "" {
		return []scoreRow{}, nil
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			se.id::text,
			se.event_type,
			se.delta_total_xp,
			se.delta_skill_jsonb,
			se.explanation_jsonb,
			se.created_at,
			COALESCE(r.full_name, ''),
			COALESCE(r.owner_login, ''),
			COALESCE(r.name, ''),
			COALESCE(pr.number, 0),
			COALESCE(pr.title, ''),
			COALESCE(pr.merged, FALSE)
		FROM score_events se
		LEFT JOIN pull_requests pr ON pr.id = se.pull_request_id
		LEFT JOIN repositories r ON r.id = pr.repository_id
		WHERE se.user_id = $1::uuid
		  AND se.score_version = $2
		ORDER BY se.created_at DESC
	`, userID, scoreVersion)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]scoreRow, 0)
	for rows.Next() {
		var record scoreRow
		var skillsRaw []byte
		var explanationRaw []byte
		if err := rows.Scan(
			&record.EventID,
			&record.EventType,
			&record.DeltaXP,
			&skillsRaw,
			&explanationRaw,
			&record.CreatedAt,
			&record.Repository,
			&record.Owner,
			&record.Name,
			&record.PRNumber,
			&record.PRTitle,
			&record.PRMerged,
		); err != nil {
			return nil, err
		}
		record.Skills = decodeSkillMap(skillsRaw)
		record.Explanation = decodeExplanation(explanationRaw)
		out = append(out, record)
	}
	return out, rows.Err()
}

func (s *Store) LoadBadges(ctx context.Context, userID string) ([]badgeRecord, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT badge_key, awarded_at, evidence_jsonb
		FROM user_badges
		WHERE user_id = $1::uuid
		ORDER BY awarded_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]badgeRecord, 0)
	for rows.Next() {
		var record badgeRecord
		var evidenceRaw []byte
		if err := rows.Scan(&record.Key, &record.AwardedAt, &evidenceRaw); err != nil {
			return nil, err
		}
		record.Evidence = map[string]any{}
		if len(evidenceRaw) > 0 {
			_ = json.Unmarshal(evidenceRaw, &record.Evidence)
		}
		out = append(out, record)
	}
	return out, rows.Err()
}

func (s *Store) LoadProfileSettings(ctx context.Context, userID string) (profileSettingsRecord, error) {
	if _, err := s.pool.Exec(ctx, `
		INSERT INTO user_profile_settings (user_id)
		VALUES ($1::uuid)
		ON CONFLICT (user_id) DO NOTHING
	`, userID); err != nil {
		return profileSettingsRecord{}, err
	}

	row := s.pool.QueryRow(ctx, `
		SELECT
			COALESCE(u.profile_visibility, 'public'),
			ps.show_exact_prs,
			ps.show_ai_summaries,
			ps.show_leaderboard_participation,
			ps.updated_at
		FROM users u
		JOIN user_profile_settings ps ON ps.user_id = u.id
		WHERE u.id = $1::uuid
	`, userID)

	var visibility string
	var record profileSettingsRecord
	if err := row.Scan(
		&visibility,
		&record.Settings.ShowExactPRs,
		&record.Settings.ShowAISummaries,
		&record.Settings.ShowLeaderboardParticipation,
		&record.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return profileSettingsRecord{}, ErrNotFound
		}
		return profileSettingsRecord{}, err
	}
	record.Settings.PublicProfileEnabled = strings.EqualFold(visibility, "public")
	return record, nil
}

func (s *Store) UpdateProfileSettings(ctx context.Context, userID string, req contracts.UpdateProfilePrivacyRequest, now time.Time) (profileSettingsRecord, error) {
	settings, err := s.LoadProfileSettings(ctx, userID)
	if err != nil {
		return profileSettingsRecord{}, err
	}

	if req.PublicProfileEnabled != nil {
		visibility := "private"
		if *req.PublicProfileEnabled {
			visibility = "public"
		}
		if _, err := s.pool.Exec(ctx, `
			UPDATE users
			SET profile_visibility = $2,
			    updated_at = $3
			WHERE id = $1::uuid
		`, userID, visibility, now.UTC()); err != nil {
			return profileSettingsRecord{}, err
		}
		settings.Settings.PublicProfileEnabled = *req.PublicProfileEnabled
	}
	if req.ShowExactPRs != nil {
		settings.Settings.ShowExactPRs = *req.ShowExactPRs
	}
	if req.ShowAISummaries != nil {
		settings.Settings.ShowAISummaries = *req.ShowAISummaries
	}
	if req.ShowLeaderboardParticipation != nil {
		settings.Settings.ShowLeaderboardParticipation = *req.ShowLeaderboardParticipation
	}

	if _, err := s.pool.Exec(ctx, `
		UPDATE user_profile_settings
		SET show_exact_prs = $2,
		    show_ai_summaries = $3,
		    show_leaderboard_participation = $4,
		    updated_at = $5
		WHERE user_id = $1::uuid
	`, userID, settings.Settings.ShowExactPRs, settings.Settings.ShowAISummaries, settings.Settings.ShowLeaderboardParticipation, now.UTC()); err != nil {
		return profileSettingsRecord{}, err
	}

	return s.LoadProfileSettings(ctx, userID)
}

func (s *Store) LoadRepositoryVisibility(ctx context.Context, userID string) ([]repositoryVisibilityRecord, time.Time, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			rv.repository_id::text,
			r.full_name,
			rv.visibility,
			rv.reason,
			rv.updated_at
		FROM user_repository_visibility rv
		JOIN repositories r ON r.id = rv.repository_id
		WHERE rv.user_id = $1::uuid
		ORDER BY r.full_name ASC
	`, userID)
	if err != nil {
		return nil, time.Time{}, err
	}
	defer rows.Close()

	out := make([]repositoryVisibilityRecord, 0)
	var latest time.Time
	for rows.Next() {
		var record repositoryVisibilityRecord
		if err := rows.Scan(&record.RepositoryID, &record.FullName, &record.Visibility, &record.Reason, &record.UpdatedAt); err != nil {
			return nil, time.Time{}, err
		}
		if record.UpdatedAt.After(latest) {
			latest = record.UpdatedAt
		}
		out = append(out, record)
	}
	return out, latest, rows.Err()
}

func (s *Store) UpsertRepositoryVisibility(ctx context.Context, userID, fullName, visibility, reason string, now time.Time) (repositoryVisibilityRecord, error) {
	row := s.pool.QueryRow(ctx, `
		WITH repo AS (
			SELECT id, full_name
			FROM repositories
			WHERE LOWER(full_name) = LOWER($2)
		), upserted AS (
			INSERT INTO user_repository_visibility (user_id, repository_id, visibility, reason, updated_at)
			SELECT $1::uuid, repo.id, $3, $4, $5
			FROM repo
			ON CONFLICT (user_id, repository_id) DO UPDATE
			SET visibility = EXCLUDED.visibility,
			    reason = EXCLUDED.reason,
			    updated_at = EXCLUDED.updated_at
			RETURNING repository_id::text, visibility, reason, updated_at
		)
		SELECT upserted.repository_id, repo.full_name, upserted.visibility, upserted.reason, upserted.updated_at
		FROM upserted
		JOIN repo ON repo.id::text = upserted.repository_id
	`, userID, fullName, visibility, reason, now.UTC())

	var record repositoryVisibilityRecord
	if err := row.Scan(&record.RepositoryID, &record.FullName, &record.Visibility, &record.Reason, &record.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repositoryVisibilityRecord{}, ErrNotFound
		}
		return repositoryVisibilityRecord{}, err
	}
	return record, nil
}

func (s *Store) LoadLatestSnapshot(ctx context.Context, userID string) (snapshotRecord, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
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
			COALESCE(stale_after, refreshed_at),
			COALESCE(source_watermark, refreshed_at)
		FROM profile_snapshots
		WHERE user_id = $1::uuid
		ORDER BY refreshed_at DESC, created_at DESC
		LIMIT 1
	`, userID)

	var record snapshotRecord
	var summaryRaw, skillsRaw, badgesRaw, timelineRaw, reposRaw, historyRaw, cardRaw []byte
	if err := row.Scan(
		&record.ID,
		&record.UserID,
		&record.SnapshotVersion,
		&record.TotalXP,
		&record.LevelLabel,
		&summaryRaw,
		&skillsRaw,
		&badgesRaw,
		&timelineRaw,
		&reposRaw,
		&historyRaw,
		&cardRaw,
		&record.RefreshedAt,
		&record.StaleAfter,
		&record.SourceWatermark,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return snapshotRecord{}, ErrNotFound
		}
		return snapshotRecord{}, err
	}

	_ = json.Unmarshal(summaryRaw, &record.Summary)
	_ = json.Unmarshal(skillsRaw, &record.TopSkills)
	_ = json.Unmarshal(badgesRaw, &record.Badges)
	_ = json.Unmarshal(timelineRaw, &record.Timeline)
	_ = json.Unmarshal(reposRaw, &record.Repositories)
	_ = json.Unmarshal(historyRaw, &record.ScoreHistory)
	_ = json.Unmarshal(cardRaw, &record.ShareCard)
	return record, nil
}

func (s *Store) InsertSnapshot(ctx context.Context, userID string, snapshot snapshotRecord) (snapshotRecord, error) {
	payload := struct {
		summary  []byte
		skills   []byte
		badges   []byte
		timeline []byte
		repos    []byte
		history  []byte
		card     []byte
	}{}

	var err error
	if payload.summary, err = json.Marshal(snapshot.Summary); err != nil {
		return snapshotRecord{}, err
	}
	if payload.skills, err = json.Marshal(snapshot.TopSkills); err != nil {
		return snapshotRecord{}, err
	}
	if payload.badges, err = json.Marshal(snapshot.Badges); err != nil {
		return snapshotRecord{}, err
	}
	if payload.timeline, err = json.Marshal(snapshot.Timeline); err != nil {
		return snapshotRecord{}, err
	}
	if payload.repos, err = json.Marshal(snapshot.Repositories); err != nil {
		return snapshotRecord{}, err
	}
	if payload.history, err = json.Marshal(snapshot.ScoreHistory); err != nil {
		return snapshotRecord{}, err
	}
	if payload.card, err = json.Marshal(snapshot.ShareCard); err != nil {
		return snapshotRecord{}, err
	}

	row := s.pool.QueryRow(ctx, `
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
			created_at,
			refreshed_at,
			stale_after,
			source_watermark
		) VALUES (
			$1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $12, $13, $14
		)
		RETURNING id::text
	`, userID, snapshot.SnapshotVersion, snapshot.TotalXP, snapshot.LevelLabel, string(payload.skills), string(payload.badges), string(payload.timeline), string(payload.summary), string(payload.repos), string(payload.history), string(payload.card), snapshot.RefreshedAt.UTC(), snapshot.StaleAfter.UTC(), snapshot.SourceWatermark.UTC())
	if err := row.Scan(&snapshot.ID); err != nil {
		return snapshotRecord{}, err
	}
	snapshot.UserID = userID
	return snapshot, nil
}

func decodeSkillMap(raw []byte) map[string]int {
	if len(raw) == 0 {
		return map[string]int{}
	}

	var generic map[string]any
	if err := json.Unmarshal(raw, &generic); err != nil {
		return map[string]int{}
	}

	out := make(map[string]int, len(generic))
	for key, value := range generic {
		switch typed := value.(type) {
		case float64:
			out[key] = int(typed)
		case int:
			out[key] = typed
		case json.Number:
			number, _ := typed.Int64()
			out[key] = int(number)
		}
	}
	return out
}

func decodeExplanation(raw []byte) []string {
	if len(raw) == 0 {
		return nil
	}

	var lines []string
	if err := json.Unmarshal(raw, &lines); err == nil {
		return lines
	}

	var generic map[string]any
	if err := json.Unmarshal(raw, &generic); err == nil {
		out := make([]string, 0, len(generic))
		for key, value := range generic {
			out = append(out, fmt.Sprintf("%s=%v", key, value))
		}
		return out
	}

	var single string
	if err := json.Unmarshal(raw, &single); err == nil && strings.TrimSpace(single) != "" {
		return []string{single}
	}

	return nil
}
