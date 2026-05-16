package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

type replayCandidate struct {
	PullRequestID     string
	AnalysisID        string
	OccurredAt        time.Time
	AnalysisCreatedAt time.Time
	Repository        contracts.RepositoryContext
	PullRequest       contracts.PullRequestContext
	AnalyzerVersion   string
	PromptVersion     string
	ModelName         string
	AnalysisSource    string
	Classification    string
	Confidence        float64
	Summary           string
	SignalHints       []string
	AuthorLogin       string
	MergedByLogin     string
}

type replayCandidateFilter struct {
	Repository string
	From       time.Time
	To         time.Time
}

type scoreEventRecord struct {
	EventKey      string
	ScoreVersion  string
	EventType     string
	PullRequestID string
	AnalysisID    string
	DeltaXP       int
	SkillXP       map[string]int
	Explanation   []string
	Metadata      map[string]any
	CreatedAt     time.Time
	Suspicious    bool
	Repository    string
	PRNumber      int
	PRTitle       string
}

type badgeAward struct {
	Key       string
	AwardedAt time.Time
	Evidence  map[string]any
}

type replayRunRecord struct {
	ID               string
	UserID           string
	ScoreVersion     string
	TriggerType      string
	Status           string
	SourceWatermark  time.Time
	EventCount       int
	AggregateTotalXP int
	AggregateSkills  map[string]int
	CreatedAt        time.Time
}

type scoreSnapshotRecord struct {
	ID                string
	ReplayRunID       string
	UserID            string
	ScoreVersion      string
	TriggerType       string
	TotalXP           int
	Level             string
	RankTier          string
	TopSkills         []contracts.SkillAreaView
	BadgeKeys         []string
	ContributionCount int
	SuspiciousEvents  int
	SourceWatermark   time.Time
	ComputedAt        time.Time
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) Ping(ctx context.Context) error {
	if s == nil || s.pool == nil {
		return nil
	}
	return s.pool.Ping(ctx)
}

func (s *Store) EnsureUser(ctx context.Context, userID string) error {
	if s == nil || s.pool == nil {
		return ErrUnavailable
	}
	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users WHERE id = $1::uuid)`, userID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	return nil
}

func (s *Store) LoadReplayCandidates(ctx context.Context, userID string) ([]replayCandidate, error) {
	return s.LoadReplayCandidatesFiltered(ctx, userID, replayCandidateFilter{})
}

func (s *Store) LoadReplayCandidatesFiltered(ctx context.Context, userID string, filter replayCandidateFilter) ([]replayCandidate, error) {
	var from any
	if !filter.From.IsZero() {
		from = filter.From.UTC()
	}
	var to any
	if !filter.To.IsZero() {
		to = filter.To.UTC()
	}

	rows, err := s.pool.Query(ctx, `
		WITH replay_candidates AS (
			SELECT
				pr.*,
				r.full_name,
				r.primary_language,
				r.default_branch,
				r.stars_count,
				r.archived,
				COALESCE(pr.merged_at, pr.closed_at_source, pr.updated_at_source, pr.created_at_source) AS occurred_at
			FROM pull_requests pr
			INNER JOIN repositories r ON r.id = pr.repository_id
			INNER JOIN github_accounts ga ON ga.id = pr.author_github_account_id
			WHERE ga.user_id = $1::uuid
			  AND ga.link_status = 'linked'
			  AND r.is_private = FALSE
			  AND ($2 = '' OR LOWER(r.full_name) = LOWER($2))
			  AND ($3::timestamptz IS NULL OR COALESCE(pr.merged_at, pr.closed_at_source, pr.updated_at_source, pr.created_at_source) >= $3::timestamptz)
			  AND ($4::timestamptz IS NULL OR COALESCE(pr.merged_at, pr.closed_at_source, pr.updated_at_source, pr.created_at_source) <= $4::timestamptz)
		)
		SELECT
			pr.id::text,
			COALESCE(ca.id::text, ''),
			pr.occurred_at,
			COALESCE(ca.created_at, pr.occurred_at),
			r.full_name,
			COALESCE(r.primary_language, ''),
			COALESCE(r.default_branch, 'main'),
			r.stars_count,
			r.archived,
			pr.number,
			pr.title,
			COALESCE(pr.payload_jsonb->>'body', ''),
			COALESCE(pr.payload_jsonb #>> '{user,login}', ''),
			COALESCE(pr.payload_jsonb #>> '{merged_by,login}', ''),
			pr.state,
			pr.merged,
			pr.draft,
			pr.additions,
			pr.deletions,
			pr.changed_files,
			pr.commits,
			COALESCE(ca.analyzer_version, ''),
			COALESCE(ca.prompt_version, ''),
			COALESCE(ca.model_name, ''),
			COALESCE(ca.analysis_source, 'deterministic'),
			COALESCE(ca.classification, 'feature'),
			COALESCE(ca.confidence::float8, 0),
			COALESCE(ca.summary, ''),
			COALESCE(ca.signals_jsonb, '[]'::jsonb),
			COALESCE(files.files_jsonb, '[]'::jsonb),
			COALESCE(reviews.reviews_jsonb, '[]'::jsonb)
		FROM replay_candidates pr
		INNER JOIN repositories r ON r.id = pr.repository_id
		LEFT JOIN LATERAL (
			SELECT
				id,
				analyzer_version,
				prompt_version,
				model_name,
				analysis_source,
				classification,
				confidence,
				summary,
				signals_jsonb,
				created_at
			FROM contribution_analyses
			WHERE pull_request_id = pr.id
			ORDER BY created_at DESC
			LIMIT 1
		) ca ON true
		LEFT JOIN LATERAL (
			SELECT jsonb_agg(
				jsonb_build_object(
					'path', path,
					'additions', additions,
					'deletions', deletions,
					'status', status
				)
				ORDER BY path
			) AS files_jsonb
			FROM pull_request_files
			WHERE pull_request_id = pr.id
		) files ON true
		LEFT JOIN LATERAL (
			SELECT jsonb_agg(
				jsonb_build_object(
					'state', state,
					'author_association', COALESCE(payload_jsonb->>'author_association', '')
				)
				ORDER BY submitted_at_source NULLS LAST, id
			) AS reviews_jsonb
			FROM pull_request_reviews
			WHERE pull_request_id = pr.id
		) reviews ON true
		ORDER BY pr.occurred_at, pr.number
	`, userID, strings.TrimSpace(filter.Repository), from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]replayCandidate, 0)
	for rows.Next() {
		var candidate replayCandidate
		var signalRaw []byte
		var filesRaw []byte
		var reviewsRaw []byte
		if err := rows.Scan(
			&candidate.PullRequestID,
			&candidate.AnalysisID,
			&candidate.OccurredAt,
			&candidate.AnalysisCreatedAt,
			&candidate.Repository.FullName,
			&candidate.Repository.PrimaryLanguage,
			&candidate.Repository.DefaultBranch,
			&candidate.Repository.Stars,
			&candidate.Repository.Archived,
			&candidate.PullRequest.Number,
			&candidate.PullRequest.Title,
			&candidate.PullRequest.Body,
			&candidate.AuthorLogin,
			&candidate.MergedByLogin,
			&candidate.PullRequest.State,
			&candidate.PullRequest.Merged,
			&candidate.PullRequest.Draft,
			&candidate.PullRequest.Additions,
			&candidate.PullRequest.Deletions,
			&candidate.PullRequest.ChangedFiles,
			&candidate.PullRequest.Commits,
			&candidate.AnalyzerVersion,
			&candidate.PromptVersion,
			&candidate.ModelName,
			&candidate.AnalysisSource,
			&candidate.Classification,
			&candidate.Confidence,
			&candidate.Summary,
			&signalRaw,
			&filesRaw,
			&reviewsRaw,
		); err != nil {
			return nil, err
		}
		candidate.SignalHints = decodeSignals(signalRaw)
		candidate.PullRequest.Files = decodeFiles(filesRaw)
		candidate.PullRequest.Reviews = decodeReviews(reviewsRaw)
		out = append(out, candidate)
	}
	return out, rows.Err()
}

func (s *Store) SaveReplay(ctx context.Context, run replayRunRecord, events []scoreEventRecord, snapshot scoreSnapshotRecord, badges []badgeAward) (replayRunRecord, scoreSnapshotRecord, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return replayRunRecord{}, scoreSnapshotRecord{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	aggregateSkills, err := json.Marshal(run.AggregateSkills)
	if err != nil {
		return replayRunRecord{}, scoreSnapshotRecord{}, err
	}
	if err := tx.QueryRow(ctx, `
		INSERT INTO score_replay_runs (
			user_id,
			score_version,
			trigger_type,
			status,
			source_watermark,
			event_count,
			aggregate_total_xp,
			aggregate_skill_jsonb,
			created_at
		) VALUES (
			$1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9
		)
		RETURNING id::text
	`, run.UserID, run.ScoreVersion, run.TriggerType, run.Status, run.SourceWatermark.UTC(), run.EventCount, run.AggregateTotalXP, string(aggregateSkills), run.CreatedAt.UTC()).Scan(&run.ID); err != nil {
		return replayRunRecord{}, scoreSnapshotRecord{}, err
	}

	for _, event := range events {
		skillJSON, err := json.Marshal(event.SkillXP)
		if err != nil {
			return replayRunRecord{}, scoreSnapshotRecord{}, err
		}
		explanationJSON, err := json.Marshal(map[string]any{"summary": event.Explanation})
		if err != nil {
			return replayRunRecord{}, scoreSnapshotRecord{}, err
		}
		metadataJSON, err := json.Marshal(event.Metadata)
		if err != nil {
			return replayRunRecord{}, scoreSnapshotRecord{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO score_events (
				user_id,
				pull_request_id,
				analysis_id,
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
				NULLIF($2, '')::uuid,
				NULLIF($3, '')::uuid,
				$4::uuid,
				$5,
				$6,
				$7,
				$8,
				$9::jsonb,
				$10::jsonb,
				$11::jsonb,
				$12
			)
		`, run.UserID, event.PullRequestID, event.AnalysisID, run.ID, event.EventKey, event.ScoreVersion, event.EventType, event.DeltaXP, string(skillJSON), string(explanationJSON), string(metadataJSON), event.CreatedAt.UTC()); err != nil {
			return replayRunRecord{}, scoreSnapshotRecord{}, err
		}
	}

	topSkills, err := json.Marshal(snapshot.TopSkills)
	if err != nil {
		return replayRunRecord{}, scoreSnapshotRecord{}, err
	}
	badgeKeys, err := json.Marshal(snapshot.BadgeKeys)
	if err != nil {
		return replayRunRecord{}, scoreSnapshotRecord{}, err
	}
	if err := tx.QueryRow(ctx, `
		INSERT INTO score_snapshots (
			replay_run_id,
			user_id,
			score_version,
			total_xp,
			level,
			rank_tier,
			top_skills_jsonb,
			badge_keys_jsonb,
			contribution_count,
			suspicious_events,
			created_at
		) VALUES (
			$1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11
		)
		RETURNING id::text
	`, run.ID, run.UserID, snapshot.ScoreVersion, snapshot.TotalXP, snapshot.Level, snapshot.RankTier, string(topSkills), string(badgeKeys), snapshot.ContributionCount, snapshot.SuspiciousEvents, snapshot.ComputedAt.UTC()).Scan(&snapshot.ID); err != nil {
		return replayRunRecord{}, scoreSnapshotRecord{}, err
	}
	snapshot.ReplayRunID = run.ID

	if _, err := tx.Exec(ctx, `
		DELETE FROM user_badges
		WHERE user_id = $1::uuid
		  AND COALESCE(evidence_jsonb->>'issuer', '') = 'scoring-engine'
	`, run.UserID); err != nil {
		return replayRunRecord{}, scoreSnapshotRecord{}, err
	}
	for _, badge := range badges {
		evidenceJSON, err := json.Marshal(badge.Evidence)
		if err != nil {
			return replayRunRecord{}, scoreSnapshotRecord{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO user_badges (
				user_id,
				badge_key,
				awarded_at,
				evidence_jsonb
			) VALUES (
				$1::uuid, $2, $3, $4::jsonb
			)
			ON CONFLICT (user_id, badge_key) DO UPDATE
			SET awarded_at = EXCLUDED.awarded_at,
				evidence_jsonb = EXCLUDED.evidence_jsonb
		`, run.UserID, badge.Key, badge.AwardedAt.UTC(), string(evidenceJSON)); err != nil {
			return replayRunRecord{}, scoreSnapshotRecord{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return replayRunRecord{}, scoreSnapshotRecord{}, err
	}
	return run, snapshot, nil
}

func (s *Store) LoadLatestReplayRun(ctx context.Context, userID string) (replayRunRecord, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
			id::text,
			user_id::text,
			score_version,
			trigger_type,
			status,
			source_watermark,
			event_count,
			aggregate_total_xp,
			aggregate_skill_jsonb,
			created_at
		FROM score_replay_runs
		WHERE user_id = $1::uuid
		  AND status = 'completed'
		ORDER BY created_at DESC
		LIMIT 1
	`, userID)

	var run replayRunRecord
	var skillRaw []byte
	if err := row.Scan(
		&run.ID,
		&run.UserID,
		&run.ScoreVersion,
		&run.TriggerType,
		&run.Status,
		&run.SourceWatermark,
		&run.EventCount,
		&run.AggregateTotalXP,
		&skillRaw,
		&run.CreatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return replayRunRecord{}, ErrNotFound
		}
		return replayRunRecord{}, err
	}
	_ = json.Unmarshal(skillRaw, &run.AggregateSkills)
	return run, nil
}

func (s *Store) LoadLatestSnapshot(ctx context.Context, userID string) (replayRunRecord, scoreSnapshotRecord, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			s.id::text,
			s.replay_run_id::text,
			s.user_id::text,
			s.score_version,
			s.total_xp,
			s.level,
			s.rank_tier,
			s.top_skills_jsonb,
			s.badge_keys_jsonb,
			s.contribution_count,
			s.suspicious_events,
			s.created_at,
			r.trigger_type,
			r.source_watermark
		FROM score_snapshots s
		INNER JOIN score_replay_runs r ON r.id = s.replay_run_id
		WHERE s.user_id = $1::uuid
		ORDER BY s.created_at DESC
		LIMIT 1
	`, userID)
	if err != nil {
		return replayRunRecord{}, scoreSnapshotRecord{}, err
	}
	defer rows.Close()

	if !rows.Next() {
		return replayRunRecord{}, scoreSnapshotRecord{}, ErrNotFound
	}
	var snapshot scoreSnapshotRecord
	var run replayRunRecord
	var skillsRaw []byte
	var badgeKeysRaw []byte
	if err := rows.Scan(
		&snapshot.ID,
		&snapshot.ReplayRunID,
		&snapshot.UserID,
		&snapshot.ScoreVersion,
		&snapshot.TotalXP,
		&snapshot.Level,
		&snapshot.RankTier,
		&skillsRaw,
		&badgeKeysRaw,
		&snapshot.ContributionCount,
		&snapshot.SuspiciousEvents,
		&snapshot.ComputedAt,
		&run.TriggerType,
		&run.SourceWatermark,
	); err != nil {
		return replayRunRecord{}, scoreSnapshotRecord{}, err
	}
	run.ID = snapshot.ReplayRunID
	run.UserID = snapshot.UserID
	run.ScoreVersion = snapshot.ScoreVersion
	_ = json.Unmarshal(skillsRaw, &snapshot.TopSkills)
	_ = json.Unmarshal(badgeKeysRaw, &snapshot.BadgeKeys)
	snapshot.SourceWatermark = run.SourceWatermark.UTC()
	return run, snapshot, rows.Err()
}

func (s *Store) LoadEventsForReplayRun(ctx context.Context, replayRunID string) ([]contracts.ScoreEventView, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			se.id::text,
			se.event_key,
			se.replay_run_id::text,
			se.score_version,
			se.event_type,
			se.delta_total_xp,
			se.delta_skill_jsonb,
			se.explanation_jsonb,
			se.metadata_jsonb,
			se.created_at,
			COALESCE(r.full_name, ''),
			COALESCE(pr.number, 0),
			COALESCE(pr.title, '')
		FROM score_events se
		LEFT JOIN pull_requests pr ON pr.id = se.pull_request_id
		LEFT JOIN repositories r ON r.id = pr.repository_id
		WHERE se.replay_run_id = $1::uuid
		ORDER BY se.created_at DESC, se.id DESC
	`, replayRunID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]contracts.ScoreEventView, 0)
	for rows.Next() {
		var event contracts.ScoreEventView
		var skillRaw []byte
		var explanationRaw []byte
		var metadataRaw []byte
		var repository string
		var prNumber int
		var prTitle string
		if err := rows.Scan(
			&event.EventID,
			&event.EventKey,
			&event.ReplayRunID,
			&event.ScoreVersion,
			&event.EventType,
			&event.DeltaXP,
			&skillRaw,
			&explanationRaw,
			&metadataRaw,
			&event.CreatedAt,
			&repository,
			&prNumber,
			&prTitle,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(skillRaw, &event.SkillXP)
		event.Explanation = decodeExplanation(explanationRaw)
		event.Suspicious = decodeSuspicious(metadataRaw)
		if repository != "" && prNumber > 0 {
			event.PullRequest = &contracts.PullRequestReference{
				Repository: repository,
				Number:     prNumber,
				Title:      prTitle,
			}
		}
		out = append(out, event)
	}
	return out, rows.Err()
}

func decodeSignals(raw []byte) []string {
	if len(raw) == 0 {
		return nil
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err == nil {
		return trimStrings(values)
	}
	return nil
}

func decodeFiles(raw []byte) []contracts.ChangedFile {
	if len(raw) == 0 {
		return nil
	}
	var files []contracts.ChangedFile
	if err := json.Unmarshal(raw, &files); err == nil {
		return files
	}
	return nil
}

func decodeReviews(raw []byte) []contracts.ReviewSignal {
	if len(raw) == 0 {
		return nil
	}
	var reviews []contracts.ReviewSignal
	if err := json.Unmarshal(raw, &reviews); err == nil {
		return reviews
	}
	return nil
}

func decodeExplanation(raw []byte) []string {
	if len(raw) == 0 {
		return nil
	}
	var payload struct {
		Summary []string `json:"summary"`
	}
	if err := json.Unmarshal(raw, &payload); err == nil && len(payload.Summary) > 0 {
		return payload.Summary
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err == nil {
		return values
	}
	return nil
}

func decodeSuspicious(raw []byte) bool {
	if len(raw) == 0 {
		return false
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return false
	}
	value, ok := payload["suspicious"].(bool)
	return ok && value
}

func trimStrings(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
