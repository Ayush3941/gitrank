package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/authkit"
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

func decodeOptionalOAuthTokenKeys(cfg config.App) [][]byte {
	keys, err := cfg.TokenEncryptionKeyRing()
	if err != nil {
		return nil
	}
	return keys
}

func newGitHubGraphQLClientFactory(cfg config.App) githubGraphQLClientFactory {
	return func(tokenSource githubapi.TokenSource) (*githubapi.GraphQLClient, error) {
		return githubapi.NewGraphQLClient(githubapi.ClientConfig{
			BaseURL:                        cfg.GitHub.GraphQLURL,
			APIVersion:                     cfg.GitHub.APIVersion,
			UserAgent:                      cfg.GitHub.UserAgent,
			TokenSource:                    tokenSource,
			HTTPClient:                     &http.Client{Timeout: cfg.GitHub.RequestTimeout},
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
		return githubapi.NewRESTClient(githubapi.ClientConfig{
			BaseURL:                        cfg.GitHub.APIBaseURL,
			APIVersion:                     cfg.GitHub.APIVersion,
			UserAgent:                      cfg.GitHub.UserAgent,
			TokenSource:                    tokenSource,
			HTTPClient:                     &http.Client{Timeout: cfg.GitHub.RequestTimeout},
			SecondaryBackoff:               cfg.GitHub.SecondaryBackoff,
			MaxConcurrency:                 cfg.GitHub.MaxConcurrency,
			CircuitBreakerFailureThreshold: cfg.GitHub.CircuitBreakerFailureThreshold,
			CircuitBreakerOpenInterval:     cfg.GitHub.CircuitBreakerOpenInterval,
			CircuitBreakerHalfOpenMax:      cfg.GitHub.CircuitBreakerHalfOpenMax,
		})
	}
}

func (e *Executor) graphQLTokenSourceForActor(ctx context.Context, actor SyncRequestActor, now time.Time) (githubapi.TokenSource, bool, error) {
	if e == nil || e.store == nil || e.store.pool == nil || len(e.oauthTokenKeys) == 0 {
		return nil, false, nil
	}
	githubLogin := strings.TrimSpace(actor.GitHubLogin)
	if githubLogin == "" {
		return nil, false, nil
	}

	encryptedToken, ok, err := e.store.ActiveGitHubAccessTokenByLogin(ctx, githubLogin, now.UTC().Add(e.cfg.GitHub.RefreshSkew))
	if err != nil || !ok {
		return nil, false, err
	}
	accessToken, _, err := authkit.DecryptSecretAny(e.oauthTokenKeys, encryptedToken)
	if err != nil {
		return nil, false, err
	}
	accessToken = strings.TrimSpace(accessToken)
	if accessToken == "" {
		return nil, false, nil
	}
	return githubapi.StaticTokenSource(accessToken), true, nil
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

func (e *Executor) restClientForActor(ctx context.Context, actor SyncRequestActor, now time.Time) (*githubapi.RESTClient, bool, error) {
	if e == nil || e.graphqlTokenSource == nil || e.restClientFactory == nil {
		return nil, false, nil
	}
	tokenSource, ok, err := e.graphqlTokenSource(ctx, actor, now)
	if err != nil || !ok {
		return nil, false, err
	}
	client, err := e.restClientFactory(tokenSource)
	if err != nil {
		return nil, false, err
	}
	return client, true, nil
}

func (e *Executor) executorForActor(ctx context.Context, actor SyncRequestActor, now time.Time) (*Executor, error) {
	if e == nil {
		return nil, nil
	}
	client, ok, err := e.restClientForActor(ctx, actor, now)
	if err != nil {
		// Token-source failures (for example stale/decrypt-mismatched local OAuth keys)
		// should not hard-fail sync execution; fallback to the baseline shared client.
		return e, nil
	}
	if !ok || client == nil {
		return e, nil
	}
	clone := *e
	clone.client = client
	return &clone, nil
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
