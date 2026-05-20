package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5"
)

const pullRequestReportVersion = "pr-report/v1"

type pullRequestReportRecord struct {
	PullRequestID      string
	Owner              string
	Repo               string
	FullName           string
	Stars              int
	Number             int
	Title              string
	Body               string
	State              string
	Merged             bool
	Additions          int
	Deletions          int
	ChangedFiles       int
	OccurredAt         time.Time
	UpdatedAt          time.Time
	AnalysisID         string
	AnalysisVersion    string
	AnalysisSource     string
	Category           string
	AIConfidence       float64
	Summary            string
	AnalysisSignals    []string
	ScoreEventID       string
	ScoreVersion       string
	XP                 int
	ScoreExplanation   []string
	ScoreMetadata      map[string]any
	BadgeUnlocks       []badgeUnlockRecord
	FileCount          int
	FeatureCount       int
	TestFiles          int
	DocsFiles          int
	ReviewCount        int
	ApprovalCount      int
	ChangesRequested   int
	ReviewCommentCount int
}

type badgeUnlockRecord struct {
	Key       string
	AwardedAt time.Time
	Evidence  map[string]any
}

type pullRequestReportSnapshotRecord struct {
	ID              string
	ReportVersion   string
	ScoreEventID    string
	AnalysisID      string
	ScoreVersion    string
	AnalysisVersion string
	EvidenceStatus  string
	IsStale         bool
	SourceUpdatedAt time.Time
	GeneratedAt     time.Time
}

type pullRequestReportBackfillTarget struct {
	Owner  string
	Repo   string
	Number int
}

func (s *Service) PublicPullRequestReport(ctx context.Context, owner, repo string, number int, now time.Time) (contracts.PullRequestReportResponse, error) {
	if strings.TrimSpace(owner) == "" || strings.TrimSpace(repo) == "" || number <= 0 {
		return contracts.PullRequestReportResponse{}, ErrInvalidRequest
	}
	record, err := s.store.LoadPullRequestReport(ctx, owner, repo, number)
	if err != nil {
		return contracts.PullRequestReportResponse{}, err
	}
	return pullRequestReportFromRecord(record, now.UTC()), nil
}

func (s *Service) MaterializePullRequestReport(ctx context.Context, owner, repo string, number int, now time.Time) (contracts.PullRequestReportMaterializationResponse, error) {
	if strings.TrimSpace(owner) == "" || strings.TrimSpace(repo) == "" || number <= 0 {
		return contracts.PullRequestReportMaterializationResponse{}, ErrInvalidRequest
	}

	now = now.UTC()
	record, err := s.store.LoadPullRequestReport(ctx, owner, repo, number)
	if err != nil {
		return contracts.PullRequestReportMaterializationResponse{}, err
	}
	report := pullRequestReportFromRecord(record, now)
	snapshot, err := s.store.SavePullRequestReportSnapshot(ctx, record, report, now)
	if err != nil {
		return contracts.PullRequestReportMaterializationResponse{}, err
	}
	return pullRequestReportMaterializationResponse(record, snapshot, report), nil
}

func (s *Service) BackfillPullRequestReportsForUser(ctx context.Context, userID string, limit int, now time.Time) (contracts.PullRequestReportBackfillResponse, error) {
	userID, err := contracts.NormalizeUUID(userID, "user_id")
	if err != nil {
		return contracts.PullRequestReportBackfillResponse{}, ErrInvalidRequest
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	now = now.UTC()
	targets, err := s.store.ListPullRequestReportBackfillTargets(ctx, userID, limit)
	if err != nil {
		return contracts.PullRequestReportBackfillResponse{}, err
	}

	snapshotIDs := make([]string, 0, len(targets))
	skipped := 0
	for _, target := range targets {
		materialized, err := s.MaterializePullRequestReport(ctx, target.Owner, target.Repo, target.Number, now)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				skipped++
				continue
			}
			return contracts.PullRequestReportBackfillResponse{}, err
		}
		if strings.TrimSpace(materialized.ReportSnapshotID) == "" {
			skipped++
			continue
		}
		snapshotIDs = append(snapshotIDs, materialized.ReportSnapshotID)
	}

	return contracts.PullRequestReportBackfillResponse{
		Status:            "backfilled",
		UserID:            userID,
		Considered:        len(targets),
		Materialized:      len(snapshotIDs),
		Skipped:           skipped,
		ReportSnapshotIDs: snapshotIDs,
		GeneratedAt:       now,
	}, nil
}

func (s *Store) LoadPullRequestReport(ctx context.Context, owner, repo string, number int) (pullRequestReportRecord, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
			pr.id::text,
			r.owner_login,
			r.name,
			r.full_name,
			r.stars_count,
			pr.number,
			pr.title,
			COALESCE(pr.payload_jsonb->>'body', ''),
			pr.state,
			pr.merged,
			pr.additions,
			pr.deletions,
			pr.changed_files,
			COALESCE(pr.merged_at, pr.closed_at_source, pr.updated_at_source, pr.created_at_source),
			pr.updated_at_source,
			COALESCE(ca.id::text, ''),
			COALESCE(ca.analyzer_version, ''),
			COALESCE(ca.analysis_source, ''),
			COALESCE(ca.classification, ''),
			COALESCE(ca.confidence::float8, 0),
			COALESCE(ca.summary, ''),
			COALESCE(ca.signals_jsonb, '[]'::jsonb),
			COALESCE(se.id::text, ''),
			COALESCE(se.score_version, ''),
			COALESCE(se.delta_total_xp, 0),
			COALESCE(se.explanation_jsonb, '[]'::jsonb),
			COALESCE(se.metadata_jsonb, '{}'::jsonb),
			COALESCE(badges.badge_unlocks_jsonb, '[]'::jsonb),
			COALESCE(files.file_count, 0),
			COALESCE(files.feature_count, 0),
			COALESCE(files.test_files, 0),
			COALESCE(files.docs_files, 0),
			COALESCE(reviews.review_count, 0),
			COALESCE(reviews.approval_count, 0),
			COALESCE(reviews.changes_requested_count, 0),
			COALESCE(review_comments.comment_count, 0)
		FROM repositories r
		INNER JOIN pull_requests pr ON pr.repository_id = r.id
		LEFT JOIN github_accounts author_ga ON author_ga.id = pr.author_github_account_id
		LEFT JOIN LATERAL (
			SELECT id, analyzer_version, analysis_source, classification, confidence, summary, signals_jsonb
			FROM contribution_analyses
			WHERE pull_request_id = pr.id
			ORDER BY created_at DESC
			LIMIT 1
		) ca ON true
		LEFT JOIN LATERAL (
			SELECT id, score_version, delta_total_xp, explanation_jsonb, metadata_jsonb
			FROM score_events
			WHERE pull_request_id = pr.id
			ORDER BY created_at DESC
			LIMIT 1
		) se ON true
		LEFT JOIN LATERAL (
			SELECT jsonb_agg(
				jsonb_build_object(
					'key', ub.badge_key,
					'awarded_at', ub.awarded_at,
					'evidence', ub.evidence_jsonb
				)
				ORDER BY ub.awarded_at DESC, ub.badge_key
			) AS badge_unlocks_jsonb
			FROM user_badges ub
			WHERE author_ga.user_id IS NOT NULL
			  AND ub.user_id = author_ga.user_id
			  AND COALESCE(ub.evidence_jsonb->'evidence_pr_ids', '[]'::jsonb) ? pr.id::text
		) badges ON true
		LEFT JOIN LATERAL (
			SELECT
				COUNT(*)::int AS file_count,
				COUNT(*) FILTER (WHERE feature_jsonb <> '{}'::jsonb)::int AS feature_count,
				COUNT(*) FILTER (WHERE path ~* '(^|/)(test|tests|__tests__)/|(_test\.|\.test\.|\.spec\.)')::int AS test_files,
				COUNT(*) FILTER (WHERE path ~* '(^|/)(docs?|documentation)/|\.md$|\.mdx$')::int AS docs_files
			FROM pull_request_files
			WHERE pull_request_id = pr.id
		) files ON true
		LEFT JOIN LATERAL (
			SELECT
				COUNT(*)::int AS review_count,
				COUNT(*) FILTER (WHERE UPPER(state) = 'APPROVED')::int AS approval_count,
				COUNT(*) FILTER (WHERE UPPER(state) = 'CHANGES_REQUESTED')::int AS changes_requested_count
			FROM pull_request_reviews
			WHERE pull_request_id = pr.id
		) reviews ON true
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS comment_count
			FROM pull_request_review_comments
			WHERE pull_request_id = pr.id
		) review_comments ON true
		WHERE LOWER(r.owner_login) = LOWER($1)
		  AND LOWER(r.name) = LOWER($2)
		  AND pr.number = $3
		  AND r.is_private = FALSE
	`, owner, repo, number)

	record, err := scanPullRequestReport(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return pullRequestReportRecord{}, ErrNotFound
		}
		return pullRequestReportRecord{}, err
	}
	return record, nil
}

func (s *Store) ListPullRequestReportBackfillTargets(ctx context.Context, userID string, limit int) ([]pullRequestReportBackfillTarget, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			r.owner_login,
			r.name,
			pr.number
		FROM score_events se
		INNER JOIN pull_requests pr ON pr.id = se.pull_request_id
		INNER JOIN repositories r ON r.id = pr.repository_id
		WHERE se.user_id = $1::uuid
		  AND se.pull_request_id IS NOT NULL
		  AND r.is_private = FALSE
		GROUP BY r.owner_login, r.name, pr.number
		ORDER BY MAX(se.created_at) DESC, r.owner_login, r.name, pr.number
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	targets := make([]pullRequestReportBackfillTarget, 0)
	for rows.Next() {
		var target pullRequestReportBackfillTarget
		if err := rows.Scan(&target.Owner, &target.Repo, &target.Number); err != nil {
			return nil, err
		}
		targets = append(targets, target)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return targets, nil
}

func (s *Store) LoadRecentPullRequestReportsForUser(ctx context.Context, userID string, limit int) ([]pullRequestReportRecord, error) {
	if limit <= 0 {
		limit = 4
	}
	if limit > 10 {
		limit = 10
	}

	selection, err := s.LoadLatestScoreSelection(ctx, userID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(selection.ScoreVersion) == "" {
		return []pullRequestReportRecord{}, nil
	}

	scoreFilter := "se.score_version = $2"
	args := []any{userID, selection.ScoreVersion, limit}
	if strings.TrimSpace(selection.ReplayRunID) != "" {
		scoreFilter = "se.replay_run_id = $2::uuid"
		args[1] = selection.ReplayRunID
	}

	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
		WITH selected_score_events AS (
			SELECT DISTINCT ON (se.pull_request_id)
				se.id,
				se.pull_request_id,
				se.score_version,
				se.delta_total_xp,
				se.explanation_jsonb,
				se.metadata_jsonb,
				se.created_at
			FROM score_events se
			WHERE se.user_id = $1::uuid
			  AND se.pull_request_id IS NOT NULL
			  AND %s
			ORDER BY se.pull_request_id, se.created_at DESC
		),
		recent_score_events AS (
			SELECT *
			FROM selected_score_events
			ORDER BY created_at DESC
			LIMIT $3
		)
		SELECT
			pr.id::text,
			r.owner_login,
			r.name,
			r.full_name,
			r.stars_count,
			pr.number,
			pr.title,
			COALESCE(pr.payload_jsonb->>'body', ''),
			pr.state,
			pr.merged,
			pr.additions,
			pr.deletions,
			pr.changed_files,
			COALESCE(pr.merged_at, pr.closed_at_source, pr.updated_at_source, pr.created_at_source),
			pr.updated_at_source,
			COALESCE(ca.id::text, ''),
			COALESCE(ca.analyzer_version, ''),
			COALESCE(ca.analysis_source, ''),
			COALESCE(ca.classification, ''),
			COALESCE(ca.confidence::float8, 0),
			COALESCE(ca.summary, ''),
			COALESCE(ca.signals_jsonb, '[]'::jsonb),
			se.id::text,
			COALESCE(se.score_version, ''),
			COALESCE(se.delta_total_xp, 0),
			COALESCE(se.explanation_jsonb, '[]'::jsonb),
			COALESCE(se.metadata_jsonb, '{}'::jsonb),
			COALESCE(badges.badge_unlocks_jsonb, '[]'::jsonb),
			COALESCE(files.file_count, 0),
			COALESCE(files.feature_count, 0),
			COALESCE(files.test_files, 0),
			COALESCE(files.docs_files, 0),
			COALESCE(reviews.review_count, 0),
			COALESCE(reviews.approval_count, 0),
			COALESCE(reviews.changes_requested_count, 0),
			COALESCE(review_comments.comment_count, 0)
		FROM recent_score_events se
		INNER JOIN pull_requests pr ON pr.id = se.pull_request_id
		INNER JOIN repositories r ON r.id = pr.repository_id
		LEFT JOIN github_accounts author_ga ON author_ga.id = pr.author_github_account_id
		LEFT JOIN LATERAL (
			SELECT id, analyzer_version, analysis_source, classification, confidence, summary, signals_jsonb
			FROM contribution_analyses
			WHERE pull_request_id = pr.id
			ORDER BY created_at DESC
			LIMIT 1
		) ca ON true
		LEFT JOIN LATERAL (
			SELECT jsonb_agg(
				jsonb_build_object(
					'key', ub.badge_key,
					'awarded_at', ub.awarded_at,
					'evidence', ub.evidence_jsonb
				)
				ORDER BY ub.awarded_at DESC, ub.badge_key
			) AS badge_unlocks_jsonb
			FROM user_badges ub
			WHERE author_ga.user_id IS NOT NULL
			  AND ub.user_id = author_ga.user_id
			  AND COALESCE(ub.evidence_jsonb->'evidence_pr_ids', '[]'::jsonb) ? pr.id::text
		) badges ON true
		LEFT JOIN LATERAL (
			SELECT
				COUNT(*)::int AS file_count,
				COUNT(*) FILTER (WHERE feature_jsonb <> '{}'::jsonb)::int AS feature_count,
				COUNT(*) FILTER (WHERE path ~* '(^|/)(test|tests|__tests__)/|(_test\.|\.test\.|\.spec\.)')::int AS test_files,
				COUNT(*) FILTER (WHERE path ~* '(^|/)(docs?|documentation)/|\.md$|\.mdx$')::int AS docs_files
			FROM pull_request_files
			WHERE pull_request_id = pr.id
		) files ON true
		LEFT JOIN LATERAL (
			SELECT
				COUNT(*)::int AS review_count,
				COUNT(*) FILTER (WHERE UPPER(state) = 'APPROVED')::int AS approval_count,
				COUNT(*) FILTER (WHERE UPPER(state) = 'CHANGES_REQUESTED')::int AS changes_requested_count
			FROM pull_request_reviews
			WHERE pull_request_id = pr.id
		) reviews ON true
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS comment_count
			FROM pull_request_review_comments
			WHERE pull_request_id = pr.id
		) review_comments ON true
		WHERE r.is_private = FALSE
		ORDER BY se.created_at DESC
	`, scoreFilter), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := make([]pullRequestReportRecord, 0, limit)
	for rows.Next() {
		record, err := scanPullRequestReport(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
}

func (s *Store) SavePullRequestReportSnapshot(ctx context.Context, record pullRequestReportRecord, report contracts.PullRequestReportResponse, now time.Time) (pullRequestReportSnapshotRecord, error) {
	pullRequestID := strings.TrimSpace(record.PullRequestID)
	if pullRequestID == "" {
		return pullRequestReportSnapshotRecord{}, ErrInvalidRequest
	}

	now = now.UTC()
	if now.IsZero() {
		now = time.Now().UTC()
	}

	generatedAt := report.GeneratedAt.UTC()
	if generatedAt.IsZero() {
		generatedAt = now
		report.GeneratedAt = generatedAt
	}

	sourceUpdatedAt := report.SourceUpdatedAt.UTC()
	if sourceUpdatedAt.IsZero() {
		sourceUpdatedAt = latestTime(record.UpdatedAt, record.OccurredAt).UTC()
	}
	if sourceUpdatedAt.IsZero() {
		sourceUpdatedAt = generatedAt
	}

	report.SourceUpdatedAt = sourceUpdatedAt
	report.IsStale = report.EvidenceState.Stale

	payload, err := json.Marshal(report)
	if err != nil {
		return pullRequestReportSnapshotRecord{}, err
	}
	missingEvidence, err := json.Marshal(report.EvidenceState.MissingEvidence)
	if err != nil {
		return pullRequestReportSnapshotRecord{}, err
	}

	idempotencyKey := pullRequestReportSnapshotKey(pullRequestID, record.ScoreEventID, record.AnalysisID, pullRequestReportVersion)
	row := s.pool.QueryRow(ctx, `
		INSERT INTO pull_request_report_snapshots (
			idempotency_key,
			pull_request_id,
			score_event_id,
			analysis_id,
			report_version,
			score_version,
			analysis_version,
			evidence_status,
			evidence_missing_jsonb,
			is_stale,
			report_jsonb,
			source_updated_at,
			generated_at,
			updated_at
		)
		VALUES (
			$1,
			$2::uuid,
			NULLIF($3, '')::uuid,
			NULLIF($4, '')::uuid,
			$5,
			$6,
			$7,
			$8,
			$9::jsonb,
			$10,
			$11::jsonb,
			$12,
			$13,
			$13
		)
		ON CONFLICT (idempotency_key) DO UPDATE
		SET
			score_version = EXCLUDED.score_version,
			analysis_version = EXCLUDED.analysis_version,
			evidence_status = EXCLUDED.evidence_status,
			evidence_missing_jsonb = EXCLUDED.evidence_missing_jsonb,
			is_stale = EXCLUDED.is_stale,
			report_jsonb = EXCLUDED.report_jsonb,
			source_updated_at = EXCLUDED.source_updated_at,
			generated_at = EXCLUDED.generated_at,
			updated_at = EXCLUDED.updated_at
		RETURNING
			id::text,
			report_version,
			COALESCE(score_event_id::text, ''),
			COALESCE(analysis_id::text, ''),
			score_version,
			analysis_version,
			evidence_status,
			is_stale,
			source_updated_at,
			generated_at
	`, idempotencyKey,
		pullRequestID,
		strings.TrimSpace(record.ScoreEventID),
		strings.TrimSpace(record.AnalysisID),
		pullRequestReportVersion,
		strings.TrimSpace(report.ScoreVersion),
		strings.TrimSpace(report.AnalysisVersion),
		strings.TrimSpace(report.EvidenceState.Status),
		string(missingEvidence),
		report.IsStale,
		string(payload),
		sourceUpdatedAt,
		generatedAt,
	)

	var snapshot pullRequestReportSnapshotRecord
	if err := row.Scan(
		&snapshot.ID,
		&snapshot.ReportVersion,
		&snapshot.ScoreEventID,
		&snapshot.AnalysisID,
		&snapshot.ScoreVersion,
		&snapshot.AnalysisVersion,
		&snapshot.EvidenceStatus,
		&snapshot.IsStale,
		&snapshot.SourceUpdatedAt,
		&snapshot.GeneratedAt,
	); err != nil {
		return pullRequestReportSnapshotRecord{}, err
	}
	return snapshot, nil
}

func scanPullRequestReport(row rowScanner) (pullRequestReportRecord, error) {
	var record pullRequestReportRecord
	var signalsRaw, explanationRaw, metadataRaw, badgesRaw []byte
	if err := row.Scan(
		&record.PullRequestID,
		&record.Owner,
		&record.Repo,
		&record.FullName,
		&record.Stars,
		&record.Number,
		&record.Title,
		&record.Body,
		&record.State,
		&record.Merged,
		&record.Additions,
		&record.Deletions,
		&record.ChangedFiles,
		&record.OccurredAt,
		&record.UpdatedAt,
		&record.AnalysisID,
		&record.AnalysisVersion,
		&record.AnalysisSource,
		&record.Category,
		&record.AIConfidence,
		&record.Summary,
		&signalsRaw,
		&record.ScoreEventID,
		&record.ScoreVersion,
		&record.XP,
		&explanationRaw,
		&metadataRaw,
		&badgesRaw,
		&record.FileCount,
		&record.FeatureCount,
		&record.TestFiles,
		&record.DocsFiles,
		&record.ReviewCount,
		&record.ApprovalCount,
		&record.ChangesRequested,
		&record.ReviewCommentCount,
	); err != nil {
		return pullRequestReportRecord{}, err
	}
	record.AnalysisSignals = decodeReportStrings(signalsRaw)
	record.ScoreExplanation = decodeReportStrings(explanationRaw)
	record.ScoreMetadata = decodeReportMap(metadataRaw)
	record.BadgeUnlocks = decodeBadgeUnlocks(badgesRaw)
	return record, nil
}

func pullRequestReportFromRecord(record pullRequestReportRecord, now time.Time) contracts.PullRequestReportResponse {
	category := firstNonEmpty(stringFromMap(record.ScoreMetadata, "category"), record.Category, inferReportCategory(record))
	difficulty := scorePercent(numberFromMap(record.ScoreMetadata, "technical_depth"), derivedDifficulty(record))
	reviewDepth := scorePercent(numberFromMap(record.ScoreMetadata, "review_strength"), derivedReviewDepth(record))
	testSignal := derivedTestSignal(record)
	impact := derivedImpact(record)
	repoWeight := repositoryWeight(record.Stars)
	antiSpam := numberFromMap(record.ScoreMetadata, "diminishing_returns")
	if antiSpam <= 0 {
		antiSpam = 1
	}

	mergedBonus := 0
	if record.Merged {
		mergedBonus = 90
	}
	reviewBonus := int(math.Round(float64(reviewDepth) * 1.2))
	testBonus := int(math.Round(float64(testSignal) * 0.9))
	repoBonus := int(math.Round((repoWeight - 1) * 180))
	baseValue := record.XP - mergedBonus - reviewBonus - testBonus - repoBonus
	if baseValue < 0 {
		baseValue = 0
	}

	penalties := make([]contracts.PRReportScoreBreakdown, 0)
	if record.ScoreEventID == "" {
		penalties = append(penalties, contracts.PRReportScoreBreakdown{
			Label:   "No persisted score event",
			DeltaXP: 0,
			Type:    "penalty",
			Reason:  "This PR has not completed the scoring pipeline yet.",
		})
	}
	if record.ChangesRequested > 0 && !record.Merged {
		penalties = append(penalties, contracts.PRReportScoreBreakdown{
			Label:   "Pending requested changes",
			DeltaXP: -35,
			Type:    "penalty",
			Reason:  "Requested changes are present and the PR is not merged yet.",
		})
	}
	suggestedQuest := suggestedQuest(record, category, testSignal, reviewDepth)
	scoreComponents := scoreComponentsForReport(record)
	badgeUnlocks := badgeUnlocksForReport(record)
	evidenceState := reportEvidenceState(record)

	return contracts.PullRequestReportResponse{
		Contribution: contracts.PRReportContribution{
			ID:                 reportContributionID(record),
			Owner:              record.Owner,
			Repo:               record.Repo,
			Number:             record.Number,
			Title:              record.Title,
			Status:             reportStatus(record),
			Category:           category,
			DifficultyScore:    difficulty,
			ImpactScore:        impact,
			ReviewDepthScore:   reviewDepth,
			TestSignalScore:    testSignal,
			RepoWeight:         repoWeight,
			AntiSpamMultiplier: antiSpam,
			XPEarned:           record.XP,
			Additions:          record.Additions,
			Deletions:          record.Deletions,
			ChangedFilesCount:  maxInt(record.ChangedFiles, record.FileCount),
			MergedAt:           record.OccurredAt.UTC(),
			MaintainerReviewed: record.ReviewCount > 0 || record.ReviewCommentCount > 0,
			LinkedIssue:        reportHasLinkedIssue(record),
			CIPassed:           reportHasSignal(record, "ci passed", "checks passed"),
			AISummary:          firstNonEmpty(record.Summary, firstReportExplanation(record), "No analysis summary has been persisted for this PR yet."),
			EvidenceSignals:    reportEvidenceSignals(record),
		},
		BaseValue:        baseValue,
		MergedBonus:      mergedBonus,
		ReviewBonus:      reviewBonus,
		TestBonus:        testBonus,
		RepoBonus:        repoBonus,
		AIConfidence:     record.AIConfidence,
		Penalties:        penalties,
		ScoreComponents:  scoreComponents,
		BadgeUnlocks:     badgeUnlocks,
		SuggestedQuestID: suggestedQuest.ID,
		SuggestedQuest:   &suggestedQuest,
		EvidenceState:    evidenceState,
		ScoreVersion:     record.ScoreVersion,
		AnalysisVersion:  record.AnalysisVersion,
		SourceUpdatedAt:  latestTime(record.UpdatedAt, record.OccurredAt),
		GeneratedAt:      now.UTC(),
		IsStale:          evidenceState.Stale,
	}
}

func pullRequestReportsFromRecords(records []pullRequestReportRecord, now time.Time) []contracts.PullRequestReportResponse {
	reports := make([]contracts.PullRequestReportResponse, 0, len(records))
	for _, record := range records {
		reports = append(reports, pullRequestReportFromRecord(record, now.UTC()))
	}
	return reports
}

func pullRequestReportMaterializationResponse(record pullRequestReportRecord, snapshot pullRequestReportSnapshotRecord, report contracts.PullRequestReportResponse) contracts.PullRequestReportMaterializationResponse {
	repository := strings.TrimSpace(record.FullName)
	if repository == "" {
		repository = strings.TrimSpace(record.Owner) + "/" + strings.TrimSpace(record.Repo)
	}
	return contracts.PullRequestReportMaterializationResponse{
		Status:           "materialized",
		Repository:       repository,
		Number:           record.Number,
		PullRequestID:    strings.TrimSpace(record.PullRequestID),
		ReportSnapshotID: strings.TrimSpace(snapshot.ID),
		ReportVersion:    strings.TrimSpace(snapshot.ReportVersion),
		ScoreEventID:     strings.TrimSpace(snapshot.ScoreEventID),
		AnalysisID:       strings.TrimSpace(snapshot.AnalysisID),
		ScoreVersion:     strings.TrimSpace(snapshot.ScoreVersion),
		AnalysisVersion:  strings.TrimSpace(snapshot.AnalysisVersion),
		EvidenceStatus:   strings.TrimSpace(snapshot.EvidenceStatus),
		MissingEvidence:  compactStrings(report.EvidenceState.MissingEvidence),
		IsStale:          snapshot.IsStale,
		SourceUpdatedAt:  snapshot.SourceUpdatedAt.UTC(),
		GeneratedAt:      snapshot.GeneratedAt.UTC(),
	}
}

func pullRequestReportSnapshotKey(pullRequestID, scoreEventID, analysisID, reportVersion string) string {
	return strings.Join([]string{
		"pr_report",
		strings.TrimSpace(pullRequestID),
		strings.TrimSpace(reportVersion),
		reportSnapshotKeyPart(scoreEventID),
		reportSnapshotKeyPart(analysisID),
	}, ":")
}

func reportSnapshotKeyPart(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "none"
	}
	return value
}

func decodeReportStrings(raw []byte) []string {
	if len(raw) == 0 {
		return nil
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err == nil {
		return compactStrings(values)
	}
	var object map[string]any
	if err := json.Unmarshal(raw, &object); err == nil {
		out := make([]string, 0, len(object))
		for key, value := range object {
			switch typed := value.(type) {
			case []any:
				for _, item := range typed {
					if text := strings.TrimSpace(fmt.Sprint(item)); text != "" {
						out = append(out, text)
					}
				}
			default:
				if text := strings.TrimSpace(fmt.Sprintf("%s: %v", key, typed)); text != "" {
					out = append(out, text)
				}
			}
		}
		return compactStrings(out)
	}
	return nil
}

func decodeReportMap(raw []byte) map[string]any {
	out := map[string]any{}
	if len(raw) == 0 {
		return out
	}
	_ = json.Unmarshal(raw, &out)
	return out
}

func decodeBadgeUnlocks(raw []byte) []badgeUnlockRecord {
	if len(raw) == 0 {
		return nil
	}
	var payload []struct {
		Key       string         `json:"key"`
		AwardedAt time.Time      `json:"awarded_at"`
		Evidence  map[string]any `json:"evidence"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil
	}
	out := make([]badgeUnlockRecord, 0, len(payload))
	for _, item := range payload {
		if strings.TrimSpace(item.Key) == "" {
			continue
		}
		if item.Evidence == nil {
			item.Evidence = map[string]any{}
		}
		out = append(out, badgeUnlockRecord{
			Key:       item.Key,
			AwardedAt: item.AwardedAt.UTC(),
			Evidence:  item.Evidence,
		})
	}
	return out
}

func badgeUnlocksForReport(record pullRequestReportRecord) []contracts.PRReportBadgeUnlock {
	out := make([]contracts.PRReportBadgeUnlock, 0, len(record.BadgeUnlocks))
	for _, badge := range record.BadgeUnlocks {
		out = append(out, contracts.PRReportBadgeUnlock{
			Key:             badge.Key,
			Name:            humanizeBadgeKey(badge.Key),
			Description:     badgeDescription(badge.Key),
			AwardedAt:       badge.AwardedAt.UTC(),
			Rule:            stringFromMap(badge.Evidence, "rule"),
			RuleVersion:     stringFromMap(badge.Evidence, "rule_version"),
			EvidenceSignals: badgeEvidenceSignals(badge.Evidence),
			EvidencePRIDs:   stringSliceFromMap(badge.Evidence, "evidence_pr_ids"),
		})
	}
	return out
}

func badgeEvidenceSignals(evidence map[string]any) []string {
	signals := []string{}
	if awardedFor := stringFromMap(evidence, "awarded_for"); awardedFor != "" {
		signals = append(signals, awardedFor)
	}
	for _, key := range []string{"repository_count", "contribution_span", "security_xp", "testing_xp", "active_weeks"} {
		if value, ok := numberEntryFromMap(evidence, key); ok {
			signals = append(signals, fmt.Sprintf("%s=%d", key, int(math.Round(value))))
		}
	}
	if rule := stringFromMap(evidence, "rule"); rule != "" {
		signals = append(signals, "rule="+rule)
	}
	if version := stringFromMap(evidence, "rule_version"); version != "" {
		signals = append(signals, "rule_version="+version)
	}
	return compactStrings(signals)
}

func scoreComponentsForReport(record pullRequestReportRecord) []contracts.PRReportScoreComponent {
	if record.ScoreEventID == "" {
		return nil
	}

	components := make([]contracts.PRReportScoreComponent, 0, 10)
	appendComponent := func(key, label string, value float64, source, reason string) {
		components = append(components, contracts.PRReportScoreComponent{
			Key:          key,
			Label:        label,
			Value:        value,
			DisplayValue: scoreComponentDisplay(key, value),
			Source:       source,
			Reason:       reason,
		})
	}

	if value, ok := numberEntryFromMap(record.ScoreMetadata, "total_xp"); ok {
		appendComponent("total_xp", "Final XP", value, "score_event_metadata", "Final deterministic XP recorded by the scoring engine.")
	} else {
		appendComponent("total_xp", "Final XP", float64(record.XP), "score_events.delta_total_xp", "Final deterministic XP stored on the persisted score event.")
	}
	appendMetadataComponent(&components, record.ScoreMetadata, "category_weight", "Category weight", "category_weight", "Category-specific multiplier selected by the scoring engine.")
	appendMetadataComponent(&components, record.ScoreMetadata, "technical_depth", "Technical depth", "technical_depth", "Persisted analysis depth input used by deterministic scoring.")
	appendMetadataComponent(&components, record.ScoreMetadata, "review_strength", "Review strength", "review_strength", "Persisted review-strength input used by deterministic scoring.")
	appendMetadataComponent(&components, record.ScoreMetadata, "repository_weight", "Repository weight", "repository_weight", "Repository-context multiplier applied by the scoring engine.")
	appendMetadataComponent(&components, record.ScoreMetadata, "outcome_weight", "Outcome weight", "outcome_weight", "Merged, closed, draft, or open-state multiplier applied by the scoring engine.")
	appendMetadataComponent(&components, record.ScoreMetadata, "consistency_modifier", "Consistency modifier", "consistency_modifier", "Contributor-history modifier applied during score replay.")
	appendMetadataComponent(&components, record.ScoreMetadata, "diminishing_returns_modifier", "Diminishing returns", "diminishing_returns_modifier", "Anti-concentration modifier applied during score replay.")
	if _, ok := numberEntryFromMap(record.ScoreMetadata, "diminishing_returns_modifier"); !ok {
		appendMetadataComponent(&components, record.ScoreMetadata, "diminishing_returns_modifier", "Diminishing returns", "diminishing_returns", "Legacy score-event metadata for the anti-concentration modifier.")
	}
	appendMetadataComponent(&components, record.ScoreMetadata, "spam_penalty", "Spam penalty", "spam_penalty", "Small-change or docs-heavy penalty applied before final XP is written.")
	if selfMerged, ok := boolEntryFromMap(record.ScoreMetadata, "self_merged"); ok && selfMerged {
		appendComponent("self_merged_exclusion", "Self-merge exclusion", 0, "score_event_metadata", "Self-merged pull requests are monitored but excluded from XP.")
	}
	return components
}

func appendMetadataComponent(components *[]contracts.PRReportScoreComponent, metadata map[string]any, key, label, metadataKey, reason string) {
	value, ok := numberEntryFromMap(metadata, metadataKey)
	if !ok {
		return
	}
	source := "score_event_metadata"
	if metadataKey == "diminishing_returns" {
		source = "legacy_score_event_metadata"
	}
	*components = append(*components, contracts.PRReportScoreComponent{
		Key:          key,
		Label:        label,
		Value:        value,
		DisplayValue: scoreComponentDisplay(key, value),
		Source:       source,
		Reason:       reason,
	})
}

func scoreComponentDisplay(key string, value float64) string {
	switch key {
	case "total_xp":
		return fmt.Sprintf("%d XP", int(math.Round(value)))
	case "self_merged_exclusion":
		return "0 XP"
	case "technical_depth", "review_strength":
		return fmt.Sprintf("%d%%", int(math.Round(value*100)))
	case "spam_penalty":
		return fmt.Sprintf("-%d%%", int(math.Round(value*100)))
	default:
		return fmt.Sprintf("%.2fx", value)
	}
}

func reportEvidenceSignals(record pullRequestReportRecord) []string {
	signals := []string{}
	signals = append(signals, record.AnalysisSignals...)
	signals = append(signals, record.ScoreExplanation...)
	if record.FileCount > 0 {
		signals = append(signals, fmt.Sprintf("%d changed files persisted", record.FileCount))
	}
	if record.FeatureCount > 0 {
		signals = append(signals, fmt.Sprintf("%d changed-file feature records persisted", record.FeatureCount))
	}
	if record.ReviewCount > 0 {
		signals = append(signals, fmt.Sprintf("%d review events persisted", record.ReviewCount))
	}
	if record.ScoreVersion != "" {
		signals = append(signals, "score version "+record.ScoreVersion)
	}
	return compactStrings(signals)
}

func reportEvidenceState(record pullRequestReportRecord) contracts.PRReportEvidenceState {
	analysisSource := inferReportAnalysisSource(record)
	deterministicOnly := analysisSource == "deterministic"
	analysisPersisted := strings.TrimSpace(record.AnalysisID) != ""
	scoreEventPersisted := strings.TrimSpace(record.ScoreEventID) != ""
	analysisMissing := !analysisPersisted && !deterministicOnly

	missing := make([]string, 0, 3)
	reasons := make([]string, 0, 5)
	if analysisMissing {
		missing = append(missing, "analysis")
		reasons = append(reasons, "analysis has not been persisted")
	}
	if !scoreEventPersisted {
		missing = append(missing, "score_event")
		reasons = append(reasons, "score event has not been persisted")
	}
	if record.FileCount == 0 {
		missing = append(missing, "changed_files")
		reasons = append(reasons, "changed-file evidence has not been persisted")
	}

	aiFallback := stringFromMap(record.ScoreMetadata, "fallback_reason") != "" || reportHasSignal(record, "ai fallback", "deterministic fallback", "fallback_reason")
	rateLimited := boolFromMap(record.ScoreMetadata, "rate_limited") || reportHasSignal(record, "rate limited", "rate_limit", "github rate")
	stale := !scoreEventPersisted || analysisMissing
	if !analysisPersisted && scoreEventPersisted && deterministicOnly {
		reasons = append(reasons, "deterministic scoring evidence is available while analysis snapshot persistence is pending")
	}

	status := "complete"
	switch {
	case rateLimited:
		status = "rate_limited"
		reasons = append(reasons, "upstream rate-limit evidence is attached to this report")
	case stale:
		status = "stale"
		reasons = append(reasons, "report is stale until analysis and scoring both complete")
	case len(missing) > 0:
		status = "incomplete"
	case aiFallback:
		status = "ai_fallback"
		reasons = append(reasons, "AI-assisted analysis fell back to deterministic evidence")
	case deterministicOnly:
		status = "deterministic_only"
		reasons = append(reasons, "analysis is deterministic-only; no AI enrichment is attached")
	}

	return contracts.PRReportEvidenceState{
		Status:             status,
		Reasons:            compactStrings(reasons),
		MissingEvidence:    compactStrings(missing),
		AnalysisSource:     analysisSource,
		AnalysisConfidence: record.AIConfidence,
		DeterministicOnly:  deterministicOnly,
		AIFallback:         aiFallback,
		RateLimited:        rateLimited,
		Stale:              stale,
	}
}

func inferReportAnalysisSource(record pullRequestReportRecord) string {
	analysisSource := normalizeReportAnalysisSource(record.AnalysisSource)
	if analysisSource != "unknown" {
		return analysisSource
	}
	if strings.TrimSpace(record.ScoreEventID) != "" {
		return "deterministic"
	}
	if strings.TrimSpace(record.ScoreVersion) != "" {
		return "deterministic"
	}
	if record.XP > 0 {
		return "deterministic"
	}
	if len(record.ScoreExplanation) > 0 {
		return "deterministic"
	}
	if hasDeterministicScoreMetadata(record.ScoreMetadata) {
		return "deterministic"
	}
	return analysisSource
}

func hasDeterministicScoreMetadata(metadata map[string]any) bool {
	if len(metadata) == 0 {
		return false
	}
	for _, key := range []string{
		"technical_depth",
		"review_strength",
		"category_weight",
		"repository_weight",
		"outcome_weight",
		"consistency_modifier",
		"diminishing_returns_modifier",
		"total_xp",
	} {
		if _, ok := numberEntryFromMap(metadata, key); ok {
			return true
		}
	}
	return false
}

func normalizeReportAnalysisSource(source string) string {
	switch strings.ToLower(strings.TrimSpace(source)) {
	case "ai", "ai_assisted", "llm":
		return "ai_assisted"
	case "hybrid":
		return "hybrid"
	case "deterministic", "rules":
		return "deterministic"
	case "":
		return "unknown"
	default:
		return strings.ToLower(strings.TrimSpace(source))
	}
}

func firstReportExplanation(record pullRequestReportRecord) string {
	for _, line := range record.ScoreExplanation {
		if strings.TrimSpace(line) != "" {
			return line
		}
	}
	return ""
}

func reportContributionID(record pullRequestReportRecord) string {
	if record.ScoreEventID != "" {
		return record.ScoreEventID
	}
	if record.PullRequestID != "" {
		return record.PullRequestID
	}
	return fmt.Sprintf("%s/%s#%d", record.Owner, record.Repo, record.Number)
}

func reportStatus(record pullRequestReportRecord) string {
	if record.Merged {
		return "merged"
	}
	switch strings.ToLower(record.State) {
	case "closed":
		return "closed"
	default:
		return "open"
	}
}

func inferReportCategory(record pullRequestReportRecord) string {
	text := strings.ToLower(record.Title + " " + record.Body + " " + strings.Join(record.AnalysisSignals, " "))
	switch {
	case strings.Contains(text, "security") || strings.Contains(text, "auth"):
		return "Security"
	case strings.Contains(text, "perf") || strings.Contains(text, "benchmark"):
		return "Performance"
	case record.TestFiles > 0 || strings.Contains(text, "test"):
		return "Testing"
	case record.DocsFiles > 0 || strings.Contains(text, "doc"):
		return "Documentation"
	case strings.Contains(text, "infra") || strings.Contains(text, "ci") || strings.Contains(text, "deploy"):
		return "Infrastructure"
	case strings.Contains(text, "review"):
		return "Review"
	case strings.Contains(text, "architecture") || strings.Contains(text, "schema"):
		return "Architecture"
	case strings.Contains(text, "fix") || strings.Contains(text, "bug"):
		return "Bug Fix"
	default:
		return "Backend"
	}
}

func derivedDifficulty(record pullRequestReportRecord) int {
	return clampInt(20+record.ChangedFiles*4+(record.Additions+record.Deletions)/25, 0, 100)
}

func derivedImpact(record pullRequestReportRecord) int {
	fromXP := record.XP / 8
	fromSize := record.ChangedFiles*3 + (record.Additions+record.Deletions)/40
	return clampInt(25+fromXP+fromSize, 0, 100)
}

func derivedReviewDepth(record pullRequestReportRecord) int {
	score := record.ReviewCount*18 + record.ReviewCommentCount*5 + record.ApprovalCount*20
	return clampInt(score, 0, 100)
}

func derivedTestSignal(record pullRequestReportRecord) int {
	score := record.TestFiles * 35
	if reportHasSignal(record, "test", "regression", "coverage") {
		score += 25
	}
	if reportHasSignal(record, "ci passed", "checks passed") {
		score += 20
	}
	return clampInt(score, 0, 100)
}

func repositoryWeight(stars int) float64 {
	if stars <= 0 {
		return 1
	}
	return math.Round((1+math.Min(0.35, math.Log10(float64(stars)+1)/20))*100) / 100
}

func reportHasLinkedIssue(record pullRequestReportRecord) bool {
	text := strings.ToLower(record.Title + " " + record.Body + " " + strings.Join(record.AnalysisSignals, " ") + " " + strings.Join(record.ScoreExplanation, " "))
	return strings.Contains(text, "fixes #") || strings.Contains(text, "closes #") || strings.Contains(text, "linked issue")
}

func reportHasSignal(record pullRequestReportRecord, needles ...string) bool {
	text := strings.ToLower(record.Title + " " + record.Body + " " + strings.Join(record.AnalysisSignals, " ") + " " + strings.Join(record.ScoreExplanation, " "))
	for _, needle := range needles {
		if strings.Contains(text, strings.ToLower(needle)) {
			return true
		}
	}
	return false
}

func suggestedQuest(record pullRequestReportRecord, category string, testSignal, reviewDepth int) contracts.PRReportSuggestedQuest {
	if record.ScoreEventID == "" || record.AnalysisID == "" {
		return contracts.PRReportSuggestedQuest{
			ID:             "quest-sync-first-evidence",
			Title:          "Finish evidence sync",
			Description:    "Complete analysis and scoring so this PR can produce verified progression evidence.",
			Status:         "active",
			WhyRecommended: "This report is stale or incomplete because persisted analysis or score evidence is missing.",
			EvidenceSignals: compactStrings([]string{
				"missing_analysis=" + boolText(record.AnalysisID == ""),
				"missing_score_event=" + boolText(record.ScoreEventID == ""),
			}),
		}
	}
	if testSignal < 50 {
		return contracts.PRReportSuggestedQuest{
			ID:             "quest-regression-tests",
			Title:          "Add regression proof",
			Description:    "Turn the next similar PR into stronger evidence by adding or improving test coverage.",
			Status:         "active",
			WeakAreaTarget: "Testing",
			WhyRecommended: fmt.Sprintf("This PR has a %d/100 test signal, so more regression evidence would improve confidence.", testSignal),
			EvidenceSignals: compactStrings([]string{
				fmt.Sprintf("test_signal=%d", testSignal),
				fmt.Sprintf("test_files=%d", record.TestFiles),
				fmt.Sprintf("changed_file_features=%d", record.FeatureCount),
			}),
		}
	}
	if reviewDepth < 50 {
		return contracts.PRReportSuggestedQuest{
			ID:             "quest-maintainer-review",
			Title:          "Earn maintainer review signal",
			Description:    "Aim for explicit maintainer review, approval, or high-signal review discussion on the next contribution.",
			Status:         "active",
			WeakAreaTarget: "Review",
			WhyRecommended: fmt.Sprintf("This PR has a %d/100 review-depth signal, so stronger review evidence would make the score easier to trust.", reviewDepth),
			EvidenceSignals: compactStrings([]string{
				fmt.Sprintf("review_depth=%d", reviewDepth),
				fmt.Sprintf("reviews=%d", record.ReviewCount),
				fmt.Sprintf("review_comments=%d", record.ReviewCommentCount),
			}),
		}
	}
	if strings.EqualFold(category, "Security") {
		return contracts.PRReportSuggestedQuest{
			ID:             "quest-performance-benchmark",
			Title:          "Pair risk work with performance proof",
			Description:    "For security-sensitive changes, add benchmark or runtime evidence when performance could be affected.",
			Status:         "active",
			WeakAreaTarget: "Performance",
			WhyRecommended: "Security changes are stronger when their operational impact is bounded and explainable.",
			EvidenceSignals: compactStrings([]string{
				"category=Security",
				fmt.Sprintf("changed_files=%d", maxInt(record.ChangedFiles, record.FileCount)),
				fmt.Sprintf("diff_lines=%d", record.Additions+record.Deletions),
			}),
		}
	}
	return contracts.PRReportSuggestedQuest{
		ID:             "quest-weak-lane-security",
		Title:          "Strengthen a weak skill lane",
		Description:    "Use the next contribution to add security, reliability, or edge-case evidence that broadens the profile.",
		Status:         "active",
		WeakAreaTarget: "Security",
		WhyRecommended: "This PR already has enough test and review signal, so the next useful growth path is broader skill evidence.",
		EvidenceSignals: compactStrings([]string{
			"test_and_review_thresholds_met",
			fmt.Sprintf("category=%s", category),
			fmt.Sprintf("score_version=%s", firstNonEmpty(record.ScoreVersion, "unknown")),
		}),
	}
}

func boolText(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func stringFromMap(values map[string]any, key string) string {
	if value, ok := values[key]; ok {
		return strings.TrimSpace(fmt.Sprint(value))
	}
	return ""
}

func stringSliceFromMap(values map[string]any, key string) []string {
	value, ok := values[key]
	if !ok {
		return nil
	}
	switch typed := value.(type) {
	case []string:
		return compactStrings(typed)
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if text := strings.TrimSpace(fmt.Sprint(item)); text != "" {
				out = append(out, text)
			}
		}
		return compactStrings(out)
	default:
		text := strings.TrimSpace(fmt.Sprint(typed))
		if text == "" {
			return nil
		}
		return []string{text}
	}
}

func numberEntryFromMap(values map[string]any, key string) (float64, bool) {
	value, ok := values[key]
	if !ok {
		return 0, false
	}
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case json.Number:
		out, err := typed.Float64()
		return out, err == nil
	default:
		return 0, false
	}
}

func boolEntryFromMap(values map[string]any, key string) (bool, bool) {
	value, ok := values[key]
	if !ok {
		return false, false
	}
	typed, ok := value.(bool)
	return typed, ok
}

func boolFromMap(values map[string]any, key string) bool {
	value, ok := boolEntryFromMap(values, key)
	return ok && value
}

func numberFromMap(values map[string]any, key string) float64 {
	value, ok := numberEntryFromMap(values, key)
	if !ok {
		return 0
	}
	return value
}

func scorePercent(value float64, fallback int) int {
	if value <= 0 {
		return fallback
	}
	if value <= 1 {
		value *= 100
	}
	return clampInt(int(math.Round(value)), 0, 100)
}

func compactStrings(values []string) []string {
	out := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			continue
		}
		out = append(out, trimmed)
		seen[key] = struct{}{}
		if len(out) >= 12 {
			break
		}
	}
	return out
}

func clampInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func latestTime(values ...time.Time) time.Time {
	var latest time.Time
	for _, value := range values {
		if value.After(latest) {
			latest = value
		}
	}
	return latest.UTC()
}
