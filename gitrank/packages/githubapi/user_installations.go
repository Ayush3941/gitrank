package githubapi

import (
	"context"
	"errors"
	"fmt"
	"net/url"
)

type UserInstallationsRequest struct {
	PerPage int
	Page    int
}

type UserInstallationsResponse struct {
	TotalCount    int                           `json:"total_count"`
	Installations []UserInstallationSummaryItem `json:"installations"`
}

type UserInstallationSummaryItem struct {
	ID                  int64               `json:"id"`
	AppID               int64               `json:"app_id"`
	AppSlug             string              `json:"app_slug"`
	TargetType          string              `json:"target_type"`
	RepositorySelection string              `json:"repository_selection"`
	Permissions         map[string]any      `json:"permissions"`
	Events              []string            `json:"events"`
	CreatedAt           string              `json:"created_at"`
	SuspendedAt         *string             `json:"suspended_at"`
	Account             *RepositoryOwner    `json:"account,omitempty"`
	Repositories        []RepositorySummary `json:"repositories,omitempty"`
	SingleFilePaths     []string            `json:"single_file_paths,omitempty"`
}

func ListUserInstallations(
	ctx context.Context,
	client *RESTClient,
	req UserInstallationsRequest,
) (UserInstallationsResponse, ResponseMetadata, error) {
	if client == nil {
		return UserInstallationsResponse{}, ResponseMetadata{}, errRequiredClient()
	}
	if req.PerPage < 0 || req.PerPage > 100 {
		return UserInstallationsResponse{}, ResponseMetadata{}, errors.New("per_page must be between 0 and 100")
	}
	if req.Page < 0 {
		return UserInstallationsResponse{}, ResponseMetadata{}, errors.New("page must be greater than or equal to 0")
	}

	query := url.Values{}
	if req.PerPage > 0 {
		query.Set("per_page", fmt.Sprintf("%d", req.PerPage))
	}
	if req.Page > 0 {
		query.Set("page", fmt.Sprintf("%d", req.Page))
	}

	var response UserInstallationsResponse
	meta, err := client.GetJSON(ctx, "/user/installations", query, ConditionalRequest{}, &response)
	return response, meta, err
}
