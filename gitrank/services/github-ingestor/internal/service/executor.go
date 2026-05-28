package service

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/githubapi"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultFallbackPageSize      = 20
	authoredPRSearchHardLimit    = 1000
	authoredPRSearchMaxPages     = 10
	authoredPRSearchMaxDepth     = 10
	authoredPRBackfillMaxWindows = 3

	authoredPRBootstrapLookback  = 30 * 24 * time.Hour
	authoredPRRecentSeedLookback = 120 * 24 * time.Hour
	authoredPRBackfillWindow     = 90 * 24 * time.Hour
	authoredPRRescanLookback     = 365 * 24 * time.Hour
	authoredPRMinWindowSpan      = time.Hour

	pullRequestFilesMaxPages          = 30
	pullRequestReviewsMaxPages        = 10
	pullRequestReviewCommentsMaxPages = 10
)

var gitHubStatusCodePattern = regexp.MustCompile(`status (\d{3})`)

type authoredPullRequestTarget struct {
	Repository string
	Number     int
}

type authoredPullRequestSelection struct {
	Targets          []authoredPullRequestTarget
	SearchIncomplete bool
	SearchOverflow   bool
	NextCursor       authoredPRHistoryCursor
	Fetched          map[string]int
}

type authoredPullRequestWindow struct {
	Qualifier string
	Start     time.Time
	End       time.Time
}

type authoredPullRequestDiscoveryStats struct {
	oldestSeenAt  *time.Time
	newestSeenAt  *time.Time
	incomplete    bool
	overflow      bool
	searchQueries int
}

type pullRequestSyncOptions struct {
	skipReviews        bool
	skipReviewComments bool
	filePageSize       int
}

type githubActorInstallationClientFactory func(context.Context, SyncRequestActor) (*githubapi.RESTClient, bool, error)

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
	actorInstallation    githubActorInstallationClientFactory
	userSyncLockMu       sync.Mutex
	activeUserSync       map[string]struct{}
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
		activeUserSync:       map[string]struct{}{},
	}
	executor.graphqlTokenSource = executor.graphQLTokenSourceForActor
	executor.actorInstallation = executor.installationClientForActor
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
	e.markQueuedSyncRunRunning(ctx, correlationID, "repository", strings.TrimSpace(req.Repository), startedAt)
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

	pullRequests := []map[string]any{}
	reviewsByNumber := map[int][]map[string]any{}
	pullRequestsSkipped := false
	pullRequests, reviewsByNumber, err = runtime.fetchPullRequests(ctx, owner, name, actor)
	if err != nil {
		if isSkippableGitHubSyncError(err) {
			pullRequestsSkipped = true
			pullRequests = []map[string]any{}
			reviewsByNumber = map[int][]map[string]any{}
		} else {
			_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
			return response, err
		}
	}

	issues := []map[string]any{}
	issuesSkipped := false
	issues, err = runtime.fetchIssues(ctx, owner, name)
	if err != nil {
		if isSkippableGitHubSyncError(err) {
			issuesSkipped = true
			issues = []map[string]any{}
		} else {
			_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
			return response, err
		}
	}

	commits := []map[string]any{}
	commitsSkipped := false
	commits, err = runtime.fetchCommits(ctx, owner, name)
	if err != nil {
		if isSkippableGitHubSyncError(err) {
			commitsSkipped = true
			commits = []map[string]any{}
		} else {
			_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
			return response, err
		}
	}
	fetchedCounts := map[string]int{
		"repositories":  1,
		"pull_requests": len(pullRequests),
		"reviews":       countReviewMaps(reviewsByNumber),
		"issues":        len(issues),
		"commits":       len(commits),
	}
	if pullRequestsSkipped {
		fetchedCounts["pull_requests_skipped"] = 1
	}
	if issuesSkipped {
		fetchedCounts["issues_skipped"] = 1
	}
	if commitsSkipped {
		fetchedCounts["commits_skipped"] = 1
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
			Fetched:                     fetchedCounts,
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
	response.Fetched = fetchedCounts
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
	e.markQueuedSyncRunRunning(ctx, correlationID, "user", user, startedAt)
	if !e.tryAcquireUserSync(user) {
		_ = e.recordFailedUserSyncRun(ctx, user, req, actor, correlationID, startedAt, ErrUserSyncInProgress, PersistResult{})
		return response, ErrUserSyncInProgress
	}
	defer e.releaseUserSync(user)
	releaseLease, leaseAcquired, leaseErr := e.store.TryAcquireUserSyncLease(ctx, user)
	if leaseErr != nil {
		_ = e.recordFailedUserSyncRun(ctx, user, req, actor, correlationID, startedAt, leaseErr, PersistResult{})
		return response, leaseErr
	}
	if !leaseAcquired {
		_ = e.recordFailedUserSyncRun(ctx, user, req, actor, correlationID, startedAt, ErrUserSyncInProgress, PersistResult{})
		return response, ErrUserSyncInProgress
	}
	defer releaseLease()
	if strings.TrimSpace(actor.GitHubLogin) != "" {
		response.Fetched["app_installation_records_lookup_attempted"] = 1
		installationIDs, installationLookupErr := e.store.ActiveInstallationIDsByAccountLogin(ctx, actor.GitHubLogin)
		if installationLookupErr != nil {
			response.Fetched["app_installation_records_lookup_failed"] = 1
		} else if len(installationIDs) == 0 {
			response.Fetched["app_installation_bootstrap_attempted"] = 1
			bootstrapUpserted, bootstrapErr := e.bootstrapActorInstallations(ctx, actor, startedAt)
			if bootstrapErr != nil {
				response.Fetched["app_installation_bootstrap_failed"] = 1
				if errors.Is(bootstrapErr, ErrUserSyncOAuthTokenRequired) {
					response.Fetched["app_installation_bootstrap_oauth_required"] = 1
				} else if errors.Is(bootstrapErr, ErrUserSyncOAuthTokenMalformed) {
					response.Fetched["app_installation_bootstrap_oauth_malformed"] = 1
				}
			} else {
				response.Fetched["app_installation_bootstrap_upserted"] = bootstrapUpserted
				if bootstrapUpserted > 0 {
					response.Fetched["app_installation_bootstrap_changed"] = 1
				}
			}
		} else {
			response.Fetched["app_installation_records_existing"] = len(installationIDs)
		}
	}
	runtime, credentialSource, err := e.executorForUserSyncActor(ctx, actor, startedAt)
	if err != nil {
		_ = e.recordFailedUserSyncRun(ctx, user, req, actor, correlationID, startedAt, err, PersistResult{})
		return response, err
	}
	switch credentialSource {
	case "oauth":
		response.Fetched["authored_pull_request_auth_oauth"] = 1
	case "installation":
		response.Fetched["authored_pull_request_auth_installation"] = 1
	default:
		response.Fetched["authored_pull_request_auth_shared"] = 1
	}

	authoredPRSyncLimit := boundedAuthoredPRSyncLimit(e.cfg.GitHub, e.cfg.GitHub.AuthoredPRSyncLimit)
	response.Fetched["authored_pull_request_sync_limit"] = authoredPRSyncLimit
	response.Fetched["authored_pull_request_search_limit"] = boundedAuthoredPRSearchLimit(e.cfg.GitHub)
	response.Fetched["authored_pull_request_timeout_seconds"] = int(boundedUserPRSyncTimeout(e.cfg).Seconds())
	cursor, cursorErr := e.store.LoadAuthoredPRHistoryCursor(ctx, user)
	if cursorErr != nil {
		response.Fetched["authored_pull_request_cursor_load_failed"] = 1
		cursor = authoredPRHistoryCursor{}
	}
	selection, err := runtime.fetchAuthoredPullRequestTargets(ctx, user, authoredPRSyncLimit, cursor, startedAt)
	if err != nil {
		response.Fetched["authored_pull_request_search_failed"] = 1
		if isRecoverableUserSyncSelectionError(err) {
			response.Fetched["authored_pull_request_search_retryable"] = 1
		} else {
			response.Fetched["authored_pull_request_search_unclassified"] = 1
		}
		_ = e.recordFailedUserSyncRun(ctx, user, req, actor, correlationID, startedAt, err, PersistResult{})
		return response, err
	}
	if len(selection.Targets) == 0 {
		persistedCount, countErr := e.store.CountAuthoredPullRequestsByLogin(ctx, user)
		if countErr != nil {
			response.Fetched["authored_pull_request_persisted_count_failed"] = 1
		} else {
			response.Fetched["authored_pull_request_persisted_known"] = persistedCount
			if persistedCount > 0 {
				response.Fetched["authored_pull_request_persisted_existing"] = 1
			}
			if shouldForceAuthoredPRBootstrap(cursor, len(selection.Targets), persistedCount) {
				retrySelection, retryErr := runtime.fetchAuthoredPullRequestTargets(ctx, user, authoredPRSyncLimit, authoredPRHistoryCursor{}, startedAt)
				if retryErr != nil {
					response.Fetched["authored_pull_request_bootstrap_retry_failed"] = 1
					response.Fetched["authored_pull_request_search_failed"] = 1
					if isRecoverableUserSyncSelectionError(retryErr) {
						response.Fetched["authored_pull_request_search_retryable"] = 1
					} else {
						response.Fetched["authored_pull_request_search_unclassified"] = 1
					}
					_ = e.recordFailedUserSyncRun(ctx, user, req, actor, correlationID, startedAt, retryErr, PersistResult{})
					return response, retryErr
				}
				selection = retrySelection
				response.Fetched["authored_pull_request_cursor_bootstrap_replayed"] = 1
			}
		}
	}
	authoredPullRequests := selection.Targets
	response.Fetched = mergeCountMaps(response.Fetched, selection.Fetched)
	if len(authoredPullRequests) > authoredPRSyncLimit {
		authoredPullRequests = prioritizeAuthoredPullRequestTargets(
			authoredPullRequests,
			authoredPRSyncLimit,
			selection.NextCursor.BootstrapComplete,
			selection.Fetched["authored_pull_request_recent_seed_targets"],
		)
		response.Fetched["authored_pull_requests_capped"] = 1
	}
	aggregatePersisted := PersistResult{}
	response.Fetched["repositories_selected"] = uniqueRepositoryCountFromAuthoredTargets(authoredPullRequests)
	response.Fetched["authored_pull_requests_selected"] = len(authoredPullRequests)
	if !selection.NextCursor.BootstrapComplete {
		response.Fetched["authored_pull_request_backfill_incomplete"] = 1
	}
	if len(authoredPullRequests) == 0 {
		response.Fetched["authored_pull_request_discovery_empty"] = 1
	}
	annotateAuthoredPullRequestSelectionMetrics(response.Fetched)
	if selection.SearchIncomplete {
		response.Fetched["authored_pull_request_search_incomplete"] = 1
	}
	if selection.SearchOverflow {
		response.Fetched["authored_pull_request_search_overflow"] = 1
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
		child, err := runtime.syncPullRequestSurface(childCtx, contracts.SyncRequest{
			Mode:       "pull_request",
			Repository: target.Repository,
			Number:     target.Number,
		}, actor, fmt.Sprintf("%s:authored-pr:%d", baseCorrelationID, index+1), time.Now().UTC(), "pull_request", pullRequestSyncOptions{
			skipReviews:        true,
			skipReviewComments: true,
			filePageSize:       boundedPageSize(e.cfg.GitHub.MaxPageSize, e.cfg.GitHub.RepositorySyncPageSize),
		})
		cancel()
		if err != nil {
			classifyAuthoredPullRequestHydrationError(response.Fetched, err)
			continue
		}
		if child.Fetched["pull_requests_merged"] > 0 {
			response.Fetched["authored_pull_requests_selected_merged"]++
		} else if child.Fetched["pull_requests_unmerged"] > 0 {
			response.Fetched["authored_pull_requests_selected_unmerged"]++
		} else {
			response.Fetched["authored_pull_requests_selected_lifecycle_unknown"]++
		}
		response.Fetched = mergeCountMaps(response.Fetched, child.Fetched)
		response.Persisted = mergeCountMaps(response.Persisted, child.Persisted)
		aggregatePersisted = addPersistResult(aggregatePersisted, persistResultFromCountMap(child.Persisted))
	}

	if !shouldAdvanceAuthoredPRLastSynced(response.Fetched, selection.SearchIncomplete, selection.SearchOverflow) {
		response.Fetched["authored_pull_request_cursor_held_for_retry"] = 1
		if cursor.LastSyncedAt != nil && !cursor.LastSyncedAt.IsZero() {
			held := cursor.LastSyncedAt.UTC()
			selection.NextCursor.LastSyncedAt = &held
		} else {
			selection.NextCursor.LastSyncedAt = nil
		}
	}

	finishedAt := time.Now().UTC()
	persistCtx := context.WithoutCancel(ctx)
	executionStatus := userSyncExecutionStatus(response.Fetched)
	if err := e.store.UpsertAuthoredPRHistoryCursor(persistCtx, user, selection.NextCursor, finishedAt); err != nil {
		response.Fetched["authored_pull_request_cursor_persist_failed"] = 1
		executionStatus = "partial"
	} else {
		response.Fetched["authored_pull_request_cursor_persisted"] = 1
	}
	_, err = e.store.WithTx(persistCtx, func(tx *TxStore) (PersistResult, error) {
		return aggregatePersisted, tx.InsertSyncRun(payloadSyncRunInput{
			CorrelationID:          strings.TrimSpace(correlationID),
			EventType:              "user",
			Status:                 executionStatus,
			Subject:                user,
			RequestedUserLogin:     user,
			RequestedBySubject:     actor.Subject,
			RequestedByGitHubLogin: actor.GitHubLogin,
			Result:                 aggregatePersisted,
			Fetched:                response.Fetched,
			StartedAt:              startedAt,
			FinishedAt:             timePointer(finishedAt),
		})
	})
	if err != nil {
		_ = e.recordFailedUserSyncRun(ctx, user, req, actor, correlationID, startedAt, err, aggregatePersisted)
		return response, err
	}

	response.Status = executionStatus
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
	e.markQueuedSyncRunRunning(ctx, correlationID, "installation", fmt.Sprintf("%d", req.InstallationID), startedAt)

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
			Fetched:                response.Fetched,
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
	return e.syncPullRequestSurface(ctx, req, actor, correlationID, now, "pull_request", pullRequestSyncOptions{})
}

func (e *Executor) SyncReview(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	now time.Time,
) (contracts.GitHubSyncExecutionResponse, error) {
	return e.syncPullRequestSurface(ctx, req, actor, correlationID, now, "review", pullRequestSyncOptions{})
}

func (e *Executor) syncPullRequestSurface(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	now time.Time,
	mode string,
	options pullRequestSyncOptions,
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
	e.markQueuedSyncRunRunning(
		ctx,
		correlationID,
		mode,
		fmt.Sprintf("%s#%d", strings.TrimSpace(req.Repository), req.Number),
		startedAt,
	)

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
	reviewsSkipped := options.skipReviews
	reviewsFetchError := false
	if !options.skipReviews {
		reviews, err = e.fetchPullRequestReviews(ctx, owner, name, req.Number)
		if err != nil {
			reviewsSkipped = true
			reviewsFetchError = true
			reviews = nil
		}
	}

	var reviewComments []map[string]any
	reviewCommentsSkipped := options.skipReviewComments
	reviewCommentsFetchError := false
	if !options.skipReviewComments {
		reviewComments, err = e.fetchPullRequestReviewComments(ctx, owner, name, req.Number)
		if err != nil {
			reviewCommentsSkipped = true
			reviewCommentsFetchError = true
			reviewComments = nil
		}
	}

	var files []map[string]any
	files, err = e.fetchPullRequestFilesWithPageSize(ctx, owner, name, req.Number, options.filePageSize)
	filesSkipped := false
	filesFetchError := false
	if err != nil {
		filesSkipped = true
		filesFetchError = true
		files = nil
	}
	fetchedCounts := map[string]int{
		"repositories":       1,
		"pull_requests":      1,
		"pull_request_files": len(files),
		"reviews":            len(reviews),
		"review_comments":    len(reviewComments),
	}
	fetchedCounts = mergeCountMaps(fetchedCounts, pullRequestLifecycleFetchedCounts(pullRequest))
	if reviewsSkipped {
		fetchedCounts["reviews_skipped"] = 1
		if options.skipReviews {
			fetchedCounts["reviews_skipped_policy"] = 1
		}
	}
	if reviewCommentsSkipped {
		fetchedCounts["review_comments_skipped"] = 1
		if options.skipReviewComments {
			fetchedCounts["review_comments_skipped_policy"] = 1
		}
	}
	if filesSkipped {
		fetchedCounts["pull_request_files_skipped"] = 1
	}
	if reviewsFetchError {
		fetchedCounts["reviews_fetch_errors"] = 1
	}
	if reviewCommentsFetchError {
		fetchedCounts["review_comments_fetch_errors"] = 1
	}
	if filesFetchError {
		fetchedCounts["pull_request_files_fetch_errors"] = 1
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
			Fetched:                     fetchedCounts,
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
	response.Fetched = fetchedCounts
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
	e.markQueuedSyncRunRunning(
		ctx,
		correlationID,
		"issue",
		fmt.Sprintf("%s#%d", strings.TrimSpace(req.Repository), req.Number),
		startedAt,
	)

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
	fetchedCounts := map[string]int{
		"repositories": 1,
		"issues":       1,
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
			Fetched:                     fetchedCounts,
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
	response.Fetched = fetchedCounts
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
	e.markQueuedSyncRunRunning(
		ctx,
		correlationID,
		"commit",
		fmt.Sprintf("%s@%s", strings.TrimSpace(req.Repository), strings.TrimSpace(req.SHA)),
		startedAt,
	)

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
	fetchedCounts := map[string]int{
		"repositories": 1,
		"commits":      1,
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
			Fetched:                     fetchedCounts,
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
	response.Fetched = fetchedCounts
	return response, nil
}

func (e *Executor) markQueuedSyncRunRunning(
	ctx context.Context,
	correlationID string,
	runType string,
	subject string,
	startedAt time.Time,
) {
	if e == nil || e.store == nil || e.store.pool == nil {
		return
	}
	_, _ = e.store.MarkSyncRunRunning(
		context.WithoutCancel(ctx),
		strings.TrimSpace(correlationID),
		strings.TrimSpace(runType),
		strings.TrimSpace(subject),
		startedAt.UTC(),
	)
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
			Fetched:                     syncFailureFetchedMetrics(failure),
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
			Fetched:                syncFailureFetchedMetrics(failure),
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
			Fetched:                syncFailureFetchedMetrics(failure),
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
			Fetched:                     syncFailureFetchedMetrics(failure),
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
			Fetched:                     syncFailureFetchedMetrics(failure),
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
			Fetched:                     syncFailureFetchedMetrics(failure),
			StartedAt:                   startedAt,
			FinishedAt:                  timePointer(time.Now().UTC()),
		})
	})
	return err
}

func (e *Executor) fetchUserRepositories(ctx context.Context, user string) ([]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, e.cfg.GitHub.UserRepositorySyncLimit)
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

func (e *Executor) fetchAuthoredPullRequestTargets(
	ctx context.Context,
	user string,
	limit int,
	cursor authoredPRHistoryCursor,
	now time.Time,
) (authoredPullRequestSelection, error) {
	user = strings.TrimSpace(user)
	if user == "" {
		return authoredPullRequestSelection{}, errors.New("user is required")
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	now = now.UTC()

	perPage := 100
	maxTargets := max(60, limit*6)
	if e.cfg.GitHub.AuthoredPRSearchLimit > 0 {
		maxTargets = min(maxTargets, e.cfg.GitHub.AuthoredPRSearchLimit)
	}
	incrementalTargetLimit := maxTargets
	if shouldReserveAuthoredPRBackfill(cursor) && maxTargets > 1 {
		incrementalTargetLimit = max(limit*2, maxTargets/2)
		if incrementalTargetLimit >= maxTargets {
			incrementalTargetLimit = maxTargets - 1
		}
	}

	selection := authoredPullRequestSelection{
		Targets:    make([]authoredPullRequestTarget, 0, min(maxTargets, authoredPRSearchMaxPages*perPage)),
		NextCursor: cursor,
		Fetched:    map[string]int{},
	}
	seenTargets := make(map[string]struct{}, maxTargets)
	combinedStats := authoredPullRequestDiscoveryStats{}

	// Fresh-first discovery guardrail:
	// always sample newest authored PRs by created date before incremental
	// windows, so new PRs are not starved by noisy updated-sorted history.
	recentSeedStart := now.Add(-authoredPRRecentSeedLookback).UTC()
	if recentSeedStart.Before(gitHubSearchEpoch()) {
		recentSeedStart = gitHubSearchEpoch()
	}
	recentSeedLimit := min(maxTargets, max(limit*2, 12))
	if recentSeedLimit > 0 {
		recentSeedWindow := authoredPullRequestWindow{
			Qualifier: "created",
			Start:     recentSeedStart,
			End:       now,
		}
		recentSeedTargets, recentSeedStats, recentSeedErr := e.discoverAuthoredPullRequestTargetsInWindow(
			ctx,
			user,
			recentSeedWindow,
			perPage,
			0,
			recentSeedLimit,
		)
		if recentSeedErr != nil {
			return authoredPullRequestSelection{}, recentSeedErr
		}
		beforeRecentAppend := len(selection.Targets)
		selection.Targets = appendUniqueAuthoredPullRequestTargets(selection.Targets, recentSeedTargets, seenTargets, maxTargets)
		recentSeedAdded := len(selection.Targets) - beforeRecentAppend
		selection.SearchIncomplete = selection.SearchIncomplete || recentSeedStats.incomplete
		selection.SearchOverflow = selection.SearchOverflow || recentSeedStats.overflow
		selection.Fetched["authored_pull_request_search_queries"] += recentSeedStats.searchQueries
		selection.Fetched["authored_pull_request_discovery_windows"]++
		selection.Fetched["authored_pull_request_recent_seed_windows"]++
		selection.Fetched["authored_pull_request_recent_seed_targets"] = recentSeedAdded
		if recentSeedAdded == 0 {
			selection.Fetched["authored_pull_request_recent_seed_empty"]++
		}
		combinedStats = mergeAuthoredPullRequestDiscoveryStats(combinedStats, recentSeedStats)
	}

	incrementalStart := now.Add(-authoredPRBootstrapLookback).UTC()
	if cursor.LastSyncedAt != nil && !cursor.LastSyncedAt.IsZero() {
		incrementalStart = cursor.LastSyncedAt.UTC().Add(-2 * time.Minute)
	}
	if incrementalStart.After(now) {
		incrementalStart = now.Add(-15 * time.Minute).UTC()
	}
	incrementalWindow := authoredPullRequestWindow{
		Qualifier: "updated",
		Start:     incrementalStart,
		End:       now,
	}
	incrementalStats := authoredPullRequestDiscoveryStats{}
	incrementalTargetLimit = min(incrementalTargetLimit, max(0, maxTargets-len(selection.Targets)))
	if incrementalTargetLimit > 0 {
		incrementalTargets, nextIncrementalStats, err := e.discoverAuthoredPullRequestTargetsInWindow(
			ctx,
			user,
			incrementalWindow,
			perPage,
			0,
			incrementalTargetLimit,
		)
		if err != nil {
			return authoredPullRequestSelection{}, err
		}
		incrementalStats = nextIncrementalStats
		selection.Targets = appendUniqueAuthoredPullRequestTargets(selection.Targets, incrementalTargets, seenTargets, maxTargets)
		selection.SearchIncomplete = selection.SearchIncomplete || incrementalStats.incomplete
		selection.SearchOverflow = selection.SearchOverflow || incrementalStats.overflow
		selection.Fetched["authored_pull_request_search_queries"] += incrementalStats.searchQueries
		selection.Fetched["authored_pull_request_discovery_windows"]++
		selection.Fetched["authored_pull_request_incremental_updated_windows"]++
		combinedStats = mergeAuthoredPullRequestDiscoveryStats(combinedStats, incrementalStats)
	}

	incrementalCreatedLimit := min(maxTargets-len(selection.Targets), max(limit, maxTargets/3))
	if incrementalCreatedLimit > 0 {
		incrementalCreatedWindow := authoredPullRequestWindow{
			Qualifier: "created",
			Start:     incrementalStart,
			End:       now,
		}
		incrementalCreatedTargets, incrementalCreatedStats, createdErr := e.discoverAuthoredPullRequestTargetsInWindow(
			ctx,
			user,
			incrementalCreatedWindow,
			perPage,
			0,
			incrementalCreatedLimit,
		)
		if createdErr != nil {
			return authoredPullRequestSelection{}, createdErr
		}
		selection.Targets = appendUniqueAuthoredPullRequestTargets(selection.Targets, incrementalCreatedTargets, seenTargets, maxTargets)
		selection.SearchIncomplete = selection.SearchIncomplete || incrementalCreatedStats.incomplete
		selection.SearchOverflow = selection.SearchOverflow || incrementalCreatedStats.overflow
		selection.Fetched["authored_pull_request_search_queries"] += incrementalCreatedStats.searchQueries
		selection.Fetched["authored_pull_request_discovery_windows"]++
		selection.Fetched["authored_pull_request_incremental_created_windows"]++
		combinedStats = mergeAuthoredPullRequestDiscoveryStats(combinedStats, incrementalCreatedStats)
		if len(incrementalCreatedTargets) == 0 {
			selection.Fetched["authored_pull_request_incremental_created_empty"]++
		}
	}

	backfillBefore := authoredPRBackfillBoundary(cursor, combinedStats, now)
	bootstrapComplete := cursor.BootstrapComplete
	for windowCount := 0; windowCount < authoredPRBackfillMaxWindows && len(selection.Targets) < maxTargets; windowCount++ {
		if backfillBefore.IsZero() || backfillBefore.Before(gitHubSearchEpoch()) {
			selection.Fetched["authored_pull_request_backfill_exhausted"] = 1
			bootstrapComplete = true
			break
		}

		backfillStart := backfillBefore.Add(-authoredPRBackfillWindow).UTC()
		if backfillStart.Before(gitHubSearchEpoch()) {
			backfillStart = gitHubSearchEpoch()
		}
		if backfillStart.After(backfillBefore) {
			selection.Fetched["authored_pull_request_backfill_exhausted"] = 1
			bootstrapComplete = true
			break
		}

		backfillWindow := authoredPullRequestWindow{
			Qualifier: "created",
			Start:     backfillStart,
			End:       backfillBefore,
		}
		backfillTargets, backfillStats, backfillErr := e.discoverAuthoredPullRequestTargetsInWindow(
			ctx,
			user,
			backfillWindow,
			perPage,
			0,
			maxTargets-len(selection.Targets),
		)
		if backfillErr != nil {
			return authoredPullRequestSelection{}, backfillErr
		}
		selection.Targets = appendUniqueAuthoredPullRequestTargets(selection.Targets, backfillTargets, seenTargets, maxTargets)
		selection.SearchIncomplete = selection.SearchIncomplete || backfillStats.incomplete
		selection.SearchOverflow = selection.SearchOverflow || backfillStats.overflow
		selection.Fetched["authored_pull_request_search_queries"] += backfillStats.searchQueries
		selection.Fetched["authored_pull_request_discovery_windows"]++
		combinedStats = mergeAuthoredPullRequestDiscoveryStats(combinedStats, backfillStats)

		if backfillStats.oldestSeenAt != nil {
			backfillBefore = backfillStats.oldestSeenAt.UTC().Add(-time.Second)
			selection.NextCursor.BackfillBeforeAt = &backfillBefore
			bootstrapComplete = false
			continue
		}

		// No authored PRs were found in this window. Move the cursor backward so
		// sparse history gaps do not stall backfill progress on future runs.
		selection.Fetched["authored_pull_request_backfill_empty_windows"]++
		backfillBefore = backfillStart.Add(-time.Second).UTC()
		selection.NextCursor.BackfillBeforeAt = &backfillBefore
		bootstrapComplete = false
	}

	if len(selection.Targets) == 0 {
		rescanStart := now.Add(-authoredPRRescanLookback).UTC()
		if rescanStart.Before(gitHubSearchEpoch()) {
			rescanStart = gitHubSearchEpoch()
		}
		rescanWindow := authoredPullRequestWindow{
			Qualifier: "created",
			Start:     rescanStart,
			End:       now,
		}
		rescanTargets, rescanStats, rescanErr := e.discoverAuthoredPullRequestTargetsInWindow(
			ctx,
			user,
			rescanWindow,
			perPage,
			0,
			maxTargets-len(selection.Targets),
		)
		if rescanErr != nil {
			return authoredPullRequestSelection{}, rescanErr
		}
		selection.Targets = appendUniqueAuthoredPullRequestTargets(selection.Targets, rescanTargets, seenTargets, maxTargets)
		selection.SearchIncomplete = selection.SearchIncomplete || rescanStats.incomplete
		selection.SearchOverflow = selection.SearchOverflow || rescanStats.overflow
		selection.Fetched["authored_pull_request_search_queries"] += rescanStats.searchQueries
		selection.Fetched["authored_pull_request_discovery_windows"]++
		selection.Fetched["authored_pull_request_rescan_windows"]++
		if len(rescanTargets) == 0 {
			selection.Fetched["authored_pull_request_rescan_empty"]++
		}
		combinedStats = mergeAuthoredPullRequestDiscoveryStats(combinedStats, rescanStats)
	}

	if len(selection.Targets) == 0 {
		broadTargets, broadStats, broadErr := e.discoverAuthoredPullRequestTargetsBroad(
			ctx,
			user,
			perPage,
			maxTargets-len(selection.Targets),
		)
		if broadErr != nil {
			return authoredPullRequestSelection{}, broadErr
		}
		selection.Targets = appendUniqueAuthoredPullRequestTargets(selection.Targets, broadTargets, seenTargets, maxTargets)
		selection.SearchIncomplete = selection.SearchIncomplete || broadStats.incomplete
		selection.SearchOverflow = selection.SearchOverflow || broadStats.overflow
		selection.Fetched["authored_pull_request_search_queries"] += broadStats.searchQueries
		selection.Fetched["authored_pull_request_discovery_windows"]++
		selection.Fetched["authored_pull_request_broad_fallback_windows"]++
		selection.Fetched["authored_pull_request_broad_fallback_targets"] = len(broadTargets)
		if len(broadTargets) == 0 {
			selection.Fetched["authored_pull_request_broad_fallback_empty"]++
		}
		combinedStats = mergeAuthoredPullRequestDiscoveryStats(combinedStats, broadStats)
	}

	selection.Fetched["authored_pull_request_discovery_targets"] = len(selection.Targets)
	if combinedStats.oldestSeenAt != nil {
		selection.NextCursor.OldestSeenAt = minAuthoredTimestamp(cursor.OldestSeenAt, combinedStats.oldestSeenAt)
	}
	if selection.NextCursor.BackfillBeforeAt == nil && selection.NextCursor.OldestSeenAt != nil {
		nextBefore := selection.NextCursor.OldestSeenAt.UTC().Add(-time.Second)
		selection.NextCursor.BackfillBeforeAt = &nextBefore
	}
	if selection.NextCursor.BackfillBeforeAt != nil && !selection.NextCursor.BackfillBeforeAt.IsZero() {
		if selection.NextCursor.BackfillBeforeAt.Before(gitHubSearchEpoch()) {
			bootstrapComplete = true
		}
	}
	lastSyncedAt := now.UTC()
	selection.NextCursor.LastSyncedAt = &lastSyncedAt
	selection.NextCursor.BootstrapComplete = bootstrapComplete
	return selection, nil
}

func (e *Executor) discoverAuthoredPullRequestTargetsInWindow(
	ctx context.Context,
	user string,
	window authoredPullRequestWindow,
	perPage int,
	depth int,
	targetLimit int,
) ([]authoredPullRequestTarget, authoredPullRequestDiscoveryStats, error) {
	stats := authoredPullRequestDiscoveryStats{}
	if targetLimit <= 0 {
		return []authoredPullRequestTarget{}, stats, nil
	}
	if window.End.Before(window.Start) {
		return []authoredPullRequestTarget{}, stats, nil
	}

	searchQuery := authoredPRSearchQuery(user, window.Qualifier, window.Start, window.End)
	result, meta, err := githubapi.SearchIssuesAndPullRequests(ctx, e.client, githubapi.IssueSearchRequest{
		Query:   searchQuery,
		Sort:    window.Qualifier,
		Order:   "desc",
		PerPage: perPage,
		Page:    1,
	})
	stats.searchQueries = 1
	if err != nil {
		return nil, stats, err
	}
	stats.incomplete = result.IncompleteResults

	if shouldSplitAuthoredSearchWindow(result.TotalCount, result.IncompleteResults, window.Start, window.End, depth) {
		midpoint := window.Start.Add(window.End.Sub(window.Start) / 2).UTC()
		if midpoint.After(window.Start) && midpoint.Before(window.End) {
			recentStart := midpoint.Add(time.Second).UTC()
			recentWindow := authoredPullRequestWindow{
				Qualifier: window.Qualifier,
				Start:     recentStart,
				End:       window.End,
			}
			recentTargets, recentStats, recentErr := e.discoverAuthoredPullRequestTargetsInWindow(
				ctx,
				user,
				recentWindow,
				perPage,
				depth+1,
				targetLimit,
			)
			stats = mergeAuthoredPullRequestDiscoveryStats(stats, recentStats)
			if recentErr != nil {
				return nil, stats, recentErr
			}
			if len(recentTargets) >= targetLimit {
				return recentTargets[:targetLimit], stats, nil
			}

			olderWindow := authoredPullRequestWindow{
				Qualifier: window.Qualifier,
				Start:     window.Start,
				End:       midpoint,
			}
			olderTargets, olderStats, olderErr := e.discoverAuthoredPullRequestTargetsInWindow(
				ctx,
				user,
				olderWindow,
				perPage,
				depth+1,
				targetLimit-len(recentTargets),
			)
			stats = mergeAuthoredPullRequestDiscoveryStats(stats, olderStats)
			if olderErr != nil {
				return nil, stats, olderErr
			}
			return append(recentTargets, olderTargets...), stats, nil
		}
		stats.overflow = true
	}

	targets := make([]authoredPullRequestTarget, 0, min(targetLimit, authoredPRSearchMaxPages*perPage))
	seen := make(map[string]struct{}, cap(targets))
	appendItems := func(items []githubapi.IssueSearchResultItem) {
		for _, item := range items {
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
			stats = updateAuthoredPullRequestDiscoveryStats(stats, item)
			if len(targets) >= targetLimit {
				return
			}
		}
	}

	appendItems(result.Items)
	currentResult := result
	currentMeta := meta
	currentPage := 1
	for len(targets) < targetLimit && currentPage < authoredPRSearchMaxPages {
		nextPage, ok := nextSearchPageFromLink(currentMeta.Links["next"])
		if !ok || nextPage <= currentPage {
			break
		}
		currentPage = nextPage
		nextResult, nextMeta, nextErr := githubapi.SearchIssuesAndPullRequests(ctx, e.client, githubapi.IssueSearchRequest{
			Query:   searchQuery,
			Sort:    window.Qualifier,
			Order:   "desc",
			PerPage: perPage,
			Page:    currentPage,
		})
		stats.searchQueries++
		if nextErr != nil {
			return targets, stats, nextErr
		}
		if nextResult.IncompleteResults {
			stats.incomplete = true
		}
		currentResult = nextResult
		currentMeta = nextMeta
		appendItems(currentResult.Items)
		if len(currentResult.Items) == 0 {
			break
		}
	}
	if result.TotalCount >= authoredPRSearchHardLimit {
		stats.overflow = true
	}
	return targets, stats, nil
}

func (e *Executor) discoverAuthoredPullRequestTargetsBroad(
	ctx context.Context,
	user string,
	perPage int,
	targetLimit int,
) ([]authoredPullRequestTarget, authoredPullRequestDiscoveryStats, error) {
	stats := authoredPullRequestDiscoveryStats{}
	if targetLimit <= 0 {
		return []authoredPullRequestTarget{}, stats, nil
	}

	searchQuery := fmt.Sprintf("author:%s is:pull-request archived:false", strings.TrimSpace(user))
	result, meta, err := githubapi.SearchIssuesAndPullRequests(ctx, e.client, githubapi.IssueSearchRequest{
		Query:   searchQuery,
		Sort:    "updated",
		Order:   "desc",
		PerPage: perPage,
		Page:    1,
	})
	stats.searchQueries = 1
	if err != nil {
		return nil, stats, err
	}
	stats.incomplete = result.IncompleteResults

	targets := make([]authoredPullRequestTarget, 0, min(targetLimit, authoredPRSearchMaxPages*perPage))
	seen := make(map[string]struct{}, cap(targets))
	appendItems := func(items []githubapi.IssueSearchResultItem) {
		for _, item := range items {
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
			stats = updateAuthoredPullRequestDiscoveryStats(stats, item)
			if len(targets) >= targetLimit {
				return
			}
		}
	}

	appendItems(result.Items)
	currentResult := result
	currentMeta := meta
	currentPage := 1
	for len(targets) < targetLimit && currentPage < authoredPRSearchMaxPages {
		nextPage, ok := nextSearchPageFromLink(currentMeta.Links["next"])
		if !ok || nextPage <= currentPage {
			break
		}
		currentPage = nextPage
		nextResult, nextMeta, nextErr := githubapi.SearchIssuesAndPullRequests(ctx, e.client, githubapi.IssueSearchRequest{
			Query:   searchQuery,
			Sort:    "updated",
			Order:   "desc",
			PerPage: perPage,
			Page:    currentPage,
		})
		stats.searchQueries++
		if nextErr != nil {
			return targets, stats, nextErr
		}
		if nextResult.IncompleteResults {
			stats.incomplete = true
		}
		currentResult = nextResult
		currentMeta = nextMeta
		appendItems(currentResult.Items)
		if len(currentResult.Items) == 0 {
			break
		}
	}
	if result.TotalCount >= authoredPRSearchHardLimit {
		stats.overflow = true
	}
	return targets, stats, nil
}

func authoredPRSearchQuery(user, qualifier string, start, end time.Time) string {
	return fmt.Sprintf(
		"author:%s is:pull-request archived:false %s:%s..%s",
		strings.TrimSpace(user),
		strings.TrimSpace(qualifier),
		gitHubSearchTimestamp(start),
		gitHubSearchTimestamp(end),
	)
}

func shouldSplitAuthoredSearchWindow(totalCount int, incomplete bool, start, end time.Time, depth int) bool {
	if depth >= authoredPRSearchMaxDepth {
		return false
	}
	if !incomplete && totalCount < authoredPRSearchHardLimit {
		return false
	}
	if !end.After(start) {
		return false
	}
	return end.Sub(start) >= authoredPRMinWindowSpan
}

func nextSearchPageFromLink(link string) (int, bool) {
	parsed, err := url.Parse(strings.TrimSpace(link))
	if err != nil {
		return 0, false
	}
	pageValue := strings.TrimSpace(parsed.Query().Get("page"))
	if pageValue == "" {
		return 0, false
	}
	page, convErr := strconv.Atoi(pageValue)
	if convErr != nil || page <= 0 {
		return 0, false
	}
	return page, true
}

func gitHubSearchTimestamp(value time.Time) string {
	if value.IsZero() {
		return "1970-01-01T00:00:00Z"
	}
	return value.UTC().Format(time.RFC3339)
}

func updateAuthoredPullRequestDiscoveryStats(
	stats authoredPullRequestDiscoveryStats,
	item githubapi.IssueSearchResultItem,
) authoredPullRequestDiscoveryStats {
	createdAt, hasCreatedAt := parseGitHubSearchItemTimestamp(item.CreatedAt)
	updatedAt, hasUpdatedAt := parseGitHubSearchItemTimestamp(item.UpdatedAt)
	if hasCreatedAt {
		stats.oldestSeenAt = minAuthoredTimestamp(stats.oldestSeenAt, &createdAt)
	}
	if hasUpdatedAt {
		if stats.newestSeenAt == nil || updatedAt.After(stats.newestSeenAt.UTC()) {
			updatedAt = updatedAt.UTC()
			stats.newestSeenAt = &updatedAt
		}
	}
	return stats
}

func parseGitHubSearchItemTimestamp(raw string) (time.Time, bool) {
	parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(raw))
	if err != nil {
		return time.Time{}, false
	}
	return parsed.UTC(), true
}

func minAuthoredTimestamp(existing, candidate *time.Time) *time.Time {
	if candidate == nil || candidate.IsZero() {
		return existing
	}
	if existing == nil || existing.IsZero() {
		next := candidate.UTC()
		return &next
	}
	if candidate.UTC().Before(existing.UTC()) {
		next := candidate.UTC()
		return &next
	}
	return existing
}

func mergeAuthoredPullRequestDiscoveryStats(
	base authoredPullRequestDiscoveryStats,
	next authoredPullRequestDiscoveryStats,
) authoredPullRequestDiscoveryStats {
	base.searchQueries += next.searchQueries
	base.incomplete = base.incomplete || next.incomplete
	base.overflow = base.overflow || next.overflow
	base.oldestSeenAt = minAuthoredTimestamp(base.oldestSeenAt, next.oldestSeenAt)
	if next.newestSeenAt != nil && (base.newestSeenAt == nil || next.newestSeenAt.After(base.newestSeenAt.UTC())) {
		timestamp := next.newestSeenAt.UTC()
		base.newestSeenAt = &timestamp
	}
	return base
}

func authoredPRBackfillBoundary(cursor authoredPRHistoryCursor, stats authoredPullRequestDiscoveryStats, now time.Time) time.Time {
	if cursor.BackfillBeforeAt != nil && !cursor.BackfillBeforeAt.IsZero() {
		if cursor.BackfillBeforeAt.UTC().After(gitHubSearchEpoch()) {
			return cursor.BackfillBeforeAt.UTC()
		}
	}
	if cursor.BootstrapComplete {
		return gitHubSearchEpoch().Add(-time.Second)
	}
	if cursor.BackfillBeforeAt != nil && !cursor.BackfillBeforeAt.IsZero() {
		return cursor.BackfillBeforeAt.UTC()
	}
	if stats.oldestSeenAt != nil && !stats.oldestSeenAt.IsZero() {
		return stats.oldestSeenAt.UTC().Add(-time.Second)
	}
	if cursor.OldestSeenAt != nil && !cursor.OldestSeenAt.IsZero() {
		return cursor.OldestSeenAt.UTC().Add(-time.Second)
	}
	return now.Add(-authoredPRBootstrapLookback).UTC()
}

func shouldReserveAuthoredPRBackfill(cursor authoredPRHistoryCursor) bool {
	if cursor.BackfillBeforeAt != nil && !cursor.BackfillBeforeAt.IsZero() {
		return cursor.BackfillBeforeAt.UTC().After(gitHubSearchEpoch())
	}
	if cursor.BootstrapComplete {
		return false
	}
	if cursor.OldestSeenAt != nil && !cursor.OldestSeenAt.IsZero() {
		return cursor.OldestSeenAt.UTC().After(gitHubSearchEpoch())
	}
	return true
}

func appendUniqueAuthoredPullRequestTargets(
	base []authoredPullRequestTarget,
	next []authoredPullRequestTarget,
	seen map[string]struct{},
	limit int,
) []authoredPullRequestTarget {
	for _, target := range next {
		if len(base) >= limit {
			return base
		}
		key := strings.ToLower(fmt.Sprintf("%s#%d", strings.TrimSpace(target.Repository), target.Number))
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		base = append(base, target)
	}
	return base
}

func prioritizeAuthoredPullRequestTargets(
	targets []authoredPullRequestTarget,
	limit int,
	bootstrapComplete bool,
	recentSeedTargets int,
) []authoredPullRequestTarget {
	if limit <= 0 || len(targets) <= limit {
		return targets
	}
	if bootstrapComplete {
		return targets[:limit]
	}
	if recentSeedTargets >= limit {
		return targets[:limit]
	}
	if recentSeedTargets < 0 {
		recentSeedTargets = 0
	}

	recentQuota := limit - max(1, limit/3)
	if recentQuota < 1 {
		recentQuota = 1
	}
	if recentSeedTargets > recentQuota {
		recentQuota = recentSeedTargets
	}
	if recentQuota > limit {
		recentQuota = limit
	}
	historicQuota := max(1, limit-recentQuota)

	out := make([]authoredPullRequestTarget, 0, limit)
	seen := make(map[string]struct{}, limit)
	appendTarget := func(target authoredPullRequestTarget) {
		if len(out) >= limit {
			return
		}
		key := strings.ToLower(fmt.Sprintf("%s#%d", strings.TrimSpace(target.Repository), target.Number))
		if _, exists := seen[key]; exists {
			return
		}
		seen[key] = struct{}{}
		out = append(out, target)
	}

	for index := 0; index < len(targets) && len(out) < recentQuota; index++ {
		appendTarget(targets[index])
	}
	for index := len(targets) - 1; index >= 0 && len(out) < recentQuota+historicQuota; index-- {
		appendTarget(targets[index])
	}
	for index := 0; index < len(targets) && len(out) < limit; index++ {
		appendTarget(targets[index])
	}

	return out
}

func gitHubSearchEpoch() time.Time {
	return time.Date(2008, 1, 1, 0, 0, 0, 0, time.UTC)
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
	return e.fetchPaginatedResourceRows(
		ctx,
		fmt.Sprintf("/repos/%s/%s/pulls/%d/reviews", owner, name, number),
		nil,
		pullRequestReviewsMaxPages,
		100,
	)
}

func (e *Executor) fetchPullRequestReviewComments(ctx context.Context, owner, name string, number int) ([]map[string]any, error) {
	return e.fetchPaginatedResourceRows(
		ctx,
		fmt.Sprintf("/repos/%s/%s/pulls/%d/comments", owner, name, number),
		nil,
		pullRequestReviewCommentsMaxPages,
		100,
	)
}

func (e *Executor) fetchPullRequestFiles(ctx context.Context, owner, name string, number int) ([]map[string]any, error) {
	return e.fetchPullRequestFilesWithPageSize(ctx, owner, name, number, 0)
}

func (e *Executor) fetchPullRequestFilesWithPageSize(
	ctx context.Context,
	owner string,
	name string,
	number int,
	perPageOverride int,
) ([]map[string]any, error) {
	perPage := perPageOverride
	if perPage <= 0 {
		perPage = 100
	}
	return e.fetchPaginatedResourceRows(
		ctx,
		fmt.Sprintf("/repos/%s/%s/pulls/%d/files", owner, name, number),
		nil,
		pullRequestFilesMaxPages,
		perPage,
	)
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

func (e *Executor) fetchPaginatedResourceRows(
	ctx context.Context,
	path string,
	baseQuery url.Values,
	maxPages int,
	perPage int,
) ([]map[string]any, error) {
	if maxPages <= 0 {
		maxPages = 1
	}
	if perPage <= 0 {
		perPage = 100
	}
	if perPage > 100 {
		perPage = 100
	}

	rows := make([]map[string]any, 0, perPage)
	page := 1
	for pageIndex := 0; pageIndex < maxPages; pageIndex++ {
		query := cloneURLValues(baseQuery)
		query.Set("per_page", fmt.Sprintf("%d", perPage))
		query.Set("page", fmt.Sprintf("%d", page))

		var current []map[string]any
		meta, err := e.client.GetJSON(ctx, path, query, githubapi.ConditionalRequest{}, &current)
		if err != nil {
			return nil, err
		}
		rows = append(rows, current...)
		if len(current) == 0 {
			break
		}

		nextPage, ok := nextSearchPageFromLink(meta.Links["next"])
		if !ok || nextPage <= page {
			break
		}
		page = nextPage
	}
	return rows, nil
}

func cloneURLValues(values url.Values) url.Values {
	cloned := make(url.Values)
	for key, items := range values {
		if len(items) == 0 {
			cloned[key] = nil
			continue
		}
		next := make([]string, len(items))
		copy(next, items)
		cloned[key] = next
	}
	return cloned
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

	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, e.cfg.GitHub.RepositorySyncPageSize)
	if useGraphQL {
		perPage = min(perPage, boundedPageSize(e.cfg.GitHub.GraphQLPageSize, e.cfg.GitHub.RepositorySyncPageSize))
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
	reviewPerPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, e.cfg.GitHub.PullRequestReviewPageSize)
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
			reviewsByNumber[number] = nil
			continue
		}
		reviewsByNumber[number] = reviews
	}
	return pullRequests, reviewsByNumber, nil
}

func (e *Executor) fetchIssues(ctx context.Context, owner, name string) ([]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, e.cfg.GitHub.RepositorySyncPageSize)
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

func (e *Executor) tryAcquireUserSync(user string) bool {
	if e == nil {
		return false
	}
	key := strings.ToLower(strings.TrimSpace(user))
	if key == "" {
		return false
	}

	e.userSyncLockMu.Lock()
	defer e.userSyncLockMu.Unlock()
	if e.activeUserSync == nil {
		e.activeUserSync = make(map[string]struct{})
	}
	if _, exists := e.activeUserSync[key]; exists {
		return false
	}
	e.activeUserSync[key] = struct{}{}
	return true
}

func (e *Executor) releaseUserSync(user string) {
	if e == nil {
		return
	}
	key := strings.ToLower(strings.TrimSpace(user))
	if key == "" {
		return
	}

	e.userSyncLockMu.Lock()
	defer e.userSyncLockMu.Unlock()
	delete(e.activeUserSync, key)
}

func (e *Executor) fetchCommits(ctx context.Context, owner, name string) ([]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, e.cfg.GitHub.CommitSyncPageSize)
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
		return defaultFallbackPageSize
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

func shouldAdvanceAuthoredPRLastSynced(fetched map[string]int, searchIncomplete, searchOverflow bool) bool {
	if searchIncomplete || searchOverflow {
		return false
	}
	if fetched == nil {
		return true
	}
	if fetched["authored_pull_request_search_failed"] > 0 {
		return false
	}
	selected := fetched["authored_pull_requests_selected"]
	if selected <= 0 {
		return false
	}
	if fetched["authored_pull_requests_auth_errors"] > 0 || fetched["authored_pull_requests_not_found"] > 0 {
		// Authorization/scope gaps should keep overlap in place so repaired auth can
		// recover rows without waiting for deep history backfill.
		return false
	}
	if fetched["authored_pull_requests_retryable"] <= 0 {
		return true
	}

	// Do not pin the authored PR cursor forever when a run is only partially
	// retryable. If at least one selected PR was hydrated successfully, advance
	// with overlap and allow failed PRs to be retried on future incremental runs.
	skipped := fetched["authored_pull_requests_skipped"]
	if skipped < 0 {
		skipped = 0
	}
	// If every selected authored PR hydration was skipped, hold cursor progression
	// regardless of retryability classification to avoid silently skipping gaps.
	if skipped >= selected {
		return false
	}
	return true
}

func userSyncExecutionStatus(fetched map[string]int) string {
	if shouldMarkUserSyncRunPartial(fetched) {
		return "partial"
	}
	return "completed"
}

func shouldMarkUserSyncRunPartial(fetched map[string]int) bool {
	if fetched == nil {
		return false
	}
	if fetched["authored_pull_request_search_incomplete"] > 0 ||
		fetched["authored_pull_request_search_overflow"] > 0 ||
		fetched["authored_pull_request_backfill_incomplete"] > 0 ||
		fetched["authored_pull_request_discovery_empty"] > 0 ||
		fetched["authored_pull_request_zero_discovery_with_history"] > 0 ||
		(fetched["authored_pull_request_discovery_empty"] > 0 && fetched["authored_pull_request_persisted_existing"] > 0) ||
		fetched["authored_pull_requests_retryable"] > 0 ||
		fetched["authored_pull_requests_skipped"] > 0 ||
		fetched["authored_pull_requests_failed"] > 0 ||
		fetched["authored_pull_requests_timeouts"] > 0 ||
		fetched["authored_pull_requests_selected_unmerged_only"] > 0 ||
		fetched["authored_pull_request_scope_limited"] > 0 {
		return true
	}
	return false
}

func annotateAuthoredPullRequestSelectionMetrics(fetched map[string]int) {
	if fetched == nil {
		return
	}
	selectedTargets := fetched["authored_pull_requests_selected"]
	if selectedTargets > 0 {
		selectedMergedTargets := fetched["authored_pull_requests_selected_merged"]
		selectedUnmergedTargets := fetched["authored_pull_requests_selected_unmerged"]
		if selectedMergedTargets <= 0 && selectedUnmergedTargets >= selectedTargets {
			fetched["authored_pull_requests_selected_unmerged_only"] = 1
		}
		return
	}
	fetched["authored_pull_request_discovery_empty"] = 1
	if fetched["authored_pull_request_persisted_existing"] > 0 {
		fetched["authored_pull_request_zero_discovery_with_history"] = 1
	}
}

func shouldForceAuthoredPRBootstrap(cursor authoredPRHistoryCursor, selectedTargets int, persistedCount int) bool {
	if selectedTargets > 0 || persistedCount > 0 {
		return false
	}
	return hasAuthoredPRCursorState(cursor)
}

func hasAuthoredPRCursorState(cursor authoredPRHistoryCursor) bool {
	if cursor.BootstrapComplete {
		return true
	}
	if cursor.LastSyncedAt != nil && !cursor.LastSyncedAt.IsZero() {
		return true
	}
	if cursor.OldestSeenAt != nil && !cursor.OldestSeenAt.IsZero() {
		return true
	}
	if cursor.BackfillBeforeAt != nil && !cursor.BackfillBeforeAt.IsZero() {
		return true
	}
	return false
}

func syncFailureFetchedMetrics(err error) map[string]int {
	metrics := map[string]int{
		"failed": 1,
	}
	if err == nil {
		return metrics
	}
	if errors.Is(err, ErrUserSyncInProgress) {
		metrics["user_sync_in_progress"] = 1
		metrics["lease_conflicts"] = 1
		return metrics
	}
	if errors.Is(err, ErrUserSyncOAuthTokenRequired) {
		metrics["auth_errors"] = 1
		metrics["oauth_token_required"] = 1
		return metrics
	}
	if errors.Is(err, ErrUserSyncOAuthTokenMalformed) {
		metrics["auth_errors"] = 1
		metrics["oauth_token_malformed"] = 1
		return metrics
	}
	if errors.Is(err, ErrUserSyncGitHubAppInstallationRequired) {
		metrics["auth_errors"] = 1
		metrics["app_installation_required"] = 1
		return metrics
	}
	if errors.Is(err, ErrUserSyncGitHubAppUnavailable) {
		metrics["request_errors"] = 1
		metrics["app_installation_unavailable"] = 1
		return metrics
	}
	if isSkippableGitHubTimeoutError(err) {
		metrics["timeout_errors"] = 1
		return metrics
	}
	statusCode, ok := gitHubStatusCodeFromError(err)
	if !ok {
		metrics["request_errors"] = 1
		return metrics
	}
	switch {
	case statusCode == http.StatusTooManyRequests:
		metrics["rate_limited"] = 1
	case statusCode == http.StatusBadRequest && isUnsupportedGitHubAPIVersionError(err):
		metrics["unsupported_api_version"] = 1
	case statusCode == http.StatusForbidden || statusCode == http.StatusUnauthorized:
		metrics["auth_errors"] = 1
	case statusCode >= http.StatusInternalServerError:
		metrics["upstream_errors"] = 1
	default:
		metrics["request_errors"] = 1
	}
	return metrics
}

func classifyAuthoredPullRequestHydrationError(fetched map[string]int, err error) {
	if fetched == nil {
		return
	}
	fetched["authored_pull_requests_skipped"]++
	if err == nil {
		return
	}
	if isSkippableGitHubTimeoutError(err) {
		fetched["authored_pull_requests_timeouts"]++
		fetched["authored_pull_requests_retryable"]++
		return
	}

	statusCode, ok := gitHubStatusCodeFromError(err)
	if !ok {
		fetched["authored_pull_requests_failed"]++
		fetched["authored_pull_requests_retryable"]++
		return
	}

	switch {
	case statusCode == http.StatusTooManyRequests:
		fetched["authored_pull_requests_rate_limited"]++
		fetched["authored_pull_requests_retryable"]++
	case statusCode == http.StatusBadRequest && isUnsupportedGitHubAPIVersionError(err):
		fetched["authored_pull_requests_unsupported_api_version"]++
	case statusCode == http.StatusForbidden || statusCode == http.StatusUnauthorized:
		fetched["authored_pull_requests_auth_errors"]++
	case statusCode == http.StatusNotFound:
		// GitHub often masks private/unauthorized resource access as 404.
		fetched["authored_pull_requests_not_found"]++
	case statusCode == http.StatusConflict:
		fetched["authored_pull_requests_conflicts"]++
	case statusCode >= http.StatusInternalServerError:
		fetched["authored_pull_requests_upstream_errors"]++
		fetched["authored_pull_requests_retryable"]++
	default:
		fetched["authored_pull_requests_failed"]++
		fetched["authored_pull_requests_retryable"]++
	}
}

func isUnsupportedGitHubAPIVersionError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(strings.TrimSpace(err.Error()))
	if message == "" {
		return false
	}
	if !strings.Contains(message, "version") {
		return false
	}
	return strings.Contains(message, "not a supported version") ||
		strings.Contains(message, "version is not supported")
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
	timeout := cfg.GitHub.UserPRSyncTimeoutDefault
	minTimeout := cfg.GitHub.UserPRSyncTimeoutMin
	maxTimeout := cfg.GitHub.UserPRSyncTimeoutMax
	if minTimeout <= 0 {
		minTimeout = 10 * time.Second
	}
	if maxTimeout <= 0 {
		maxTimeout = 2 * time.Minute
	}
	if maxTimeout < minTimeout {
		maxTimeout = minTimeout
	}
	if timeout <= 0 {
		timeout = minTimeout
	}
	if timeout < minTimeout {
		return minTimeout
	}
	if timeout > maxTimeout {
		return maxTimeout
	}
	return timeout
}

func boundedAuthoredPRSyncLimit(cfg config.GitHub, limit int) int {
	if limit <= 0 {
		limit = cfg.AuthoredPRSyncLimit
	}
	if limit <= 0 {
		limit = 1
	}
	if limit > authoredPRSearchHardLimit {
		limit = authoredPRSearchHardLimit
	}
	maxLimit := cfg.AuthoredPRSearchLimit
	if maxLimit <= 0 {
		return limit
	}
	if maxLimit > authoredPRSearchHardLimit {
		maxLimit = authoredPRSearchHardLimit
	}
	return min(limit, maxLimit)
}

func boundedAuthoredPRSearchLimit(cfg config.GitHub) int {
	limit := cfg.AuthoredPRSearchLimit
	if limit <= 0 {
		return authoredPRSearchHardLimit
	}
	if limit > authoredPRSearchHardLimit {
		return authoredPRSearchHardLimit
	}
	return limit
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

func pullRequestLifecycleFetchedCounts(pullRequest map[string]any) map[string]int {
	counts := map[string]int{}
	if pullRequest == nil {
		counts["pull_requests_state_unknown"] = 1
		counts["pull_requests_unmerged"] = 1
		return counts
	}

	state := strings.ToLower(stringValue(pullRequest["state"]))
	switch state {
	case "open":
		counts["pull_requests_state_open"] = 1
	case "closed":
		counts["pull_requests_state_closed"] = 1
	default:
		counts["pull_requests_state_unknown"] = 1
	}

	merged := boolValue(pullRequest["merged"])
	if !merged {
		merged = stringValue(pullRequest["merged_at"]) != ""
	}
	if merged {
		counts["pull_requests_merged"] = 1
	} else {
		counts["pull_requests_unmerged"] = 1
	}
	return counts
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
