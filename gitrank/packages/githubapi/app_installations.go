package githubapi

import (
	"context"
	"errors"
	"fmt"
	"net/url"
)

type AppInstallationsRequest struct {
	PerPage int
	Page    int
}

func ListAppInstallations(
	ctx context.Context,
	client *RESTClient,
	req AppInstallationsRequest,
) ([]UserInstallationSummaryItem, ResponseMetadata, error) {
	if client == nil {
		return nil, ResponseMetadata{}, errRequiredClient()
	}
	if req.PerPage < 0 || req.PerPage > 100 {
		return nil, ResponseMetadata{}, errors.New("per_page must be between 0 and 100")
	}
	if req.Page < 0 {
		return nil, ResponseMetadata{}, errors.New("page must be greater than or equal to 0")
	}

	query := url.Values{}
	if req.PerPage > 0 {
		query.Set("per_page", fmt.Sprintf("%d", req.PerPage))
	}
	if req.Page > 0 {
		query.Set("page", fmt.Sprintf("%d", req.Page))
	}

	var response []UserInstallationSummaryItem
	meta, err := client.GetJSON(ctx, "/app/installations", query, ConditionalRequest{}, &response)
	return response, meta, err
}
