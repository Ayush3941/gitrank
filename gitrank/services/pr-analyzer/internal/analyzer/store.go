package analyzer

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

var ErrPullRequestNotFound = errors.New("pull request evidence not found")

type Store struct {
	pool *pgxpool.Pool
}

type PersistedAnalysis struct {
	ID            string
	PullRequestID string
	CreatedAt     time.Time
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) Ready(ctx context.Context) error {
	if s == nil || s.pool == nil {
		return errors.New("analysis store is not configured")
	}
	return s.pool.Ping(ctx)
}

func (s *Store) LoadPullRequestAnalysisRequest(ctx context.Context, repository string, number int) (contracts.PullRequestAnalysisRequest, error) {
	if s == nil || s.pool == nil {
		return contracts.PullRequestAnalysisRequest{}, errors.New("analysis store is not configured")
	}

	var req contracts.PullRequestAnalysisRequest
	var filesRaw []byte
	var reviewsRaw []byte
	if err := s.pool.QueryRow(ctx, `
		SELECT
			r.full_name,
			COALESCE(r.primary_language, ''),
			COALESCE(r.default_branch, ''),
			COALESCE(r.stars_count, 0),
			COALESCE(r.archived, false),
			pr.number,
			pr.title,
			COALESCE(pr.payload_jsonb->>'body', ''),
			pr.state,
			pr.merged,
			pr.draft,
			pr.additions,
			pr.deletions,
			pr.changed_files,
			pr.commits,
			COALESCE(files.files_jsonb, '[]'::jsonb),
			COALESCE(reviews.reviews_jsonb, '[]'::jsonb)
		FROM pull_requests pr
		INNER JOIN repositories r ON r.id = pr.repository_id
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
		WHERE lower(r.full_name) = lower($1)
		  AND pr.number = $2
	`,
		strings.TrimSpace(repository),
		number,
	).Scan(
		&req.Repository.FullName,
		&req.Repository.PrimaryLanguage,
		&req.Repository.DefaultBranch,
		&req.Repository.Stars,
		&req.Repository.Archived,
		&req.PullRequest.Number,
		&req.PullRequest.Title,
		&req.PullRequest.Body,
		&req.PullRequest.State,
		&req.PullRequest.Merged,
		&req.PullRequest.Draft,
		&req.PullRequest.Additions,
		&req.PullRequest.Deletions,
		&req.PullRequest.ChangedFiles,
		&req.PullRequest.Commits,
		&filesRaw,
		&reviewsRaw,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return contracts.PullRequestAnalysisRequest{}, ErrPullRequestNotFound
		}
		return contracts.PullRequestAnalysisRequest{}, err
	}

	req.PullRequest.Files = decodeChangedFiles(filesRaw)
	req.PullRequest.Reviews = decodeReviewSignals(reviewsRaw)
	if err := req.Validate(); err != nil {
		return contracts.PullRequestAnalysisRequest{}, err
	}
	return req, nil
}

func (s *Store) SavePullRequestAnalysis(ctx context.Context, req contracts.PullRequestAnalysisRequest, resp contracts.PullRequestAnalysisResponse, now time.Time) (PersistedAnalysis, error) {
	if s == nil || s.pool == nil {
		return PersistedAnalysis{}, errors.New("analysis store is not configured")
	}
	if err := req.Validate(); err != nil {
		return PersistedAnalysis{}, err
	}
	canonical := resp.Canonicalized()
	if err := canonical.Validate(); err != nil {
		return PersistedAnalysis{}, err
	}

	signals, err := json.Marshal(canonical.Signals)
	if err != nil {
		return PersistedAnalysis{}, err
	}
	if len(canonical.Signals) == 0 {
		signals = []byte("[]")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return PersistedAnalysis{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var pullRequestID string
	if err := tx.QueryRow(ctx, `
		SELECT pr.id::text
		FROM pull_requests pr
		INNER JOIN repositories r ON r.id = pr.repository_id
		WHERE lower(r.full_name) = lower($1)
		  AND pr.number = $2
	`, strings.TrimSpace(req.Repository.FullName), req.PullRequest.Number).Scan(&pullRequestID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PersistedAnalysis{}, ErrPullRequestNotFound
		}
		return PersistedAnalysis{}, err
	}

	lockKey := strings.Join([]string{
		pullRequestID,
		strings.TrimSpace(canonical.AnalyzerVersion),
		strings.TrimSpace(canonical.PromptVersion),
		strings.TrimSpace(canonical.ModelName),
		strings.TrimSpace(canonical.AnalysisSource),
	}, "|")
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, "contribution_analyses", lockKey); err != nil {
		return PersistedAnalysis{}, err
	}

	persisted, err := updateLatestAnalysis(ctx, tx, pullRequestID, canonical, signals, now.UTC())
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return PersistedAnalysis{}, err
		}
		return persisted, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return PersistedAnalysis{}, err
	}

	persisted, err = insertAnalysis(ctx, tx, pullRequestID, canonical, signals, now.UTC())
	if err != nil {
		return PersistedAnalysis{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return PersistedAnalysis{}, err
	}
	return persisted, nil
}

func decodeChangedFiles(raw []byte) []contracts.ChangedFile {
	if len(raw) == 0 {
		return nil
	}
	var files []contracts.ChangedFile
	if err := json.Unmarshal(raw, &files); err != nil {
		return nil
	}
	return files
}

func decodeReviewSignals(raw []byte) []contracts.ReviewSignal {
	if len(raw) == 0 {
		return nil
	}
	var reviews []contracts.ReviewSignal
	if err := json.Unmarshal(raw, &reviews); err != nil {
		return nil
	}
	return reviews
}

func updateLatestAnalysis(ctx context.Context, tx pgx.Tx, pullRequestID string, analysis contracts.PullRequestAnalysisResponse, signals []byte, now time.Time) (PersistedAnalysis, error) {
	var persisted PersistedAnalysis
	err := tx.QueryRow(ctx, `
		UPDATE contribution_analyses
		SET classification = $6,
		    confidence = $7,
		    summary = $8,
		    signals_jsonb = $9::jsonb,
		    created_at = $10
		WHERE id = (
			SELECT id
			FROM contribution_analyses
			WHERE pull_request_id = $1::uuid
			  AND analyzer_version = $2
			  AND prompt_version = $3
			  AND model_name = $4
			  AND analysis_source = $5
			ORDER BY created_at DESC, id DESC
			LIMIT 1
		)
		RETURNING id::text, pull_request_id::text, created_at
	`,
		pullRequestID,
		strings.TrimSpace(analysis.AnalyzerVersion),
		strings.TrimSpace(analysis.PromptVersion),
		strings.TrimSpace(analysis.ModelName),
		strings.TrimSpace(analysis.AnalysisSource),
		strings.TrimSpace(analysis.Category),
		analysis.Confidence,
		strings.TrimSpace(analysis.Summary),
		string(signals),
		now,
	).Scan(&persisted.ID, &persisted.PullRequestID, &persisted.CreatedAt)
	return persisted, err
}

func insertAnalysis(ctx context.Context, tx pgx.Tx, pullRequestID string, analysis contracts.PullRequestAnalysisResponse, signals []byte, now time.Time) (PersistedAnalysis, error) {
	var persisted PersistedAnalysis
	err := tx.QueryRow(ctx, `
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
			$1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10
		)
		RETURNING id::text, pull_request_id::text, created_at
	`,
		pullRequestID,
		strings.TrimSpace(analysis.AnalyzerVersion),
		strings.TrimSpace(analysis.PromptVersion),
		strings.TrimSpace(analysis.ModelName),
		strings.TrimSpace(analysis.AnalysisSource),
		strings.TrimSpace(analysis.Category),
		analysis.Confidence,
		strings.TrimSpace(analysis.Summary),
		string(signals),
		now,
	).Scan(&persisted.ID, &persisted.PullRequestID, &persisted.CreatedAt)
	return persisted, err
}
