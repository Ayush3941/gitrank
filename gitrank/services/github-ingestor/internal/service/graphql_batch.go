package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/githubapi"
)

const pullRequestBatchGraphQLQuery = `
query GitRankRepositoryPullRequestBatch($owner: String!, $name: String!, $first: Int!, $reviewsFirst: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: $first, orderBy: {field: UPDATED_AT, direction: DESC}, states: [OPEN, CLOSED, MERGED]) {
      nodes {
        databaseId
        number
        title
        state
        isDraft
        merged
        mergedAt
        createdAt
        updatedAt
        closedAt
        changedFiles
        additions
        deletions
        commits {
          totalCount
        }
        author {
          login
        }
        baseRefName
        headRefName
        labels(first: 20) {
          nodes {
            name
            color
            description
            isDefault
          }
        }
        reviews(first: $reviewsFirst) {
          nodes {
            databaseId
            state
            submittedAt
            body
            author {
              login
            }
            authorAssociation
          }
        }
      }
    }
  }
}
`

type githubGraphQLClientFactory func(githubapi.TokenSource) (*githubapi.GraphQLClient, error)

type githubRESTClientFactory func(githubapi.TokenSource) (*githubapi.RESTClient, error)

type githubGraphQLTokenSource func(context.Context, SyncRequestActor, time.Time) (githubapi.TokenSource, bool, error)

type githubGraphQLPullRequestBatchData struct {
	Repository *githubGraphQLRepository `json:"repository"`
}

type githubGraphQLRepository struct {
	PullRequests githubGraphQLPullRequestConnection `json:"pullRequests"`
}

type githubGraphQLPullRequestConnection struct {
	Nodes []githubGraphQLPullRequest `json:"nodes"`
}

type githubGraphQLPullRequest struct {
	DatabaseID   int64                   `json:"databaseId"`
	Number       int                     `json:"number"`
	Title        string                  `json:"title"`
	State        string                  `json:"state"`
	IsDraft      bool                    `json:"isDraft"`
	Merged       bool                    `json:"merged"`
	MergedAt     *string                 `json:"mergedAt"`
	CreatedAt    string                  `json:"createdAt"`
	UpdatedAt    string                  `json:"updatedAt"`
	ClosedAt     *string                 `json:"closedAt"`
	ChangedFiles *int                    `json:"changedFiles"`
	Additions    int                     `json:"additions"`
	Deletions    int                     `json:"deletions"`
	Commits      githubGraphQLCount      `json:"commits"`
	Author       *githubGraphQLActor     `json:"author"`
	BaseRefName  string                  `json:"baseRefName"`
	HeadRefName  string                  `json:"headRefName"`
	Labels       githubGraphQLLabelList  `json:"labels"`
	Reviews      githubGraphQLReviewList `json:"reviews"`
}

type githubGraphQLCount struct {
	TotalCount int `json:"totalCount"`
}

type githubGraphQLActor struct {
	Login string `json:"login"`
}

type githubGraphQLLabelList struct {
	Nodes []githubGraphQLLabel `json:"nodes"`
}

type githubGraphQLLabel struct {
	Name        string  `json:"name"`
	Color       string  `json:"color"`
	Description *string `json:"description"`
	IsDefault   bool    `json:"isDefault"`
}

type githubGraphQLReviewList struct {
	Nodes []githubGraphQLReview `json:"nodes"`
}

type githubGraphQLReview struct {
	DatabaseID        int64               `json:"databaseId"`
	State             string              `json:"state"`
	SubmittedAt       *string             `json:"submittedAt"`
	Body              string              `json:"body"`
	Author            *githubGraphQLActor `json:"author"`
	AuthorAssociation string              `json:"authorAssociation"`
}

func newGitHubGraphQLClientFactory(cfg config.App) githubGraphQLClientFactory {
	return func(tokenSource githubapi.TokenSource) (*githubapi.GraphQLClient, error) {
		timeout := boundedGitHubHTTPTimeout(cfg.GitHub.RequestTimeout)
		return githubapi.NewGraphQLClient(githubapi.ClientConfig{
			BaseURL:                        cfg.GitHub.GraphQLURL,
			APIVersion:                     cfg.GitHub.APIVersion,
			UserAgent:                      cfg.GitHub.UserAgent,
			TokenSource:                    tokenSource,
			HTTPClient:                     &http.Client{Timeout: timeout},
			SecondaryBackoff:               cfg.GitHub.SecondaryBackoff,
			MaxConcurrency:                 cfg.GitHub.MaxConcurrency,
			CircuitBreakerFailureThreshold: cfg.GitHub.CircuitBreakerFailureThreshold,
			CircuitBreakerOpenInterval:     cfg.GitHub.CircuitBreakerOpenInterval,
			CircuitBreakerHalfOpenMax:      cfg.GitHub.CircuitBreakerHalfOpenMax,
		})
	}
}

func newGitHubRESTClientFactory(cfg config.App) githubRESTClientFactory {
	return func(tokenSource githubapi.TokenSource) (*githubapi.RESTClient, error) {
		timeout := boundedGitHubHTTPTimeout(cfg.GitHub.RequestTimeout)
		return githubapi.NewRESTClient(githubapi.ClientConfig{
			BaseURL:                        cfg.GitHub.APIBaseURL,
			APIVersion:                     cfg.GitHub.APIVersion,
			UserAgent:                      cfg.GitHub.UserAgent,
			TokenSource:                    tokenSource,
			HTTPClient:                     &http.Client{Timeout: timeout},
			SecondaryBackoff:               cfg.GitHub.SecondaryBackoff,
			MaxConcurrency:                 cfg.GitHub.MaxConcurrency,
			CircuitBreakerFailureThreshold: cfg.GitHub.CircuitBreakerFailureThreshold,
			CircuitBreakerOpenInterval:     cfg.GitHub.CircuitBreakerOpenInterval,
			CircuitBreakerHalfOpenMax:      cfg.GitHub.CircuitBreakerHalfOpenMax,
		})
	}
}

func boundedGitHubHTTPTimeout(timeout time.Duration) time.Duration {
	const minimum = 45 * time.Second
	if timeout <= 0 || timeout < minimum {
		return minimum
	}
	return timeout
}

func (e *Executor) graphQLClientForActor(ctx context.Context, actor SyncRequestActor, now time.Time) (*githubapi.GraphQLClient, bool, error) {
	if e == nil || e.graphqlTokenSource == nil || e.graphqlClientFactory == nil {
		return nil, false, nil
	}
	tokenSource, ok, err := e.graphqlTokenSource(ctx, actor, now)
	if err != nil || !ok {
		return nil, false, err
	}
	client, err := e.graphqlClientFactory(tokenSource)
	if err != nil {
		return nil, false, err
	}
	return client, true, nil
}

func (e *Executor) installationClientForActor(ctx context.Context, actor SyncRequestActor) (*githubapi.RESTClient, bool, error) {
	if e == nil || e.installationClient == nil || e.store == nil || e.store.pool == nil {
		return nil, false, nil
	}
	githubLogin := strings.TrimSpace(actor.GitHubLogin)
	if githubLogin == "" {
		return nil, false, nil
	}

	installationIDs, err := e.store.ActiveInstallationIDsByAccountLogin(ctx, githubLogin)
	if err != nil {
		return nil, false, err
	}
	probeAllInstallations := false
	if len(installationIDs) == 0 {
		installationIDs, err = e.store.ActiveInstallationIDs(ctx)
		if err != nil {
			return nil, false, err
		}
		if len(installationIDs) == 0 {
			return nil, false, nil
		}
		probeAllInstallations = true
	}

	var lastError error
	var fallbackClient *githubapi.RESTClient
	for _, installationID := range installationIDs {
		client, enabled, clientErr := e.installationClient(ctx, installationID)
		if clientErr != nil {
			lastError = clientErr
			continue
		}
		if enabled && client != nil {
			if !probeAllInstallations {
				return client, true, nil
			}
			matches, probeErr := e.installationClientSupportsAuthoredPullRequests(ctx, client, githubLogin)
			if probeErr != nil {
				lastError = probeErr
				if fallbackClient == nil {
					fallbackClient = client
				}
				continue
			}
			if matches {
				return client, true, nil
			}
			if fallbackClient == nil {
				fallbackClient = client
			}
			continue
		}
	}
	if probeAllInstallations && fallbackClient != nil {
		return fallbackClient, true, nil
	}
	if lastError != nil {
		return nil, false, lastError
	}
	return nil, false, nil
}

func (e *Executor) installationClientSupportsAuthoredPullRequests(
	ctx context.Context,
	client *githubapi.RESTClient,
	githubLogin string,
) (bool, error) {
	if client == nil {
		return false, nil
	}
	query := fmt.Sprintf("author:%s is:pull-request archived:false", strings.TrimSpace(githubLogin))
	result, _, err := githubapi.SearchIssuesAndPullRequests(ctx, client, githubapi.IssueSearchRequest{
		Query:   query,
		Sort:    "updated",
		Order:   "desc",
		PerPage: 1,
		Page:    1,
	})
	if err != nil {
		return false, err
	}
	if len(result.Items) > 0 {
		return true, nil
	}
	if result.TotalCount > 0 {
		return true, nil
	}
	return false, nil
}

func (e *Executor) executorForUserSyncActor(ctx context.Context, actor SyncRequestActor, now time.Time) (*Executor, string, error) {
	if e == nil {
		return nil, "", nil
	}
	if strings.TrimSpace(actor.GitHubLogin) == "" {
		return nil, "", ErrUserSyncGitHubAppInstallationRequired
	}
	if e.actorInstallation == nil {
		return nil, "", ErrUserSyncGitHubAppUnavailable
	}

	installationClient, installationEnabled, installationErr := e.actorInstallation(ctx, actor)
	if installationErr != nil {
		return nil, "", fmt.Errorf("%w: %v", ErrUserSyncGitHubAppUnavailable, installationErr)
	}
	if !installationEnabled || installationClient == nil {
		return nil, "", ErrUserSyncGitHubAppInstallationRequired
	}

	clone := *e
	clone.client = installationClient
	return &clone, "installation", nil
}

func (e *Executor) executorForStrictAppSyncActor(ctx context.Context, actor SyncRequestActor, now time.Time) (*Executor, error) {
	if e == nil {
		return nil, nil
	}

	runtime, source, err := e.executorForUserSyncActor(ctx, actor, now)
	if err == nil {
		if source != "installation" {
			return nil, fmt.Errorf("%w: unexpected credential source %q", ErrUserSyncGitHubAppUnavailable, source)
		}
		// Strict app-sync routes must not route PR extraction through OAuth GraphQL tokens.
		runtime.graphqlTokenSource = nil
		return runtime, nil
	}
	if !errors.Is(err, ErrUserSyncGitHubAppInstallationRequired) {
		return nil, err
	}

	if _, bootstrapErr := e.bootstrapActorInstallations(ctx, actor, now); bootstrapErr != nil {
		return nil, bootstrapErr
	}

	runtime, source, err = e.executorForUserSyncActor(ctx, actor, now)
	if err != nil {
		return nil, err
	}
	if source != "installation" {
		return nil, fmt.Errorf("%w: unexpected credential source %q", ErrUserSyncGitHubAppUnavailable, source)
	}
	// Strict app-sync routes must not route PR extraction through OAuth GraphQL tokens.
	runtime.graphqlTokenSource = nil
	return runtime, nil
}

func (e *Executor) executorForStrictAppSyncRequest(
	ctx context.Context,
	actor SyncRequestActor,
	installationID int64,
	now time.Time,
) (*Executor, error) {
	if strings.TrimSpace(actor.GitHubLogin) != "" {
		return e.executorForStrictAppSyncActor(ctx, actor, now)
	}
	if installationID <= 0 {
		return nil, ErrUserSyncGitHubAppInstallationRequired
	}
	if e == nil || e.installationClient == nil {
		return nil, ErrUserSyncGitHubAppUnavailable
	}

	installationClient, enabled, installationErr := e.installationClient(ctx, installationID)
	if installationErr != nil {
		return nil, fmt.Errorf("%w: %v", ErrUserSyncGitHubAppUnavailable, installationErr)
	}
	if !enabled || installationClient == nil {
		return nil, ErrUserSyncGitHubAppInstallationRequired
	}

	clone := *e
	clone.client = installationClient
	clone.graphqlTokenSource = nil
	clone.actorInstallation = func(context.Context, SyncRequestActor) (*githubapi.RESTClient, bool, error) {
		return installationClient, true, nil
	}
	return &clone, nil
}

func (e *Executor) bootstrapActorInstallations(ctx context.Context, actor SyncRequestActor, now time.Time) (int, error) {
	if e == nil || e.store == nil || e.store.pool == nil {
		return 0, nil
	}
	githubLogin := strings.TrimSpace(actor.GitHubLogin)
	if githubLogin == "" {
		return 0, nil
	}
	if e.appInstallationList == nil {
		return 0, nil
	}

	installations, listErr := e.appInstallationList(ctx)
	if listErr != nil {
		return 0, fmt.Errorf("%w: %v", ErrUserSyncGitHubAppUnavailable, listErr)
	}
	if len(installations) == 0 {
		return 0, nil
	}
	return e.store.UpsertUserInstallations(ctx, installations, now)
}

func (e *Executor) fetchPullRequestsGraphQL(
	ctx context.Context,
	client *githubapi.GraphQLClient,
	owner string,
	name string,
	summaries []map[string]any,
	reviewsFirst int,
) ([]map[string]any, map[int][]map[string]any, error) {
	if client == nil {
		return nil, nil, errors.New("GitHub GraphQL client is required")
	}
	first := len(summaries)
	if first <= 0 {
		return []map[string]any{}, map[int][]map[string]any{}, nil
	}

	var response githubapi.GraphQLResponse[githubGraphQLPullRequestBatchData]
	_, err := client.QueryJSON(ctx, pullRequestBatchGraphQLQuery, map[string]any{
		"owner":        owner,
		"name":         name,
		"first":        first,
		"reviewsFirst": reviewsFirst,
	}, &response)
	if err != nil {
		return nil, nil, err
	}
	if len(response.Errors) > 0 {
		return nil, nil, fmt.Errorf("GitHub GraphQL pull request batch failed: %s", response.Errors[0].Message)
	}
	if response.Data.Repository == nil {
		return nil, nil, fmt.Errorf("GitHub repository %s/%s was not returned by GraphQL", owner, name)
	}

	summaryByNumber := make(map[int]map[string]any, len(summaries))
	for _, summary := range summaries {
		number := intValue(summary["number"])
		if number > 0 {
			summaryByNumber[number] = summary
		}
	}

	pullRequests := make([]map[string]any, 0, len(response.Data.Repository.PullRequests.Nodes))
	reviewsByNumber := make(map[int][]map[string]any, len(response.Data.Repository.PullRequests.Nodes))
	for _, node := range response.Data.Repository.PullRequests.Nodes {
		if node.DatabaseID == 0 || node.Number <= 0 {
			continue
		}
		pullRequest := graphQLPullRequestToRESTMap(node)
		if summary := summaryByNumber[node.Number]; summary != nil {
			pullRequest = mergePullRequestSummary(pullRequest, summary)
		}
		pullRequests = append(pullRequests, normalizePullRequest(pullRequest))
		reviewsByNumber[node.Number] = graphQLReviewsToRESTMaps(node.Reviews.Nodes)
	}
	return pullRequests, reviewsByNumber, nil
}

func graphQLPullRequestToRESTMap(node githubGraphQLPullRequest) map[string]any {
	state := strings.ToLower(strings.TrimSpace(node.State))
	if state == "merged" {
		state = "closed"
	}

	changedFiles := 0
	if node.ChangedFiles != nil {
		changedFiles = *node.ChangedFiles
	}

	return map[string]any{
		"id":            node.DatabaseID,
		"number":        node.Number,
		"title":         node.Title,
		"state":         state,
		"draft":         node.IsDraft,
		"merged":        node.Merged,
		"merged_at":     optionalGraphQLString(node.MergedAt),
		"created_at":    node.CreatedAt,
		"updated_at":    node.UpdatedAt,
		"closed_at":     optionalGraphQLString(node.ClosedAt),
		"changed_files": changedFiles,
		"additions":     node.Additions,
		"deletions":     node.Deletions,
		"commits":       node.Commits.TotalCount,
		"user":          graphQLActorToRESTUser(node.Author),
		"base":          map[string]any{"ref": node.BaseRefName},
		"head":          map[string]any{"ref": node.HeadRefName},
		"labels":        graphQLLabelsToRESTMaps(node.Labels.Nodes),
	}
}

func mergePullRequestSummary(pullRequest map[string]any, summary map[string]any) map[string]any {
	if pullRequest == nil {
		pullRequest = map[string]any{}
	}
	for _, key := range []string{"html_url", "diff_url", "patch_url", "url"} {
		if pullRequest[key] == nil && summary[key] != nil {
			pullRequest[key] = summary[key]
		}
	}
	if summaryUser := object(summary["user"]); summaryUser != nil {
		currentUser := object(pullRequest["user"])
		if currentUser == nil || int64Value(currentUser["id"]) == 0 {
			pullRequest["user"] = summaryUser
		}
	}
	if labels := objectArray(summary["labels"]); len(labels) > 0 {
		pullRequest["labels"] = labels
	}
	return pullRequest
}

func graphQLReviewsToRESTMaps(nodes []githubGraphQLReview) []map[string]any {
	reviews := make([]map[string]any, 0, len(nodes))
	for _, node := range nodes {
		if node.DatabaseID == 0 {
			continue
		}
		reviews = append(reviews, map[string]any{
			"id":                 node.DatabaseID,
			"state":              strings.ToUpper(strings.TrimSpace(node.State)),
			"submitted_at":       optionalGraphQLString(node.SubmittedAt),
			"body":               node.Body,
			"user":               graphQLActorToRESTUser(node.Author),
			"author_association": node.AuthorAssociation,
		})
	}
	return reviews
}

func graphQLLabelsToRESTMaps(nodes []githubGraphQLLabel) []map[string]any {
	labels := make([]map[string]any, 0, len(nodes))
	for _, node := range nodes {
		labels = append(labels, map[string]any{
			"name":        node.Name,
			"color":       node.Color,
			"description": optionalGraphQLString(node.Description),
			"default":     node.IsDefault,
		})
	}
	return labels
}

func graphQLActorToRESTUser(actor *githubGraphQLActor) map[string]any {
	if actor == nil {
		return nil
	}
	return map[string]any{
		"login": strings.TrimSpace(actor.Login),
	}
}

func optionalGraphQLString(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}
