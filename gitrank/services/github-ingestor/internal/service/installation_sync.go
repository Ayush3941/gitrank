package service

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/githubapi"
)

type githubInstallationClientFactory func(context.Context, int64) (*githubapi.RESTClient, bool, error)

func newGitHubInstallationClientFactory(cfg config.App) githubInstallationClientFactory {
	appID := strings.TrimSpace(cfg.GitHub.AppID)
	privateKeyPath := strings.TrimSpace(cfg.GitHub.AppPrivateKeyPEM)
	if appID == "" || appID == "0" || privateKeyPath == "" {
		return nil
	}

	appTokenSource, err := githubapi.NewAppAuthenticator(appID, privateKeyPath, 9*time.Minute)
	if err != nil {
		return func(context.Context, int64) (*githubapi.RESTClient, bool, error) {
			return nil, true, err
		}
	}
	appClient, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:                        cfg.GitHub.APIBaseURL,
		APIVersion:                     cfg.GitHub.APIVersion,
		UserAgent:                      cfg.GitHub.UserAgent,
		TokenSource:                    appTokenSource,
		HTTPClient:                     &http.Client{Timeout: cfg.GitHub.RequestTimeout},
		SecondaryBackoff:               cfg.GitHub.SecondaryBackoff,
		MaxConcurrency:                 cfg.GitHub.MaxConcurrency,
		CircuitBreakerFailureThreshold: cfg.GitHub.CircuitBreakerFailureThreshold,
		CircuitBreakerOpenInterval:     cfg.GitHub.CircuitBreakerOpenInterval,
		CircuitBreakerHalfOpenMax:      cfg.GitHub.CircuitBreakerHalfOpenMax,
	})
	if err != nil {
		return func(context.Context, int64) (*githubapi.RESTClient, bool, error) {
			return nil, true, err
		}
	}
	broker, err := githubapi.NewInstallationTokenBroker(appClient, cfg.GitHub.RefreshSkew)
	if err != nil {
		return func(context.Context, int64) (*githubapi.RESTClient, bool, error) {
			return nil, true, err
		}
	}

	return func(_ context.Context, installationID int64) (*githubapi.RESTClient, bool, error) {
		if installationID <= 0 {
			return nil, false, fmt.Errorf("installation ID is required")
		}
		installationTokenSource := githubapi.InstallationTokenSource{
			Broker:         broker,
			InstallationID: installationID,
		}
		client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
			BaseURL:                        cfg.GitHub.APIBaseURL,
			APIVersion:                     cfg.GitHub.APIVersion,
			UserAgent:                      cfg.GitHub.UserAgent,
			TokenSource:                    installationTokenSource,
			HTTPClient:                     &http.Client{Timeout: cfg.GitHub.RequestTimeout},
			SecondaryBackoff:               cfg.GitHub.SecondaryBackoff,
			MaxConcurrency:                 cfg.GitHub.MaxConcurrency,
			CircuitBreakerFailureThreshold: cfg.GitHub.CircuitBreakerFailureThreshold,
			CircuitBreakerOpenInterval:     cfg.GitHub.CircuitBreakerOpenInterval,
			CircuitBreakerHalfOpenMax:      cfg.GitHub.CircuitBreakerHalfOpenMax,
		})
		if err != nil {
			return nil, false, err
		}
		return client, true, nil
	}
}

func (e *Executor) fetchLiveInstallationRepositoryTargets(
	ctx context.Context,
	client *githubapi.RESTClient,
) ([]string, bool, error) {
	if client == nil {
		return nil, false, fmt.Errorf("installation REST client is required")
	}

	perPage := boundedPageSize(e.cfg.GitHub.MaxPageSize, e.cfg.GitHub.InstallationRepositoryPageSize)
	repositories := make([]string, 0, perPage)
	seen := make(map[string]struct{}, perPage)

	for page := 1; page <= e.cfg.GitHub.InstallationRepositoryMaxPages; page++ {
		result, meta, err := githubapi.ListInstallationRepositories(ctx, client, githubapi.InstallationRepositoriesRequest{
			PerPage: perPage,
			Page:    page,
		})
		if err != nil {
			return nil, false, err
		}

		for _, repository := range result.Repositories {
			if repository.Private || repository.Archived || repository.Disabled {
				continue
			}
			fullName := strings.TrimSpace(repository.FullName)
			if fullName == "" {
				continue
			}
			if _, _, err := splitRepositoryFullName(fullName); err != nil {
				continue
			}
			key := strings.ToLower(fullName)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			repositories = append(repositories, fullName)
		}

		if meta.Links["next"] == "" {
			return repositories, false, nil
		}
	}

	return repositories, true, nil
}

func normalizeRepositoryTargets(targets []string) []string {
	normalized := make([]string, 0, len(targets))
	seen := make(map[string]struct{}, len(targets))
	for _, target := range targets {
		fullName := strings.TrimSpace(target)
		if fullName == "" {
			continue
		}
		if _, _, err := splitRepositoryFullName(fullName); err != nil {
			continue
		}
		key := strings.ToLower(fullName)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		normalized = append(normalized, fullName)
	}
	return normalized
}
