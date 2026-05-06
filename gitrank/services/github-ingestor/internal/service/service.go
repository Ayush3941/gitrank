package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/githubapi"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUnavailable = errors.New("github persistence unavailable")

type Service struct {
	store *Store
}

type PersistResult struct {
	RepositoryCount    int
	InstallationCount  int
	PullRequestCount   int
	ReviewCount        int
	ReviewCommentCount int
	IssueCount         int
	LabelCount         int
	CommitCount        int
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
			CorrelationID:  strings.TrimSpace(correlationID),
			DeliveryID:     envelope.DeliveryID,
			EventType:      envelope.EventType,
			InstallationID: installationID,
			RepositoryID:   repositoryID,
			Result:         result,
			StartedAt:      now.UTC(),
			FinishedAt:     now.UTC(),
		}); err != nil {
			return PersistResult{}, err
		}
		return result, nil
	})
}

func (r PersistResult) EntityCounts() map[string]int {
	return map[string]int{
		"repositories":    r.RepositoryCount,
		"installations":   r.InstallationCount,
		"pull_requests":   r.PullRequestCount,
		"reviews":         r.ReviewCount,
		"review_comments": r.ReviewCommentCount,
		"issues":          r.IssueCount,
		"labels":          r.LabelCount,
		"commits":         r.CommitCount,
	}
}

func (r PersistResult) Summary() string {
	return fmt.Sprintf(
		"repos=%d installations=%d prs=%d reviews=%d review_comments=%d issues=%d labels=%d commits=%d",
		r.RepositoryCount,
		r.InstallationCount,
		r.PullRequestCount,
		r.ReviewCount,
		r.ReviewCommentCount,
		r.IssueCount,
		r.LabelCount,
		r.CommitCount,
	)
}
