package githubapi

import (
	"context"
	"errors"
	"fmt"
	"net/url"
)

type InstallationRepositoriesRequest struct {
	PerPage int
	Page    int
}

type InstallationRepositoriesResponse struct {
	TotalCount   int                 `json:"total_count"`
	Repositories []RepositorySummary `json:"repositories"`
}

func ListInstallationRepositories(
	ctx context.Context,
	client *RESTClient,
	req InstallationRepositoriesRequest,
) (InstallationRepositoriesResponse, ResponseMetadata, error) {
	if client == nil {
		return InstallationRepositoriesResponse{}, ResponseMetadata{}, errRequiredClient()
	}
	if req.PerPage < 0 || req.PerPage > 100 {
		return InstallationRepositoriesResponse{}, ResponseMetadata{}, errors.New("per_page must be between 0 and 100")
	}
	if req.Page < 0 {
		return InstallationRepositoriesResponse{}, ResponseMetadata{}, errors.New("page must be greater than or equal to 1")
	}

	query := url.Values{}
	if req.PerPage > 0 {
		query.Set("per_page", fmt.Sprintf("%d", req.PerPage))
	}
	if req.Page > 0 {
		query.Set("page", fmt.Sprintf("%d", req.Page))
	}

	var response InstallationRepositoriesResponse
	meta, err := client.GetJSON(ctx, "/installation/repositories", query, ConditionalRequest{}, &response)
	return response, meta, err
}
