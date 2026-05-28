package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/githubapi"
	"github.com/gitrank/gitrank/packages/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUnavailable                 = errors.New("github persistence unavailable")
	ErrUserSyncOAuthTokenRequired  = errors.New("github oauth token unavailable for user sync; reconnect github")
	ErrUserSyncOAuthTokenMalformed = errors.New("github oauth token unavailable for user sync; rotate token keys and reconnect github")
	ErrUserSyncInProgress          = errors.New("user sync already in progress; wait for current run to finish")
)

type Service struct {
	cfg   config.App
	store *Store
}

type PersistResult struct {
	RepositoryCount      int
	InstallationCount    int
	PullRequestCount     int
	PullRequestFileCount int
	ReviewCount          int
	ReviewCommentCount   int
	IssueCount           int
	LabelCount           int
	CommitCount          int
}

type SyncRequestActor struct {
	Subject     string
	GitHubLogin string
}

func New(pool *pgxpool.Pool) *Service {
	return NewWithConfig(config.App{}, pool)
}

func NewWithConfig(cfg config.App, pool *pgxpool.Pool) *Service {
	return &Service{
		cfg:   cfg,
		store: NewStore(pool),
	}
}

func (s *Service) Ready(ctx context.Context) error {
	if s == nil || s.store == nil || s.store.pool == nil {
		return nil
	}
	return s.store.Ping(ctx)
}

func (s *Service) PersistWebhook(ctx context.Context, envelope githubapi.WebhookEnvelope, correlationID string, now time.Time) (PersistResult, error) {
	if s == nil || s.store == nil || s.store.pool == nil {
		return PersistResult{}, nil
	}

	var payload map[string]any
	if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
		return PersistResult{}, err
	}

	return s.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		result := PersistResult{}

		installationID, installationTouched, err := tx.UpsertInstallation(payload, now.UTC())
		if err != nil {
			return PersistResult{}, err
		}
		if installationTouched {
			result.InstallationCount++
		}

		repositoryID, repositoryTouched, err := tx.UpsertRepository(payload, now.UTC())
		if err != nil {
			return PersistResult{}, err
		}
		if repositoryTouched {
			result.RepositoryCount++
		}

		switch envelope.EventType {
		case "installation_repositories":
			reposTouched, err := tx.UpsertRepositoryLists(payload, now.UTC())
			if err != nil {
				return PersistResult{}, err
			}
			result.RepositoryCount += reposTouched
		case "pull_request", "pull_request_target":
			prID, prTouched, labelCount, err := tx.UpsertPullRequest(payload, repositoryID, now.UTC())
			if err != nil {
				return PersistResult{}, err
			}
			if prTouched {
				result.PullRequestCount++
			}
			result.LabelCount += labelCount
			if strings.TrimSpace(prID) != "" {
				_ = prID
			}
		case "pull_request_review":
			prID, prTouched, labelCount, err := tx.UpsertPullRequest(payload, repositoryID, now.UTC())
			if err != nil {
				return PersistResult{}, err
			}
			if prTouched {
				result.PullRequestCount++
			}
			result.LabelCount += labelCount
			reviewTouched, err := tx.UpsertReview(payload, prID, now.UTC())
			if err != nil {
				return PersistResult{}, err
			}
			if reviewTouched {
				result.ReviewCount++
			}
		case "pull_request_review_comment":
			prID, prTouched, labelCount, err := tx.UpsertPullRequest(payload, repositoryID, now.UTC())
			if err != nil {
				return PersistResult{}, err
			}
			if prTouched {
				result.PullRequestCount++
			}
			result.LabelCount += labelCount
			reviewTouched, reviewID, err := tx.UpsertReviewFromComment(payload, prID, now.UTC())
			if err != nil {
				return PersistResult{}, err
			}
			if reviewTouched {
				result.ReviewCount++
			}
			commentTouched, err := tx.UpsertReviewComment(payload, prID, reviewID, now.UTC())
			if err != nil {
				return PersistResult{}, err
			}
			if commentTouched {
				result.ReviewCommentCount++
			}
		case "issues", "issue_comment", "milestone":
			issueTouched, labelCount, err := tx.UpsertIssue(payload, repositoryID, now.UTC())
			if err != nil {
				return PersistResult{}, err
			}
			if issueTouched {
				result.IssueCount++
			}
			result.LabelCount += labelCount
		case "label":
			labelTouched, err := tx.UpsertTopLevelLabel(payload, repositoryID, now.UTC())
			if err != nil {
				return PersistResult{}, err
			}
			if labelTouched {
				result.LabelCount++
			}
		case "push", "create", "delete", "check_run", "check_suite":
			commitCount, err := tx.UpsertCommits(payload, repositoryID, now.UTC())
			if err != nil {
				return PersistResult{}, err
			}
			result.CommitCount += commitCount
		case "repository":
			// Repository row already handled.
		}

		if err := tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:               strings.TrimSpace(correlationID),
			DeliveryID:                  envelope.DeliveryID,
			EventType:                   envelope.EventType,
			Status:                      "completed",
			Subject:                     webhookSubject(envelope),
			InstallationID:              installationID,
			InstallationSourceID:        envelope.Installation,
			RepositoryID:                repositoryID,
			RequestedRepositoryFullName: envelope.Repository,
			Result:                      result,
			StartedAt:                   now.UTC(),
			FinishedAt:                  timePointer(now.UTC()),
		}); err != nil {
			return PersistResult{}, err
		}
		return result, nil
	})
}

func (s *Service) RecordQueuedSyncRequest(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	jobs []store.QueueJob,
	correlationID string,
	now time.Time,
) error {
	if s == nil || s.store == nil || s.store.pool == nil {
		return nil
	}

	_, err := s.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		repositoryID, err := tx.lookupRepositoryIDByFullName(req.Repository)
		if err != nil {
			return PersistResult{}, err
		}
		installationID, err := tx.lookupInstallationIDByGitHubID(req.InstallationID)
		if err != nil {
			return PersistResult{}, err
		}

		for _, job := range jobs {
			if err := tx.InsertSyncRun(payloadSyncRunInput{
				CorrelationID:               strings.TrimSpace(correlationID),
				EventType:                   req.Mode,
				Status:                      "queued",
				Subject:                     strings.TrimSpace(job.Subject),
				InstallationID:              installationID,
				InstallationSourceID:        req.InstallationID,
				RepositoryID:                repositoryID,
				RequestedUserLogin:          req.User,
				RequestedRepositoryFullName: req.Repository,
				RequestedBySubject:          actor.Subject,
				RequestedByGitHubLogin:      actor.GitHubLogin,
				StartedAt:                   now.UTC(),
			}); err != nil {
				return PersistResult{}, err
			}
		}
		return PersistResult{}, nil
	})
	return err
}

func (s *Service) ListSyncRuns(ctx context.Context, filter contracts.GitHubSyncRunFilter) (contracts.GitHubSyncRunListResponse, error) {
	if s == nil || s.store == nil || s.store.pool == nil {
		return contracts.GitHubSyncRunListResponse{}, ErrUnavailable
	}
	now := time.Now().UTC()
	activeWindow := syncRunActiveWindow(s.cfg.GitHub)
	queuedWindow := syncRunQueuedWindow(activeWindow)
	if err := s.store.MarkStaleSyncRunsFailed(
		ctx,
		now,
		now.Add(-activeWindow),
		now.Add(-queuedWindow),
	); err != nil {
		return contracts.GitHubSyncRunListResponse{}, err
	}
	normalized := normalizeSyncRunFilter(filter, s.cfg.GitHub.SyncRunDefaultLimit, s.cfg.GitHub.SyncRunMaxLimit)
	runs, err := s.store.ListSyncRuns(ctx, normalized)
	if err != nil {
		return contracts.GitHubSyncRunListResponse{}, err
	}
	runs = normalizeSyncRunViews(runs, now, activeWindow)
	lastAttemptedAt, lastSuccessfulAt := summarizeSyncRunWatermarks(runs)
	lastUpdatedAt := syncRunListUpdatedAt(runs)
	return contracts.GitHubSyncRunListResponse{
		Runs:             runs,
		AppliedFilter:    normalized,
		LastUpdatedAt:    lastUpdatedAt,
		LastAttemptedAt:  lastAttemptedAt,
		LastSuccessfulAt: lastSuccessfulAt,
	}, nil
}

func normalizeSyncRunViews(
	runs []contracts.GitHubSyncRunView,
	now time.Time,
	activeWindow time.Duration,
) []contracts.GitHubSyncRunView {
	if len(runs) == 0 {
		return runs
	}
	if activeWindow <= 0 {
		activeWindow = 2 * time.Minute
	}

	for index := range runs {
		run := &runs[index]
		status := strings.ToLower(strings.TrimSpace(run.Status))
		switch status {
		case "":
			if run.FinishedAt != nil && !run.FinishedAt.IsZero() {
				run.Status = "completed"
			} else if run.StartedAt.IsZero() {
				run.Status = "queued"
			} else {
				run.Status = "running"
				if now.Sub(run.StartedAt) > activeWindow {
					run.Status = "failed"
					if strings.TrimSpace(run.LastError) == "" {
						run.LastError = "sync execution exceeded active window and was marked failed"
					}
				}
			}
		case "running", "syncing", "in_progress":
			if run.FinishedAt != nil && !run.FinishedAt.IsZero() {
				run.Status = "failed"
				if strings.TrimSpace(run.LastError) == "" {
					run.LastError = "sync execution finished with a non-terminal running state and was marked failed"
				}
				continue
			}
			if run.StartedAt.IsZero() {
				run.Status = "failed"
				if strings.TrimSpace(run.LastError) == "" {
					run.LastError = "sync execution is missing started_at and was marked failed"
				}
				continue
			}
			run.Status = "running"
			if now.Sub(run.StartedAt) > activeWindow {
				run.Status = "failed"
				if strings.TrimSpace(run.LastError) == "" {
					run.LastError = "sync execution exceeded active window and was marked failed"
				}
			}
		case "queued", "pending":
			if run.FinishedAt != nil && !run.FinishedAt.IsZero() {
				run.Status = "failed"
				if strings.TrimSpace(run.LastError) == "" {
					run.LastError = "sync execution finished with a queued state and was marked failed"
				}
				continue
			}
			run.Status = "queued"
			if !run.StartedAt.IsZero() {
				queuedFailureWindow := syncRunQueuedWindow(activeWindow)
				if now.Sub(run.StartedAt) > queuedFailureWindow {
					run.Status = "failed"
					if strings.TrimSpace(run.LastError) == "" {
						run.LastError = "sync execution remained queued beyond safe window and was marked failed"
					}
				}
			}
		default:
			run.Status = status
		}
	}

	supersedeInProgressRunsWithTerminalCorrelation(runs)
	return runs
}

func summarizeSyncRunWatermarks(runs []contracts.GitHubSyncRunView) (*time.Time, *time.Time) {
	var lastAttemptedAt *time.Time
	var lastSuccessfulAt *time.Time
	for index := range runs {
		run := runs[index]
		attemptedAt := syncRunPrimaryTimestamp(run)
		if attemptedAt != nil && (lastAttemptedAt == nil || attemptedAt.After(*lastAttemptedAt)) {
			timestamp := attemptedAt.UTC()
			lastAttemptedAt = &timestamp
		}

		status := strings.ToLower(strings.TrimSpace(run.Status))
		if status != "completed" {
			continue
		}
		successAt := syncRunSuccessTimestamp(run)
		if successAt != nil && (lastSuccessfulAt == nil || successAt.After(*lastSuccessfulAt)) {
			timestamp := successAt.UTC()
			lastSuccessfulAt = &timestamp
		}
	}
	return lastAttemptedAt, lastSuccessfulAt
}

func syncRunListUpdatedAt(runs []contracts.GitHubSyncRunView) *time.Time {
	var lastUpdatedAt *time.Time
	for index := range runs {
		primary := syncRunPrimaryTimestamp(runs[index])
		if primary == nil {
			continue
		}
		if lastUpdatedAt == nil || primary.After(*lastUpdatedAt) {
			timestamp := primary.UTC()
			lastUpdatedAt = &timestamp
		}
	}
	return lastUpdatedAt
}

func syncRunPrimaryTimestamp(run contracts.GitHubSyncRunView) *time.Time {
	if !run.StartedAt.IsZero() {
		timestamp := run.StartedAt.UTC()
		return &timestamp
	}
	if run.FinishedAt != nil && !run.FinishedAt.IsZero() {
		timestamp := run.FinishedAt.UTC()
		return &timestamp
	}
	return nil
}

func syncRunSuccessTimestamp(run contracts.GitHubSyncRunView) *time.Time {
	if run.FinishedAt != nil && !run.FinishedAt.IsZero() {
		timestamp := run.FinishedAt.UTC()
		return &timestamp
	}
	if !run.StartedAt.IsZero() {
		timestamp := run.StartedAt.UTC()
		return &timestamp
	}
	return nil
}

func supersedeInProgressRunsWithTerminalCorrelation(runs []contracts.GitHubSyncRunView) {
	if len(runs) == 0 {
		return
	}
	latestTerminalByScope := make(map[string]time.Time, len(runs))
	latestTerminalByLogicalScope := make(map[string]time.Time, len(runs))
	for _, run := range runs {
		scope := syncRunCorrelationScope(run)
		status := strings.ToLower(strings.TrimSpace(run.Status))
		if !isTerminalSyncRunStatus(status) {
			continue
		}
		terminalAt := syncRunTerminalTimestamp(run)
		if scope != "" {
			if previous, exists := latestTerminalByScope[scope]; !exists || terminalAt.After(previous) {
				latestTerminalByScope[scope] = terminalAt
			}
		}
		logicalScope := syncRunLogicalScope(run)
		if logicalScope != "" {
			if previous, exists := latestTerminalByLogicalScope[logicalScope]; !exists || terminalAt.After(previous) {
				latestTerminalByLogicalScope[logicalScope] = terminalAt
			}
		}
	}
	if len(latestTerminalByScope) == 0 && len(latestTerminalByLogicalScope) == 0 {
		return
	}

	for index := range runs {
		run := &runs[index]
		status := strings.ToLower(strings.TrimSpace(run.Status))
		if status != "running" && status != "queued" {
			continue
		}
		terminalAt, matched, reason := latestTerminalForRun(*run, latestTerminalByScope, latestTerminalByLogicalScope)
		if !matched {
			continue
		}
		if !run.StartedAt.IsZero() && run.StartedAt.After(terminalAt) {
			continue
		}
		run.Status = "failed"
		if strings.TrimSpace(run.LastError) == "" {
			run.LastError = "sync execution was superseded by a newer terminal run for the same correlation"
		}
		if run.Metrics == nil {
			run.Metrics = map[string]int{}
		}
		run.Metrics["superseded_by_terminal_correlation"] = 1
		if reason == "logical_scope" {
			run.Metrics["superseded_by_terminal_logical_scope"] = 1
		}
	}
}

func syncRunCorrelationScope(run contracts.GitHubSyncRunView) string {
	correlationID := strings.TrimSpace(run.CorrelationID)
	if correlationID == "" {
		return ""
	}
	runType := strings.ToLower(strings.TrimSpace(run.RunType))
	return runType + "|" + correlationID
}

func latestTerminalForRun(
	run contracts.GitHubSyncRunView,
	latestTerminalByScope map[string]time.Time,
	latestTerminalByLogicalScope map[string]time.Time,
) (time.Time, bool, string) {
	scope := syncRunCorrelationScope(run)
	if scope != "" {
		if terminalAt, ok := latestTerminalByScope[scope]; ok {
			return terminalAt, true, "correlation"
		}
	}

	logicalScope := syncRunLogicalScope(run)
	if logicalScope != "" {
		if terminalAt, ok := latestTerminalByLogicalScope[logicalScope]; ok {
			return terminalAt, true, "logical_scope"
		}
	}
	return time.Time{}, false, ""
}

func syncRunLogicalScope(run contracts.GitHubSyncRunView) string {
	runType := strings.ToLower(strings.TrimSpace(run.RunType))
	if runType == "" {
		return ""
	}

	target := strings.ToLower(strings.TrimSpace(run.RequestedRepository))
	if target == "" {
		target = strings.TrimLeft(strings.ToLower(strings.TrimSpace(run.RequestedUser)), "@")
	}
	if target == "" {
		target = strings.ToLower(strings.TrimSpace(run.Subject))
	}
	if target == "" {
		return ""
	}
	return runType + "|" + target
}

func isTerminalSyncRunStatus(status string) bool {
	switch status {
	case "completed", "partial", "failed":
		return true
	default:
		return false
	}
}

func syncRunTerminalTimestamp(run contracts.GitHubSyncRunView) time.Time {
	if run.FinishedAt != nil && !run.FinishedAt.IsZero() {
		return run.FinishedAt.UTC()
	}
	if !run.StartedAt.IsZero() {
		return run.StartedAt.UTC()
	}
	return time.Time{}
}

func syncRunActiveWindow(cfg config.GitHub) time.Duration {
	window := cfg.UserPRSyncTimeoutMax
	if window <= 0 {
		window = cfg.UserPRSyncTimeoutDefault
	}
	if window <= 0 {
		window = 2 * time.Minute
	}
	if window < time.Minute {
		window = time.Minute
	}
	return window + 30*time.Second
}

func syncRunQueuedWindow(activeWindow time.Duration) time.Duration {
	queuedFailureWindow := activeWindow * 2
	if queuedFailureWindow < time.Minute {
		queuedFailureWindow = time.Minute
	}
	return queuedFailureWindow
}

func (r PersistResult) EntityCounts() map[string]int {
	return map[string]int{
		"repositories":       r.RepositoryCount,
		"installations":      r.InstallationCount,
		"pull_requests":      r.PullRequestCount,
		"pull_request_files": r.PullRequestFileCount,
		"reviews":            r.ReviewCount,
		"review_comments":    r.ReviewCommentCount,
		"issues":             r.IssueCount,
		"labels":             r.LabelCount,
		"commits":            r.CommitCount,
	}
}

func (r PersistResult) Summary() string {
	return fmt.Sprintf(
		"repos=%d installations=%d prs=%d pr_files=%d reviews=%d review_comments=%d issues=%d labels=%d commits=%d",
		r.RepositoryCount,
		r.InstallationCount,
		r.PullRequestCount,
		r.PullRequestFileCount,
		r.ReviewCount,
		r.ReviewCommentCount,
		r.IssueCount,
		r.LabelCount,
		r.CommitCount,
	)
}

func normalizeSyncRunFilter(filter contracts.GitHubSyncRunFilter, defaultLimit int, maxLimit int) contracts.GitHubSyncRunFilter {
	filter.RunType = strings.ToLower(strings.TrimSpace(filter.RunType))
	filter.Status = strings.ToLower(strings.TrimSpace(filter.Status))
	filter.Subject = strings.TrimSpace(filter.Subject)
	filter.Repository = strings.ToLower(strings.TrimSpace(filter.Repository))
	filter.User = strings.TrimLeft(strings.ToLower(strings.TrimSpace(filter.User)), "@")
	filter.RequestedBySubject = canonicalRequestedBySubject(filter.RequestedBySubject)
	filter.RequestedByGitHubLogin = strings.TrimLeft(strings.ToLower(strings.TrimSpace(filter.RequestedByGitHubLogin)), "@")
	filter.CorrelationID = strings.TrimSpace(filter.CorrelationID)
	filter.DeliveryID = strings.TrimSpace(filter.DeliveryID)
	if defaultLimit <= 0 {
		defaultLimit = 1
	}
	if maxLimit < defaultLimit {
		maxLimit = defaultLimit
	}
	if filter.Limit <= 0 {
		filter.Limit = defaultLimit
	}
	if filter.Limit > maxLimit {
		filter.Limit = maxLimit
	}
	return filter
}

func webhookSubject(envelope githubapi.WebhookEnvelope) string {
	switch {
	case envelope.Repository != "" && envelope.Number > 0:
		return fmt.Sprintf("%s#%d", envelope.Repository, envelope.Number)
	case envelope.Repository != "" && envelope.CommitSHA != "":
		return envelope.Repository + "@" + envelope.CommitSHA
	case envelope.Repository != "":
		return envelope.Repository
	case envelope.Installation > 0:
		return fmt.Sprintf("%d", envelope.Installation)
	default:
		return envelope.EventType
	}
}

func timePointer(value time.Time) *time.Time {
	utc := value.UTC()
	return &utc
}
