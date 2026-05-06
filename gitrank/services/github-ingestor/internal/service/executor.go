package service

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/githubapi"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultRepositorySyncPageSize = 20
	defaultCommitSyncPageSize     = 50
	defaultUserRepositoryLimit    = 10
)

type Executor struct {
	cfg    config.App
	store  *Store
	client *githubapi.RESTClient
}

func NewExecutor(cfg config.App, pool *pgxpool.Pool, client *githubapi.RESTClient) *Executor {
	return &Executor{
		cfg:    cfg,
		store:  NewStore(pool),
		client: client,
	}
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

	repository, err := e.fetchRepository(ctx, owner, name)
	if err != nil {
		_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
		return response, err
	}

	pullRequests, reviewsByNumber, err := e.fetchPullRequests(ctx, owner, name)
	if err != nil {
		_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
		return response, err
	}

	issues, err := e.fetchIssues(ctx, owner, name)
	if err != nil {
		_ = e.recordFailedSyncRun(ctx, req.Repository, req, actor, correlationID, startedAt, err)
		return response, err
	}

	commits, err := e.fetchCommits(ctx, owner, name)
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

	repositories, err := e.fetchUserRepositories(ctx, user)
	if err != nil {
		_ = e.recordFailedUserSyncRun(ctx, user, req, actor, correlationID, startedAt, err, PersistResult{})
		return response, err
	}

	aggregatePersisted := PersistResult{}
	response.Fetched["repositories_selected"] = len(repositories)
	baseCorrelationID := strings.TrimSpace(correlationID)
	if baseCorrelationID == "" {
		baseCorrelationID = "sync-user:" + user
	}

	for index, repository := range repositories {
		fullName := strings.TrimSpace(stringValue(repository["full_name"]))
		if fullName == "" {
			continue
		}
		child, err := e.SyncRepository(ctx, contracts.SyncRequest{
			Mode:       "repository",
			Repository: fullName,
		}, actor, fmt.Sprintf("%s:repo:%d", baseCorrelationID, index+1), time.Now().UTC())
		if err != nil {
			response.FinishedAt = time.Now().UTC()
			_ = e.recordFailedUserSyncRun(ctx, user, req, actor, correlationID, startedAt, err, aggregatePersisted)
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

func (e *Executor) SyncPullRequest(
	ctx context.Context,
	req contracts.SyncRequest,
	actor SyncRequestActor,
	correlationID string,
	now time.Time,
) (contracts.GitHubSyncExecutionResponse, error) {
	startedAt := now.UTC()
	response := contracts.GitHubSyncExecutionResponse{
		Status:        "failed",
		Mode:          "pull_request",
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
		_ = e.recordFailedPullRequestSyncRun(ctx, req, actor, correlationID, startedAt, err)
		return response, err
	}

	pullRequest, err := e.fetchPullRequest(ctx, owner, name, req.Number)
	if err != nil {
		_ = e.recordFailedPullRequestSyncRun(ctx, req, actor, correlationID, startedAt, err)
		return response, err
	}
	reviews, err := e.fetchPullRequestReviews(ctx, owner, name, req.Number)
	if err != nil {
		_ = e.recordFailedPullRequestSyncRun(ctx, req, actor, correlationID, startedAt, err)
		return response, err
	}
	reviewComments, err := e.fetchPullRequestReviewComments(ctx, owner, name, req.Number)
	if err != nil {
		_ = e.recordFailedPullRequestSyncRun(ctx, req, actor, correlationID, startedAt, err)
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
			EventType:                   "pull_request",
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
		_ = e.recordFailedPullRequestSyncRun(ctx, req, actor, correlationID, startedAt, err)
		return response, err
	}

	response.Status = "completed"
	response.FinishedAt = finishedAt
	response.Persisted = persisted.EntityCounts()
	response.Fetched = map[string]int{
		"repositories":    1,
		"pull_requests":   1,
		"reviews":         len(reviews),
		"review_comments": len(reviewComments),
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

func (e *Executor) recordFailedPullRequestSyncRun(
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
			EventType:                   "pull_request",
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

func (e *Executor) fetchUserRepositories(ctx context.Context, user string) ([]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultUserRepositoryLimit)
	var repositories []map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/users/%s/repos", user), url.Values{
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

func (e *Executor) fetchPullRequest(ctx context.Context, owner, name string, number int) (map[string]any, error) {
	var pullRequest map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/pulls/%d", owner, name, number), nil, githubapi.ConditionalRequest{}, &pullRequest)
	if err != nil {
		return nil, err
	}
	return normalizePullRequest(pullRequest), nil
}

func (e *Executor) fetchPullRequestReviews(ctx context.Context, owner, name string, number int) ([]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultRepositorySyncPageSize)
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

func (e *Executor) fetchRepository(ctx context.Context, owner, name string) (map[string]any, error) {
	var repository map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s", owner, name), nil, githubapi.ConditionalRequest{}, &repository)
	return repository, err
}

func (e *Executor) fetchPullRequests(ctx context.Context, owner, name string) ([]map[string]any, map[int][]map[string]any, error) {
	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, defaultRepositorySyncPageSize)
	var summaries []map[string]any
	_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/pulls", owner, name), url.Values{
		"state":     []string{"all"},
		"sort":      []string{"updated"},
		"direction": []string{"desc"},
		"per_page":  []string{fmt.Sprintf("%d", perPage)},
	}, githubapi.ConditionalRequest{}, &summaries)
	if err != nil {
		return nil, nil, err
	}

	pullRequests := make([]map[string]any, 0, len(summaries))
	reviewsByNumber := make(map[int][]map[string]any, len(summaries))
	for _, summary := range summaries {
		number := intValue(summary["number"])
		if number <= 0 {
			continue
		}

		var pullRequest map[string]any
		_, err := e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/pulls/%d", owner, name, number), nil, githubapi.ConditionalRequest{}, &pullRequest)
		if err != nil {
			return nil, nil, err
		}
		pullRequests = append(pullRequests, normalizePullRequest(pullRequest))

		var reviews []map[string]any
		_, err = e.client.GetJSON(ctx, fmt.Sprintf("/repos/%s/%s/pulls/%d/reviews", owner, name, number), url.Values{
			"per_page": []string{fmt.Sprintf("%d", perPage)},
		}, githubapi.ConditionalRequest{}, &reviews)
		if err != nil {
			return nil, nil, err
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

func boundedPageSize(configured, fallback int) int {
	if configured > 0 && configured < fallback {
		return configured
	}
	if fallback <= 0 {
		return 20
	}
	return fallback
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
		RepositoryCount:    counts["repositories"],
		InstallationCount:  counts["installations"],
		PullRequestCount:   counts["pull_requests"],
		ReviewCount:        counts["reviews"],
		ReviewCommentCount: counts["review_comments"],
		IssueCount:         counts["issues"],
		LabelCount:         counts["labels"],
		CommitCount:        counts["commits"],
	}
}

func addPersistResult(dst, src PersistResult) PersistResult {
	dst.RepositoryCount += src.RepositoryCount
	dst.InstallationCount += src.InstallationCount
	dst.PullRequestCount += src.PullRequestCount
	dst.ReviewCount += src.ReviewCount
	dst.ReviewCommentCount += src.ReviewCommentCount
	dst.IssueCount += src.IssueCount
	dst.LabelCount += src.LabelCount
	dst.CommitCount += src.CommitCount
	return dst
}
