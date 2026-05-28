package githubapi

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
)

type IssueSearchRequest struct {
	Query   string
	Sort    string
	Order   string
	PerPage int
	Page    int
}

type IssueSearchResult struct {
	TotalCount        int                     `json:"total_count"`
	IncompleteResults bool                    `json:"incomplete_results"`
	Items             []IssueSearchResultItem `json:"items"`
}

type IssueSearchResultItem struct {
	Number        int                `json:"number"`
	URL           string             `json:"url"`
	HTMLURL       string             `json:"html_url"`
	RepositoryURL string             `json:"repository_url"`
	CreatedAt     string             `json:"created_at"`
	UpdatedAt     string             `json:"updated_at"`
	PullRequest   *PullRequestLinks  `json:"pull_request,omitempty"`
	Repository    *RepositorySummary `json:"repository,omitempty"`
}

type PullRequestLinks struct {
	URL      string `json:"url"`
	HTMLURL  string `json:"html_url"`
	DiffURL  string `json:"diff_url"`
	PatchURL string `json:"patch_url"`
}

type RepositorySummary struct {
	ID       int64            `json:"id"`
	Name     string           `json:"name"`
	FullName string           `json:"full_name"`
	Private  bool             `json:"private"`
	Archived bool             `json:"archived"`
	Disabled bool             `json:"disabled"`
	Owner    *RepositoryOwner `json:"owner,omitempty"`
}

type RepositoryOwner struct {
	Login string `json:"login"`
	ID    int64  `json:"id"`
	Type  string `json:"type"`
}

func SearchIssuesAndPullRequests(
	ctx context.Context,
	client *RESTClient,
	req IssueSearchRequest,
) (IssueSearchResult, ResponseMetadata, error) {
	if client == nil {
		return IssueSearchResult{}, ResponseMetadata{}, errRequiredClient()
	}
	query := strings.TrimSpace(req.Query)
	if query == "" {
		return IssueSearchResult{}, ResponseMetadata{}, errors.New("search query is required")
	}

	params := url.Values{"q": []string{query}}
	if sort := strings.TrimSpace(req.Sort); sort != "" {
		params.Set("sort", sort)
	}
	if order := strings.TrimSpace(req.Order); order != "" {
		params.Set("order", order)
	}
	if req.PerPage > 0 {
		params.Set("per_page", fmt.Sprintf("%d", req.PerPage))
	}
	if req.Page > 0 {
		params.Set("page", fmt.Sprintf("%d", req.Page))
	}

	var result IssueSearchResult
	meta, err := client.GetJSON(ctx, "/search/issues", params, ConditionalRequest{}, &result)
	return result, meta, err
}
