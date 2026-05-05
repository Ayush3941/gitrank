package githubapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type InstallationAccessToken struct {
	Token               string            `json:"token"`
	ExpiresAt           time.Time         `json:"expires_at"`
	Permissions         map[string]string `json:"permissions,omitempty"`
	RepositorySelection string            `json:"repository_selection,omitempty"`
	SingleFileName      string            `json:"single_file,omitempty"`
	InstallationID      int64             `json:"installation_id,omitempty"`
}

type InstallationTokenRequest struct {
	InstallationID int64
	RepositoryIDs  []int64
	Permissions    map[string]string
}

type InstallationTokenBroker struct {
	client      *RESTClient
	refreshSkew time.Duration
	mu          sync.Mutex
	cache       map[string]InstallationAccessToken
}

func NewInstallationTokenBroker(client *RESTClient, refreshSkew time.Duration) (*InstallationTokenBroker, error) {
	if client == nil {
		return nil, errors.New("REST client is required")
	}
	if refreshSkew <= 0 {
		refreshSkew = 5 * time.Minute
	}
	return &InstallationTokenBroker{
		client:      client,
		refreshSkew: refreshSkew,
		cache:       make(map[string]InstallationAccessToken),
	}, nil
}

func (b *InstallationTokenBroker) Token(
	ctx context.Context,
	req InstallationTokenRequest,
) (InstallationAccessToken, error) {
	if req.InstallationID <= 0 {
		return InstallationAccessToken{}, errors.New("installation ID is required")
	}

	key := installationTokenCacheKey(req)
	b.mu.Lock()
	cached, ok := b.cache[key]
	b.mu.Unlock()
	if ok && time.Until(cached.ExpiresAt) > b.refreshSkew {
		return cached, nil
	}

	requestBody := map[string]any{}
	if len(req.RepositoryIDs) > 0 {
		requestBody["repository_ids"] = req.RepositoryIDs
	}
	if len(req.Permissions) > 0 {
		requestBody["permissions"] = req.Permissions
	}

	path := fmt.Sprintf("/app/installations/%d/access_tokens", req.InstallationID)
	var token InstallationAccessToken
	_, err := b.client.DoJSON(ctx, http.MethodPost, path, url.Values(nil), ConditionalRequest{}, requestBody, &token)
	if err != nil {
		return InstallationAccessToken{}, err
	}
	token.InstallationID = req.InstallationID

	b.mu.Lock()
	b.cache[key] = token
	b.mu.Unlock()
	return token, nil
}

type InstallationTokenSource struct {
	Broker         *InstallationTokenBroker
	InstallationID int64
	RepositoryIDs  []int64
	Permissions    map[string]string
}

func (s InstallationTokenSource) Token(ctx context.Context) (string, error) {
	if s.Broker == nil {
		return "", errors.New("installation token broker is required")
	}
	token, err := s.Broker.Token(ctx, InstallationTokenRequest{
		InstallationID: s.InstallationID,
		RepositoryIDs:  s.RepositoryIDs,
		Permissions:    s.Permissions,
	})
	if err != nil {
		return "", err
	}
	return token.Token, nil
}

func installationTokenCacheKey(req InstallationTokenRequest) string {
	parts := []string{strconv.FormatInt(req.InstallationID, 10)}

	if len(req.RepositoryIDs) > 0 {
		repoIDs := append([]int64(nil), req.RepositoryIDs...)
		sort.Slice(repoIDs, func(i, j int) bool { return repoIDs[i] < repoIDs[j] })
		for _, id := range repoIDs {
			parts = append(parts, strconv.FormatInt(id, 10))
		}
	}
	if len(req.Permissions) > 0 {
		keys := make([]string, 0, len(req.Permissions))
		for key := range req.Permissions {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			parts = append(parts, key+"="+req.Permissions[key])
		}
	}
	return strings.Join(parts, "|")
}
