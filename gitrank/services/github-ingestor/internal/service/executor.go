package service

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/githubapi"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultRepositorySyncPageSize    = 10
	defaultPullRequestReviewPageSize = 10
	defaultCommitSyncPageSize        = 50
	defaultUserRepositoryLimit       = 100
	defaultAuthoredPRSearchLimit     = 100
	defaultAuthoredPRSyncLimit       = 10
	defaultUserPRSyncTimeout         = 45 * time.Second
)

var gitHubStatusCodePattern = regexp.MustCompile(`status (\d{3})`)

type authoredPullRequestTarget struct {
	Repository string
	Number     int
}

type Executor struct {
	cfg                  config.App
	store                *Store
	client               *githubapi.RESTClient
	repositoryCache      *repositoryMetadataCache
	oauthTokenKeys       [][]byte
	restClientFactory    githubRESTClientFactory
	graphqlClientFactory githubGraphQLClientFactory
	graphqlTokenSource   githubGraphQLTokenSource
	installationClient   githubInstallationClientFactory
}

func NewExecutor(cfg config.App, pool *pgxpool.Pool, client *githubapi.RESTClient) *Executor {
	executor := &Executor{
		cfg:                  cfg,
		store:                NewStore(pool),
		client:               client,
		repositoryCache:      newRepositoryMetadataCache(cfg.GitHub.RepositoryCacheTTL),
		oauthTokenKeys:       decodeOptionalOAuthTokenKeys(cfg),
		restClientFactory:    newGitHubRESTClientFactory(cfg),
		graphqlClientFactory: newGitHubGraphQLClientFactory(cfg),
		installationClient:   newGitHubInstallationClientFactory(cfg),
	}
	executor.graphqlTokenSource = executor.graphQLTokenSourceForActor
	return executor
}

func (e *Executor) Ready(ctx context.Context) error {
	if e == nil || e.store == nil || e.store.pool == nil || e.client == nil {
		return ErrUnavailable
	}
	return e.store.Ping(ctx)
}

func (e *Executor) SyncRepository(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	now time.Time,
) (contracts.GitHubSyncExecutionResponse, error) {
	startedAt := now.UTC()
	response := contracts.GitHubSyncExecutionResponse{
		Status:        "failed",
		Mode:          "repository",
		Repository:    strings.TrimSpace(req.Repository),
		CorrelationID: strings.TrimSpace(correlationID),
		StartedAt:     startedAt,
		FinishedAt:    startedAt,
	}

	if e == nil || e.store == nil || e.store.pool == nil || e.client == nil {
		return response, ErrUnavailable
	}
	if strings.TrimSpace(req.Repository) == "" {
		return response, fmt.Errorf("repository is required")
	}
	owner, name, err := splitRepositoryFullName(req.Repository)
	if err != nil {
		return response, err
	}
	runtime, err := e.executorForActor(ctx, actor, startedAt)
	if err != nil {
		_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
		return response, err
	}

	repository, err := runtime.fetchRepository(ctx, owner, name)
	if err != nil {
		_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
		return response, err
	}

	pullRequests, reviewsByNumber, err := runtime.fetchPullRequests(ctx, owner, name, actor)
	if err != nil {
		_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
		return response, err
	}

	issues, err := runtime.fetchIssues(ctx, owner, name)
	if err != nil {
		_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
		return response, err
	}

	commits, err := runtime.fetchCommits(ctx, owner, name)
	if err != nil {
		_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
		return response, err
	}

	finishedAt := time.Now().UTC()
	persisted, err := e.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		result := PersistResult{}

		repositoryID, repositoryTouched, err := tx.UpsertRepository(map[string]any{"repository": repository}, finishedAt)
		if err != nil {
			return PersistResult{}, err
		}
		if repositoryTouched {
			result.RepositoryCount++
		}

		for _, pr := range pullRequests {
			payload := map[string]any{
				"number":       intValue(pr["number"]),
				"repository":   repository,
				"pull_request": pr,
			}
			pullRequestID, pullRequestTouched, labelCount, err := tx.UpsertPullRequest(payload, repositoryID, finishedAt)
			if err != nil {
				return PersistResult{}, err
			}
			if pullRequestTouched {
				result.PullRequestCount++
			}
			result.LabelCount += labelCount

			for _, review := range reviewsByNumber[intValue(pr["number"])] {
				reviewTouched, err := tx.UpsertReview(map[string]any{"review": review}, pullRequestID, finishedAt)
				if err != nil {
					return PersistResult{}, err
				}
				if reviewTouched {
					result.ReviewCount++
				}
			}
		}

		for _, issue := range issues {
			issueTouched, labelCount, err := tx.UpsertIssue(map[string]any{
				"repository": repository,
				"issue":      issue,
			}, repositoryID, finishedAt)
			if err != nil {
				return PersistResult{}, err
			}
			if issueTouched {
				result.IssueCount++
			}
			result.LabelCount += labelCount
		}

		commitCount, err := tx.UpsertCommits(map[string]any{"commits": commits}, repositoryID, finishedAt)
		if err != nil {
			return PersistResult{}, err
		}
		result.CommitCount += commitCount

		if err := tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:               strings.TrimSpace(correlationID),
			EventType:                   "repository",
			Status:                      "completed",
			Subject:                     strings.TrimSpace(req.Repository),
			RepositoryID:                repositoryID,
			RequestedRepositoryFullName: req.Repository,
			RequestedBySubject:          actor.Subject,
			RequestedByGitHubLogin:      actor.GitHubLogin,
			Result:                      result,
			StartedAt:                   startedAt,
			FinishedAt:                  timePointer(finishedAt),
		}); err != nil {
			return PersistResult{}, err
		}

		return result, nil
	})
	if err != nil {
		_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
		return response, err
	}

	response.Status = "completed"
	response.FinishedAt = finishedAt
	response.Persisted = persisted.EntityCounts()
	response.Fetched = map[string]int{
		"repositories":  1,
		"pull_requests": len(pullRequests),
		"reviews":       countReviewMaps(reviewsByNumber),
		"issues":        len(issues),
		"commits":       len(commits),
	}
	return response, nil
}

func (e *Executor) SyncUser(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	now time.Time,
) (contracts.GitHubSyncExecutionResponse, error) {
	startedAt := now.UTC()
	user := strings.TrimSpace(req.User)
	response := contracts.GitHubSyncExecutionResponse{
		Status:        "failed",
		Mode:          "user",
		User:          user,
		CorrelationID: strings.TrimSpace(correlationID),
		StartedAt:     startedAt,
		FinishedAt:    startedAt,
		Fetched:       map[string]int{},
		Persisted:     map[string]int{},
	}

	if e == nil || e.store == nil || e.store.pool == nil || e.client == nil {
		return response, ErrUnavailable
	}
	if user == "" {
		return response, fmt.Errorf("user is required")
	}
	if !isValidGitHubLogin(user) {
		return response, fmt.Errorf("user must be a GitHub login")
	}
	runtime, err := e.executorForActor(ctx, actor, startedAt)
	if err != nil {
		_ = e.recordFailedUserSyncRun(ctx, user, req, actor, correlationID, startedAt, err, PersistResult{})
		return response, err
	}

	authoredPullRequests, authoredSearchIncomplete, err := runtime.fetchAuthoredPullRequestTargets(ctx, user)
	if err != nil {
		response.Fetched["authored_pull_request_search_failed"] = 1
		authoredPullRequests = nil
		authoredSearchIncomplete = true
		if !isRecoverableUserSyncSelectionError(err) {
			response.Fetched["authored_pull_request_search_unclassified"] = 1
		}
	}
	if len(authoredPullRequests) > defaultAuthoredPRSyncLimit {
		authoredPullRequests = authoredPullRequests[:defaultAuthoredPRSyncLimit]
		response.Fetched["authored_pull_requests_capped"] = 1
	}
	aggregatePersisted := PersistResult{}
	response.Fetched["repositories_selected"] = uniqueRepositoryCountFromAuthoredTargets(authoredPullRequests)
	response.Fetched["authored_pull_requests_selected"] = len(authoredPullRequests)
	if authoredSearchIncomplete {
		response.Fetched["authored_pull_request_search_incomplete"] = 1
	}
	baseCorrelationID := strings.TrimSpace(correlationID)
	if baseCorrelationID == "" {
		baseCorrelationID = "sync-user:" + user
	}

	for index, target := range authoredPullRequests {
		if target.Repository == "" || target.Number <= 0 {
			continue
		}
		childCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), boundedUserPRSyncTimeout(e.cfg))
		child, err := runtime.SyncPullRequest(childCtx, contracts.SyncRequest{
			Mode:       "pull_request",
			Repository: target.Repository,
			Number:     target.Number,
		}, actor, fmt.Sprintf("%s:authored-pr:%d", baseCorrelationID, index+1), time.Now().UTC())
		cancel()
		if err != nil {
			response.Fetched["authored_pull_requests_skipped"]++
			if !isSkippableGitHubSyncError(err) {
				response.Fetched["authored_pull_requests_failed"]++
			}
			continue
		}
		response.Fetched = mergeCountMaps(response.Fetched, child.Fetched)
		response.Persisted = mergeCountMaps(response.Persisted, child.Persisted)
		aggregatePersisted = addPersistResult(aggregatePersisted, persistResultFromCountMap(child.Persisted))
	}

	finishedAt := time.Now().UTC()
	persistCtx := context.WithoutCancel(ctx)
	_, err = e.store.WithTx(persistCtx, func(tx *TxStore) (PersistResult, error) {
		return aggregatePersisted, tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:          strings.TrimSpace(correlationID),
			EventType:              "user",
			Status:                 "completed",
			Subject:                user,
			RequestedUserLogin:     user,
			RequestedBySubject:     actor.Subject,
			RequestedByGitHubLogin: actor.GitHubLogin,
			Result:                 aggregatePersisted,
			StartedAt:              startedAt,
			FinishedAt:             timePointer(finishedAt),
		})
	})
	if err != nil {
		_ = e.recordFailedUserSyncRun(ctx, user, req, actor, correlationID, startedAt, err, aggregatePersisted)
		return response, err
	}

	response.Status = "completed"
	response.FinishedAt = finishedAt
	return response, nil
}

func (e *Executor) SyncInstallation(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	now time.Time,
) (contracts.GitHubSyncExecutionResponse, error) {
	startedAt := now.UTC()
	response := contracts.GitHubSyncExecutionResponse{
		Status:        "failed",
		Mode:          "installation",
		Installation:  req.InstallationID,
		CorrelationID: strings.TrimSpace(correlationID),
		StartedAt:     startedAt,
		FinishedAt:    startedAt,
		Fetched:       map[string]int{},
		Persisted:     map[string]int{},
	}

	if e == nil || e.store == nil || e.store.pool == nil || e.client == nil {
		return response, ErrUnavailable
	}
	if req.InstallationID <= 0 {
		return response, fmt.Errorf("installation_id is required")
	}

	installationID, persistedRepositories, err := e.store.ActiveInstallationRepositories(ctx, req.InstallationID)
	if err != nil {
		_ = e.recordFailedInstallationSyncRun(ctx, req, actor, correlationID, startedAt, installationID, err, PersistResult{})
		return response, err
	}
	persistedRepositories = normalizeRepositoryTargets(persistedRepositories)

	repositories := persistedRepositories
	repositoryClient := e.client
	if e.installationClient != nil {
		installationClient, enabled, clientErr := e.installationClient(ctx, req.InstallationID)
		if clientErr != nil {
			_ = e.recordFailedInstallationSyncRun(ctx, req, actor, correlationID, startedAt, installationID, clientErr, PersistResult{})
			return response, clientErr
		}
		if enabled && installationClient != nil {
			repositoryClient = installationClient
			liveRepositories, inventoryIncomplete, liveErr := e.fetchLiveInstallationRepositoryTargets(ctx, installationClient)
			if liveErr != nil {
				_ = e.recordFailedInstallationSyncRun(ctx, req, actor, correlationID, startedAt, installationID, liveErr, PersistResult{})
				return response, liveErr
			}
			repositories = liveRepositories
			response.Fetched["installation_repository_inventory_live"] = 1
			response.Fetched["repositories_selected_live"] = len(liveRepositories)
			if inventoryIncomplete {
				response.Fetched["installation_repository_inventory_incomplete"] = 1
			}
		}
	}

	aggregatePersisted := PersistResult{}
	response.Fetched["repositories_selected_persisted"] = len(persistedRepositories)
	response.Fetched["repositories_selected"] = len(repositories)
	baseCorrelationID := strings.TrimSpace(correlationID)
	if baseCorrelationID == "" {
		baseCorrelationID = "sync-installation:" + fmt.Sprintf("%d", req.InstallationID)
	}

	repositoryExecutor := e
	if repositoryClient != e.client {
		cloned := *e
		cloned.client = repositoryClient
		repositoryExecutor = &cloned
	}

	for index, repository := range repositories {
		child, err := repositoryExecutor.SyncRepository(ctx, contracts.SyncRequest{
			Mode:       "repository",
			Repository: repository,
		}, actor, fmt.Sprintf("%s:repo:%d", baseCorrelationID, index+1), time.Now().UTC())
		if err != nil {
			response.FinishedAt = time.Now().UTC()
			_ = e.recordFailedInstallationSyncRun(ctx, req, actor, correlationID, startedAt, installationID, err, aggregatePersisted)
			return response, err
		}
		response.Fetched = mergeCountMaps(response.Fetched, child.Fetched)
		response.Persisted = mergeCountMaps(response.Persisted, child.Persisted)
		aggregatePersisted = addPersistResult(aggregatePersisted, persistResultFromCountMap(child.Persisted))
	}

	finishedAt := time.Now().UTC()
	_, err = e.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		return aggregatePersisted, tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:          strings.TrimSpace(correlationID),
			EventType:              "installation",
			Status:                 "completed",
			Subject:                fmt.Sprintf("%d", req.InstallationID),
			InstallationID:         installationID,
			InstallationSourceID:   req.InstallationID,
			RequestedBySubject:     actor.Subject,
			RequestedByGitHubLogin: actor.GitHubLogin,
			Result:                 aggregatePersisted,
			StartedAt:              startedAt,
			FinishedAt:             timePointer(finishedAt),
		})
	})
	if err != nil {
		_ = e.recordFailedInstallationSyncRun(ctx, req, actor, correlationID, startedAt, installationID, err, aggregatePersisted)
		return response, err
	}

	response.Status = "completed"
	response.FinishedAt = finishedAt
	return response, nil
}

func (e *Executor) SyncPullRequest(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	now time.Time,
) (contracts.GitHubSyncExecutionResponse, error) {
	return e.syncPullRequestSurface(ctx, req, actor, correlationID, now, "pull_request")
}

func (e *Executor) SyncReview(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	now time.Time,
) (contracts.GitHubSyncExecutionResponse, error) {
	return e.syncPullRequestSurface(ctx, req, actor, correlationID, now, "review")
}

func (e *Executor) syncPullRequestSurface(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	now time.Time,
	mode string,
) (contracts.GitHubSyncExecutionResponse, error) {
	startedAt := now.UTC()
	response := contracts.GitHubSyncExecutionResponse{
		Status:        "failed",
		Mode:          mode,
		Repository:    strings.TrimSpace(req.Repository),
		Number:        req.Number,
		CorrelationID: strings.TrimSpace(correlationID),
		StartedAt:     startedAt,
		FinishedAt:    startedAt,
	}

	if e == nil || e.store == nil || e.store.pool == nil || e.client == nil {
		return response, ErrUnavailable
	}
	if strings.TrimSpace(req.Repository) == "" || req.Number <= 0 {
		return response, fmt.Errorf("repository and number are required")
	}

	owner, name, err := splitRepositoryFullName(req.Repository)
	if err != nil {
		return response, err
	}

	repository, err := e.fetchRepository(ctx, owner, name)
	if err != nil {
		_ = e.recordFailedPullRequestSurfaceSyncRun(ctx, req, actor, correlationID, startedAt, mode, err)
		return response, err
	}

	pullRequest, err := e.fetchPullRequest(ctx, owner, name, req.Number)
	if err != nil {
		_ = e.recordFailedPullRequestSurfaceSyncRun(ctx, req, actor, correlationID, startedAt, mode, err)
		return response, err
	}

	var reviews []map[string]any
	reviews, err = e.fetchPullRequestReviews(ctx, owner, name, req.Number)
	reviewsSkipped := false
	if err != nil {
		if isSkippableGitHubSyncError(err) {
			reviewsSkipped = true
			reviews = nil
		} else {
			_ = e.recordFailedPullRequestSurfaceSyncRun(ctx, req, actor, correlationID, startedAt, mode, err)
			return response, err
		}
	}

	var reviewComments []map[string]any
	reviewComments, err = e.fetchPullRequestReviewComments(ctx, owner, name, req.Number)
	reviewCommentsSkipped := false
	if err != nil {
		if isSkippableGitHubSyncError(err) {
			reviewCommentsSkipped = true
			reviewComments = nil
		} else {
			_ = e.recordFailedPullRequestSurfaceSyncRun(ctx, req, actor, correlationID, startedAt, mode, err)
			return response, err
		}
	}

	var files []map[string]any
	files, err = e.fetchPullRequestFiles(ctx, owner, name, req.Number)
	filesSkipped := false
	if err != nil {
		if isSkippableGitHubSyncError(err) {
			filesSkipped = true
			files = nil
		} else {
			_ = e.recordFailedPullRequestSurfaceSyncRun(ctx, req, actor, correlationID, startedAt, mode, err)
			return response, err
		}
	}

	finishedAt := time.Now().UTC()
	persisted, err := e.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		result := PersistResult{}

		repositoryID, repositoryTouched, err := tx.UpsertRepository(map[string]any{"repository": repository}, finishedAt)
		if err != nil {
			return PersistResult{}, err
		}
		if repositoryTouched {
			result.RepositoryCount++
		}

		payload := map[string]any{
			"number":       req.Number,
			"repository":   repository,
			"pull_request": pullRequest,
		}
		pullRequestID, pullRequestTouched, labelCount, err := tx.UpsertPullRequest(payload, repositoryID, finishedAt)
		if err != nil {
			return PersistResult{}, err
		}
		if pullRequestTouched {
			result.PullRequestCount++
		}
		result.LabelCount += labelCount

		for _, file := range files {
			fileTouched, err := tx.UpsertPullRequestFile(file, pullRequestID)
			if err != nil {
				return PersistResult{}, err
			}
			if fileTouched {
				result.PullRequestFileCount++
			}
		}

		for _, review := range reviews {
			reviewTouched, err := tx.UpsertReview(map[string]any{"review": review}, pullRequestID, finishedAt)
			if err != nil {
				return PersistResult{}, err
			}
			if reviewTouched {
				result.ReviewCount++
			}
		}

		for _, comment := range reviewComments {
			payload := map[string]any{
				"comment": comment,
			}
			_, reviewID, err := tx.UpsertReviewFromComment(payload, pullRequestID, finishedAt)
			if err != nil {
				return PersistResult{}, err
			}
			commentTouched, err := tx.UpsertReviewComment(payload, pullRequestID, reviewID, finishedAt)
			if err != nil {
				return PersistResult{}, err
			}
			if commentTouched {
				result.ReviewCommentCount++
			}
		}

		if err := tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:               strings.TrimSpace(correlationID),
			EventType:                   mode,
			Status:                      "completed",
			Subject:                     fmt.Sprintf("%s#%d", strings.TrimSpace(req.Repository), req.Number),
			RepositoryID:                repositoryID,
			RequestedRepositoryFullName: req.Repository,
			RequestedBySubject:          actor.Subject,
			RequestedByGitHubLogin:      actor.GitHubLogin,
			Result:                      result,
			StartedAt:                   startedAt,
			FinishedAt:                  timePointer(finishedAt),
		}); err != nil {
			return PersistResult{}, err
		}

		return result, nil
	})
	if err != nil {
		_ = e.recordFailedPullRequestSurfaceSyncRun(ctx, req, actor, correlationID, startedAt, mode, err)
		return response, err
	}

	response.Status = "completed"
	response.FinishedAt = finishedAt
	response.Persisted = persisted.EntityCounts()
	response.Fetched = map[string]int{
		"repositories":       1,
		"pull_requests":      1,
		"pull_request_files": len(files),
		"reviews":            len(reviews),
		"review_comments":    len(reviewComments),
	}
	if reviewsSkipped {
		response.Fetched["reviews_skipped"] = 1
	}
	if reviewCommentsSkipped {
		response.Fetched["review_comments_skipped"] = 1
	}
	if filesSkipped {
		response.Fetched["pull_request_files_skipped"] = 1
	}
	return response, nil
}

func (e *Executor) SyncIssue(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	now time.Time,
) (contracts.GitHubSyncExecutionResponse, error) {
	startedAt := now.UTC()
	response := contracts.GitHubSyncExecutionResponse{
		Status:        "failed",
		Mode:          "issue",
		Repository:    strings.TrimSpace(req.Repository),
		Number:        req.Number,
		CorrelationID: strings.TrimSpace(correlationID),
		StartedAt:     startedAt,
		FinishedAt:    startedAt,
	}

	if e == nil || e.store == nil || e.store.pool == nil || e.client == nil {
		return response, ErrUnavailable
	}
	if strings.TrimSpace(req.Repository) == "" || req.Number <= 0 {
		return response, fmt.Errorf("repository and number are required")
	}

	owner, name, err := splitRepositoryFullName(req.Repository)
	if err != nil {
		return response, err
	}

	repository, err := e.fetchRepository(ctx, owner, name)
	if err != nil {
		_ = e.recordFailedIssueSyncRun(ctx, req, actor, correlationID, startedAt, err)
		return response, err
	}

	issue, err := e.fetchIssue(ctx, owner, name, req.Number)
	if err != nil {
		_ = e.recordFailedIssueSyncRun(ctx, req, actor, correlationID, startedAt, err)
		return response, err
	}

	finishedAt := time.Now().UTC()
	persisted, err := e.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		result := PersistResult{}

		repositoryID, repositoryTouched, err := tx.UpsertRepository(map[string]any{"repository": repository}, finishedAt)
		if err != nil {
			return PersistResult{}, err
		}
		if repositoryTouched {
			result.RepositoryCount++
		}

		issueTouched, labelCount, err := tx.UpsertIssue(map[string]any{
			"repository": repository,
			"issue":      issue,
		}, repositoryID, finishedAt)
		if err != nil {
			return PersistResult{}, err
		}
		if issueTouched {
			result.IssueCount++
		}
		result.LabelCount += labelCount

		if err := tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:               strings.TrimSpace(correlationID),
			EventType:                   "issue",
			Status:                      "completed",
			Subject:                     fmt.Sprintf("%s#%d", strings.TrimSpace(req.Repository), req.Number),
			RepositoryID:                repositoryID,
			RequestedRepositoryFullName: req.Repository,
			RequestedBySubject:          actor.Subject,
			RequestedByGitHubLogin:      actor.GitHubLogin,
			Result:                      result,
			StartedAt:                   startedAt,
			FinishedAt:                  timePointer(finishedAt),
		}); err != nil {
			return PersistResult{}, err
		}

		return result, nil
	})
	if err != nil {
		_ = e.recordFailedIssueSyncRun(ctx, req, actor, correlationID, startedAt, err)
		return response, err
	}

	response.Status = "completed"
	response.FinishedAt = finishedAt
	response.Persisted = persisted.EntityCounts()
	response.Fetched = map[string]int{
		"repositories": 1,
		"issues":       1,
	}
	return response, nil
}

func (e *Executor) SyncCommit(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	now time.Time,
) (contracts.GitHubSyncExecutionResponse, error) {
	startedAt := now.UTC()
	response := contracts.GitHubSyncExecutionResponse{
		Status:        "failed",
		Mode:          "commit",
		Repository:    strings.TrimSpace(req.Repository),
		SHA:           strings.TrimSpace(req.SHA),
		CorrelationID: strings.TrimSpace(correlationID),
		StartedAt:     startedAt,
		FinishedAt:    startedAt,
	}

	if e == nil || e.store == nil || e.store.pool == nil || e.client == nil {
		return response, ErrUnavailable
	}
	if strings.TrimSpace(req.Repository) == "" || strings.TrimSpace(req.SHA) == "" {
		return response, fmt.Errorf("repository and sha are required")
	}

	owner, name, err := splitRepositoryFullName(req.Repository)
	if err != nil {
		return response, err
	}

	repository, err := e.fetchRepository(ctx, owner, name)
	if err != nil {
		_ = e.recordFailedCommitSyncRun(ctx, req, actor, correlationID, startedAt, err)
		return response, err
	}

	commit, err := e.fetchCommit(ctx, owner, name, req.SHA)
	if err != nil {
		_ = e.recordFailedCommitSyncRun(ctx, req, actor, correlationID, startedAt, err)
		return response, err
	}

	finishedAt := time.Now().UTC()
	persisted, err := e.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		result := PersistResult{}

		repositoryID, repositoryTouched, err := tx.UpsertRepository(map[string]any{"repository": repository}, finishedAt)
		if err != nil {
			return PersistResult{}, err
		}
		if repositoryTouched {
			result.RepositoryCount++
		}

		commitCount, err := tx.UpsertCommits(map[string]any{
			"commits": normalizeCommits([]map[string]any{commit}),
		}, repositoryID, finishedAt)
		if err != nil {
			return PersistResult{}, err
		}
		result.CommitCount += commitCount

		if err := tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:               strings.TrimSpace(correlationID),
			EventType:                   "commit",
			Status:                      "completed",
			Subject:                     fmt.Sprintf("%s@%s", strings.TrimSpace(req.Repository), strings.TrimSpace(req.SHA)),
			RepositoryID:                repositoryID,
			RequestedRepositoryFullName: req.Repository,
			RequestedBySubject:          actor.Subject,
			RequestedByGitHubLogin:      actor.GitHubLogin,
			Result:                      result,
			StartedAt:                   startedAt,
			FinishedAt:                  timePointer(finishedAt),
		}); err != nil {
			return PersistResult{}, err
		}

		return result, nil
	})
	if err != nil {
		_ = e.recordFailedCommitSyncRun(ctx, req, actor, correlationID, startedAt, err)
		return response, err
	}

	response.Status = "completed"
	response.FinishedAt = finishedAt
	response.Persisted = persisted.EntityCounts()
	response.Fetched = map[string]int{
		"repositories": 1,
		"commits":      1,
	}
	return response, nil
}

func (e *Executor) recordFailedSyncRun(
	ctx context.Context,
	subject string,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	startedAt time.Time,
	failure error,
) error {
	if e == nil || e.store == nil || e.store.pool == nil {
		return nil
	}

	_, err := e.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		repositoryID, lookupErr := tx.lookupRepositoryIDByFullName(req.Repository)
		if lookupErr != nil {
			return PersistResult{}, lookupErr
		}
		return PersistResult{}, tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:               strings.TrimSpace(correlationID),
			EventType:                   "repository",
			Status:                      "failed",
			LastError:                   failure.Error(),
			Subject:                     strings.TrimSpace(subject),
			RepositoryID:                repositoryID,
			RequestedRepositoryFullName: req.Repository,
			RequestedUserLogin:          req.User,
			RequestedBySubject:          actor.Subject,
			RequestedByGitHubLogin:      actor.GitHubLogin,
			StartedAt:                   startedAt,
			FinishedAt:                  timePointer(time.Now().UTC()),
		})
	})
	return err
}

func (e *Executor) recordFailedUserSyncRun(
	ctx context.Context,
	user string,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	startedAt time.Time,
	failure error,
	result PersistResult,
) error {
	if e == nil || e.store == nil || e.store.pool == nil {
		return nil
	}

	_, err := e.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		return result, tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:          strings.TrimSpace(correlationID),
			EventType:              "user",
			Status:                 "failed",
			LastError:              failure.Error(),
			Subject:                strings.TrimSpace(user),
			RequestedUserLogin:     strings.TrimSpace(req.User),
			RequestedBySubject:     actor.Subject,
			RequestedByGitHubLogin: actor.GitHubLogin,
			Result:                 result,
			StartedAt:              startedAt,
			FinishedAt:             timePointer(time.Now().UTC()),
		})
	})
	return err
}

func (e *Executor) recordFailedInstallationSyncRun(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	startedAt time.Time,
	installationID string,
	failure error,
	result PersistResult,
) error {
	if e == nil || e.store == nil || e.store.pool == nil {
		return nil
	}

	_, err := e.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		return result, tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:          strings.TrimSpace(correlationID),
			EventType:              "installation",
			Status:                 "failed",
			LastError:              failure.Error(),
			Subject:                fmt.Sprintf("%d", req.InstallationID),
			InstallationID:         installationID,
			InstallationSourceID:   req.InstallationID,
			RequestedBySubject:     actor.Subject,
			RequestedByGitHubLogin: actor.GitHubLogin,
			Result:                 result,
			StartedAt:              startedAt,
			FinishedAt:             timePointer(time.Now().UTC()),
		})
	})
	return err
}

func (e *Executor) recordFailedPullRequestSurfaceSyncRun(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	startedAt time.Time,
	mode string,
	failure error,
) error {
	if e == nil || e.store == nil || e.store.pool == nil {
		return nil
	}

	_, err := e.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		repositoryID, lookupErr := tx.lookupRepositoryIDByFullName(req.Repository)
		if lookupErr != nil {
			return PersistResult{}, lookupErr
		}
		return PersistResult{}, tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:               strings.TrimSpace(correlationID),
			EventType:                   mode,
			Status:                      "failed",
			LastError:                   failure.Error(),
			Subject:                     fmt.Sprintf("%s#%d", strings.TrimSpace(req.Repository), req.Number),
			RepositoryID:                repositoryID,
			RequestedRepositoryFullName: req.Repository,
			RequestedBySubject:          actor.Subject,
			RequestedByGitHubLogin:      actor.GitHubLogin,
			StartedAt:                   startedAt,
			FinishedAt:                  timePointer(time.Now().UTC()),
		})
	})
	return err
}

func (e *Executor) recordFailedIssueSyncRun(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	startedAt time.Time,
	failure error,
) error {
	if e == nil || e.store == nil || e.store.pool == nil {
		return nil
	}

	_, err := e.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		repositoryID, lookupErr := tx.lookupRepositoryIDByFullName(req.Repository)
		if lookupErr != nil {
			return PersistResult{}, lookupErr
		}
		return PersistResult{}, tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:               strings.TrimSpace(correlationID),
			EventType:                   "issue",
			Status:                      "failed",
			LastError:                   failure.Error(),
			Subject:                     fmt.Sprintf("%s#%d", strings.TrimSpace(req.Repository), req.Number),
			RepositoryID:                repositoryID,
			RequestedRepositoryFullName: req.Repository,
			RequestedBySubject:          actor.Subject,
			RequestedByGitHubLogin:      actor.GitHubLogin,
			StartedAt:                   startedAt,
			FinishedAt:                  timePointer(time.Now().UTC()),
		})
	})
	return err
}

func (e *Executor) recordFailedCommitSyncRun(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	startedAt time.Time,
	failure error,
) error {
	if e == nil || e.store == nil || e.store.pool == nil {
		return nil
	}

	_, err := e.store.WithTx(ctx, func(tx *TxStore) (PersistResult, error) {
		repositoryID, lookupErr := tx.lookupRepositoryIDByFullName(req.Repository)
		if lookupErr != nil {
			return PersistResult{}, lookupErr
		}
		return PersistResult{}, tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:               strings.TrimSpace(correlationID),
			EventType:                   "commit",
			Status:                      "failed",
			LastError:                   failure.Error(),
			Subject:                     fmt.Sprintf("%s@%s", strings.TrimSpace(req.Repository), strings.TrimSpace(req.SHA)),
			RepositoryID:                repositoryID,
			RequestedRepositoryFullName: req.Repository,
			RequestedBySubject:          actor.Subject,
			RequestedByGitHubLogin:      actor.GitHubLogin,
			StartedAt:                   startedAt,
			FinishedAt:                  timePointer(time.Now().UTC()),
		})
	})
	return err
}

func (e *Executor) fetchUserRepositories(ctx context.Context, user string) ([]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultUserRepositoryLimit)
	var repositories []map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/users/%s/repos", url.PathEscape(user)), url.Values{
		"type":      []string{"owner"},
		"sort":      []string{"updated"},
		"direction": []string{"desc"},
		"per_page":  []string{fmt.Sprintf("%d", perPage)},
	}, githubapi.ConditionalRequest{}, &repositories)
	if err != nil {
		return nil, err
	}

	filtered := make([]map[string]any, 0, len(repositories))
	for _, repository := range repositories {
		if repository == nil {
			continue
		}
		if boolValue(repository["archived"]) || boolValue(repository["disabled"]) {
			continue
		}
		if strings.TrimSpace(stringValue(repository["full_name"])) == "" {
			continue
		}
		filtered = append(filtered, repository)
	}
	return filtered, nil
}

func (e *Executor) fetchAuthoredPullRequestTargets(ctx context.Context, user string) ([]authoredPullRequestTarget, bool, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultAuthoredPRSearchLimit)
	result, _, err := githubapi.SearchIssuesAndPullRequests(ctx, e.client, githubapi.IssueSearchRequest{
		Query:   fmt.Sprintf("author:%s type:pr archived:false", user),
		Sort:    "updated",
		Order:   "desc",
		PerPage: perPage,
	})
	if err != nil {
		return nil, false, err
	}

	targets := make([]authoredPullRequestTarget, 0, len(result.Items))
	seen := make(map[string]struct{}, len(result.Items))
	for _, item := range result.Items {
		target, ok := authoredPullRequestTargetFromSearchItem(item)
		if !ok {
			continue
		}
		key := strings.ToLower(fmt.Sprintf("%s#%d", target.Repository, target.Number))
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		targets = append(targets, target)
	}
	return targets, result.IncompleteResults, nil
}

func authoredPullRequestTargetFromSearchItem(item githubapi.IssueSearchResultItem) (authoredPullRequestTarget, bool) {
	if item.PullRequest == nil || item.Number <= 0 {
		return authoredPullRequestTarget{}, false
	}
	if item.Repository != nil {
		if item.Repository.Private || item.Repository.Archived || item.Repository.Disabled {
			return authoredPullRequestTarget{}, false
		}
		if repository := strings.TrimSpace(item.Repository.FullName); repository != "" {
			if _, _, err := splitRepositoryFullName(repository); err == nil {
				return authoredPullRequestTarget{Repository: repository, Number: item.Number}, true
			}
		}
	}
	repository, ok := repositoryFullNameFromRepositoryURL(item.RepositoryURL)
	if !ok {
		return authoredPullRequestTarget{}, false
	}
	return authoredPullRequestTarget{Repository: repository, Number: item.Number}, true
}

func repositoryFullNameFromRepositoryURL(rawURL string) (string, bool) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return "", false
	}
	segments := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	for index, segment := range segments {
		if segment != "repos" || index+2 >= len(segments) {
			continue
		}
		owner, ownerErr := url.PathUnescape(segments[index+1])
		name, nameErr := url.PathUnescape(segments[index+2])
		if ownerErr != nil || nameErr != nil {
			return "", false
		}
		repository := strings.TrimSpace(owner) + "/" + strings.TrimSpace(name)
		if _, _, err := splitRepositoryFullName(repository); err != nil {
			return "", false
		}
		return repository, true
	}
	return "", false
}

func (e *Executor) fetchPullRequest(ctx context.Context, owner, name string, number int) (map[string]any, error) {
	var pullRequest map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/pulls/%d", owner, name, number), nil, githubapi.ConditionalRequest{}, &pullRequest)
	if err != nil {
		return nil, err
	}
	return normalizePullRequest(pullRequest), nil
}

func (e *Executor) fetchPullRequestReviews(ctx context.Context, owner, name string, number int) ([]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultPullRequestReviewPageSize)
	var reviews []map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/pulls/%d/reviews", owner, name, number), url.Values{
		"per_page": []string{fmt.Sprintf("%d", perPage)},
	}, githubapi.ConditionalRequest{}, &reviews)
	if err != nil {
		return nil, err
	}
	return reviews, nil
}

func (e *Executor) fetchPullRequestReviewComments(ctx context.Context, owner, name string, number int) ([]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultRepositorySyncPageSize)
	var comments []map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/pulls/%d/comments", owner, name, number), url.Values{
		"per_page": []string{fmt.Sprintf("%d", perPage)},
	}, githubapi.ConditionalRequest{}, &comments)
	if err != nil {
		return nil, err
	}
	return comments, nil
}

func (e *Executor) fetchPullRequestFiles(ctx context.Context, owner, name string, number int) ([]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultRepositorySyncPageSize)
	var files []map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/pulls/%d/files", owner, name, number), url.Values{
		"per_page": []string{fmt.Sprintf("%d", perPage)},
	}, githubapi.ConditionalRequest{}, &files)
	if err != nil {
		return nil, err
	}
	return files, nil
}

func (e *Executor) fetchIssue(ctx context.Context, owner, name string, number int) (map[string]any, error) {
	var issue map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/issues/%d", owner, name, number), nil, githubapi.ConditionalRequest{}, &issue)
	if err != nil {
		return nil, err
	}
	if object(issue["pull_request"]) != nil {
		return nil, fmt.Errorf("issue %s/%s#%d is a pull request, not a standalone issue", owner, name, number)
	}
	return issue, nil
}

func (e *Executor) fetchCommit(ctx context.Context, owner, name, sha string) (map[string]any, error) {
	var commit map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/commits/%s", owner, name, url.PathEscape(strings.TrimSpace(sha))), nil, githubapi.ConditionalRequest{}, &commit)
	if err != nil {
		return nil, err
	}
	return commit, nil
}

func (e *Executor) fetchRepository(ctx context.Context, owner, name string) (map[string]any, error) {
	cacheKey := repositoryCacheKey(owner, name)
	if e.repositoryCache != nil {
		if repository, ok := e.repositoryCache.Get(cacheKey, time.Now()); ok {
			return repository, nil
		}
	}

	var repository map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s", owner, name), nil, githubapi.ConditionalRequest{}, &repository)
	if err == nil && e.repositoryCache != nil {
		e.repositoryCache.Set(cacheKey, repository, time.Now())
	}
	return repository, err
}

func (e *Executor) fetchPullRequests(ctx context.Context, owner, name string, actor SyncRequestActor) ([]map[string]any, map[int][]map[string]any, error) {
	graphqlClient, useGraphQL, err := e.graphQLClientForActor(ctx, actor, time.Now().UTC())
	if err != nil {
		return nil, nil, err
	}

	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultRepositorySyncPageSize)
	if useGraphQL {
		perPage = min(perPage, boundedPageSize(e.cfg.GitHub.GraphQLPageSize, defaultRepositorySyncPageSize))
	}
	summaries, err := e.fetchPullRequestSummaries(ctx, owner, name, perPage)
	if err != nil {
		return nil, nil, err
	}
	if len(summaries) == 0 {
		return []map[string]any{}, map[int][]map[string]any{}, nil
	}
	if useGraphQL {
		pullRequests, reviewsByNumber, gqlErr := e.fetchPullRequestsGraphQL(ctx, graphqlClient, owner, name, summaries, perPage)
		if gqlErr == nil {
			return pullRequests, reviewsByNumber, nil
		}
	}
	return e.fetchPullRequestsRESTDetails(ctx, owner, name, summaries, perPage)
}

func (e *Executor) fetchPullRequestSummaries(ctx context.Context, owner, name string, perPage int) ([]map[string]any, error) {
	var summaries []map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/pulls", owner, name), url.Values{
		"state":     []string{"all"},
		"sort":      []string{"updated"},
		"direction": []string{"desc"},
		"per_page":  []string{fmt.Sprintf("%d", perPage)},
	}, githubapi.ConditionalRequest{}, &summaries)
	if err != nil {
		return nil, err
	}
	return summaries, nil
}

func (e *Executor) fetchPullRequestsRESTDetails(ctx context.Context, owner, name string, summaries []map[string]any, perPage int) ([]map[string]any, map[int][]map[string]any, error) {
	pullRequests := make([]map[string]any, 0, len(summaries))
	reviewsByNumber := make(map[int][]map[string]any, len(summaries))
	reviewPerPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultPullRequestReviewPageSize)
	for _, summary := range summaries {
		number := intValue(summary["number"])
		if number <= 0 {
			continue
		}

		var pullRequest map[string]any
		_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/pulls/%d", owner, name, number), nil, githubapi.ConditionalRequest{}, &pullRequest)
		if err != nil {
			if isSkippableGitHubSyncError(err) {
				reviewsByNumber[number] = nil
				continue
			}
			return nil, nil, err
		}
		pullRequests = append(pullRequests, normalizePullRequest(pullRequest))

		var reviews []map[string]any
		_, err = e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/pulls/%d/reviews", owner, name, number), url.Values{
			"per_page": []string{fmt.Sprintf("%d", reviewPerPage)},
		}, githubapi.ConditionalRequest{}, &reviews)
		if err != nil {
			if !isSkippableGitHubSyncError(err) {
				return nil, nil, err
			}
			reviewsByNumber[number] = nil
			continue
		}
		reviewsByNumber[number] = reviews
	}
	return pullRequests, reviewsByNumber, nil
}

func (e *Executor) fetchIssues(ctx context.Context, owner, name string) ([]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultRepositorySyncPageSize)
	var issues []map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/issues", owner, name), url.Values{
		"state":     []string{"all"},
		"sort":      []string{"updated"},
		"direction": []string{"desc"},
		"per_page":  []string{fmt.Sprintf("%d", perPage)},
	}, githubapi.ConditionalRequest{}, &issues)
	if err != nil {
		return nil, err
	}

	filtered := make([]map[string]any, 0, len(issues))
	for _, issue := range issues {
		if object(issue["pull_request"]) != nil {
			continue
		}
		filtered = append(filtered, issue)
	}
	return filtered, nil
}

func (e *Executor) fetchCommits(ctx context.Context, owner, name string) ([]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultCommitSyncPageSize)
	var commits []map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/commits", owner, name), url.Values{
		"per_page": []string{fmt.Sprintf("%d", perPage)},
	}, githubapi.ConditionalRequest{}, &commits)
	if err != nil {
		return nil, err
	}
	return normalizeCommits(commits), nil
}

func splitRepositoryFullName(fullName string) (string, string, error) {
	parts := strings.Split(strings.TrimSpace(fullName), "/")
	if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
		return "", "", fmt.Errorf("repository must be in owner/name form")
	}
	return parts[0], parts[1], nil
}

func isValidGitHubLogin(login string) bool {
	login = strings.TrimSpace(login)
	if len(login) == 0 || len(login) > 39 {
		return false
	}
	if login[0] == '-' || login[len(login)-1] == '-' {
		return false
	}
	for _, r := range login {
		if r >= 'a' && r <= 'z' {
			continue
		}
		if r >= 'A' && r <= 'Z' {
			continue
		}
		if r >= '0' && r <= '9' {
			continue
		}
		if r == '-' {
			continue
		}
		return false
	}
	return true
}

func boundedPageSize(configured, fallback int) int {
	if configured > 0 && configured < fallback {
		return configured
	}
	if fallback <= 0 {
		return 20
	}
	return fallback
}

func uniqueRepositoryCountFromAuthoredTargets(targets []authoredPullRequestTarget) int {
	if len(targets) == 0 {
		return 0
	}
	seen := make(map[string]struct{}, len(targets))
	for _, target := range targets {
		repository := strings.ToLower(strings.TrimSpace(target.Repository))
		if repository == "" {
			continue
		}
		seen[repository] = struct{}{}
	}
	return len(seen)
}

func isSkippableGitHubSyncError(err error) bool {
	if isSkippableGitHubTimeoutError(err) {
		return true
	}

	statusCode, ok := gitHubStatusCodeFromError(err)
	if !ok {
		return false
	}

	switch statusCode {
	case http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusGone, http.StatusUnavailableForLegalReasons:
		return true
	default:
		return false
	}
}

func isRecoverableUserSyncSelectionError(err error) bool {
	if err == nil {
		return false
	}
	if isSkippableGitHubSyncError(err) {
		return true
	}

	statusCode, ok := gitHubStatusCodeFromError(err)
	if !ok {
		return false
	}

	if statusCode == http.StatusTooManyRequests {
		return true
	}
	return statusCode >= http.StatusInternalServerError
}

func isSkippableGitHubTimeoutError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	if errors.Is(err, context.Canceled) {
		return true
	}

	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}

	message := strings.ToLower(err.Error())
	return strings.Contains(message, "context deadline exceeded") ||
		strings.Contains(message, "context canceled") ||
		strings.Contains(message, "client.timeout exceeded") ||
		strings.Contains(message, "timeout while awaiting headers") ||
		strings.Contains(message, "timeout awaiting response headers")
}

func boundedUserPRSyncTimeout(cfg config.App) time.Duration {
	timeout := cfg.GitHub.RequestTimeout
	if timeout <= 0 {
		return defaultUserPRSyncTimeout
	}
	if timeout < defaultUserPRSyncTimeout {
		return defaultUserPRSyncTimeout
	}
	return timeout
}

func gitHubStatusCodeFromError(err error) (int, bool) {
	if err == nil {
		return 0, false
	}
	matches := gitHubStatusCodePattern.FindStringSubmatch(err.Error())
	if len(matches) != 2 {
		return 0, false
	}

	var code int
	if _, scanErr := fmt.Sscanf(matches[1], "%d", &code); scanErr != nil || code <= 0 {
		return 0, false
	}
	return code, true
}

type repositoryMetadataCache struct {
	mu      sync.Mutex
	ttl     time.Duration
	entries map[string]repositoryMetadataCacheEntry
}

type repositoryMetadataCacheEntry struct {
	repository map[string]any
	expiresAt  time.Time
}

func newRepositoryMetadataCache(ttl time.Duration) *repositoryMetadataCache {
	if ttl <= 0 {
		return nil
	}
	return &repositoryMetadataCache{
		ttl:     ttl,
		entries: make(map[string]repositoryMetadataCacheEntry),
	}
}

func (c *repositoryMetadataCache) Get(key string, now time.Time) (map[string]any, bool) {
	if c == nil || strings.TrimSpace(key) == "" {
		return nil, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[key]
	if !ok {
		return nil, false
	}
	if !entry.expiresAt.IsZero() && now.After(entry.expiresAt) {
		delete(c.entries, key)
		return nil, false
	}
	return cloneJSONMap(entry.repository), true
}

func (c *repositoryMetadataCache) Set(key string, repository map[string]any, now time.Time) {
	if c == nil || strings.TrimSpace(key) == "" || repository == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries[key] = repositoryMetadataCacheEntry{
		repository: cloneJSONMap(repository),
		expiresAt:  now.Add(c.ttl),
	}
}

func repositoryCacheKey(owner, name string) string {
	return strings.ToLower(strings.TrimSpace(owner) + "/" + strings.TrimSpace(name))
}

func cloneJSONMap(source map[string]any) map[string]any {
	if source == nil {
		return nil
	}
	out := make(map[string]any, len(source))
	for key, value := range source {
		out[key] = cloneJSONValue(value)
	}
	return out
}

func cloneJSONSlice(source []any) []any {
	if source == nil {
		return nil
	}
	out := make([]any, len(source))
	for index, value := range source {
		out[index] = cloneJSONValue(value)
	}
	return out
}

func cloneJSONValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		return cloneJSONMap(typed)
	case []any:
		return cloneJSONSlice(typed)
	default:
		return typed
	}
}

func normalizePullRequest(pullRequest map[string]any) map[string]any {
	if pullRequest == nil {
		return nil
	}
	if pullRequest["merged"] == nil {
		pullRequest["merged"] = stringValue(pullRequest["merged_at"]) != ""
	}
	return pullRequest
}

func normalizeCommits(commits []map[string]any) []map[string]any {
	out := make([]map[string]any, 0, len(commits))
	for _, commit := range commits {
		if commit == nil {
			continue
		}
		normalized := map[string]any{
			"id":      stringValue(commit["sha"]),
			"message": "",
		}
		if nested := object(commit["commit"]); nested != nil {
			normalized["message"] = stringValue(nested["message"])
			if author := object(nested["author"]); author != nil && stringValue(author["date"]) != "" {
				normalized["timestamp"] = stringValue(author["date"])
			} else if committer := object(nested["committer"]); committer != nil {
				normalized["timestamp"] = stringValue(committer["date"])
			}
		}
		out = append(out, normalized)
	}
	return out
}

func countReviewMaps(reviewsByNumber map[int][]map[string]any) int {
	total := 0
	for _, reviews := range reviewsByNumber {
		total += len(reviews)
	}
	return total
}

func mergeCountMaps(dst, src map[string]int) map[string]int {
	if dst == nil {
		dst = map[string]int{}
	}
	for key, value := range src {
		dst[key] += value
	}
	return dst
}

func persistResultFromCountMap(counts map[string]int) PersistResult {
	return PersistResult{
		RepositoryCount:      counts["repositories"],
		InstallationCount:    counts["installations"],
		PullRequestCount:     counts["pull_requests"],
		PullRequestFileCount: counts["pull_request_files"],
		ReviewCount:          counts["reviews"],
		ReviewCommentCount:   counts["review_comments"],
		IssueCount:           counts["issues"],
		LabelCount:           counts["labels"],
		CommitCount:          counts["commits"],
	}
}

func addPersistResult(dst, src PersistResult) PersistResult {
	dst.RepositoryCount += src.RepositoryCount
	dst.InstallationCount += src.InstallationCount
	dst.PullRequestCount += src.PullRequestCount
	dst.PullRequestFileCount += src.PullRequestFileCount
	dst.ReviewCount += src.ReviewCount
	dst.ReviewCommentCount += src.ReviewCommentCount
	dst.IssueCount += src.IssueCount
	dst.LabelCount += src.LabelCount
	dst.CommitCount += src.CommitCount
	return dst
}
