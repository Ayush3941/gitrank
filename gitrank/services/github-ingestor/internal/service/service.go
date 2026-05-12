package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/githubapi"
	"github.com/gitrank/gitrank/packages/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUnavailable = errors.New("github persistence unavailable")

type Service struct {
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
	return &Service{store: NewStore(pool)}
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
	runs, err := s.store.ListSyncRuns(ctx, filter)
	if err != nil {
		return contracts.GitHubSyncRunListResponse{}, err
	}
	return contracts.GitHubSyncRunListResponse{
		Runs:          runs,
		AppliedFilter: normalizeSyncRunFilter(filter),
		LastUpdatedAt: time.Now().UTC(),
	}, nil
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

func normalizeSyncRunFilter(filter contracts.GitHubSyncRunFilter) contracts.GitHubSyncRunFilter {
	filter.RunType = strings.TrimSpace(filter.RunType)
	filter.Status = strings.TrimSpace(filter.Status)
	filter.Subject = strings.TrimSpace(filter.Subject)
	filter.Repository = strings.TrimSpace(filter.Repository)
	filter.User = strings.TrimSpace(filter.User)
	filter.RequestedBySubject = strings.TrimSpace(filter.RequestedBySubject)
	filter.RequestedByGitHubLogin = strings.TrimSpace(filter.RequestedByGitHubLogin)
	filter.CorrelationID = strings.TrimSpace(filter.CorrelationID)
	filter.DeliveryID = strings.TrimSpace(filter.DeliveryID)
	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	if filter.Limit > 200 {
		filter.Limit = 200
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
