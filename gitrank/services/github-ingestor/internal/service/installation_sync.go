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
type githubAppInstallationLister func(context.Context) ([]githubapi.UserInstallationSummaryItem, error)

func newGitHubInstallationClientFactory(cfg config.App) githubInstallationClientFactory {
	appJWTIssuer := cfg.GitHubAppJWTIssuer()
	privateKeyPath := strings.TrimSpace(cfg.GitHub.AppPrivateKeyPEM)
	if appJWTIssuer == "" || privateKeyPath == "" {
		return nil
	}
	timeout := boundedGitHubHTTPTimeout(cfg.GitHub.RequestTimeout)

	appTokenSource, err := githubapi.NewAppAuthenticator(appJWTIssuer, privateKeyPath, 9*time.Minute)
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
		HTTPClient:                     &http.Client{Timeout: timeout},
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
			HTTPClient:                     &http.Client{Timeout: timeout},
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

func newGitHubAppInstallationLister(cfg config.App) githubAppInstallationLister {
	appJWTIssuer := cfg.GitHubAppJWTIssuer()
	privateKeyPath := strings.TrimSpace(cfg.GitHub.AppPrivateKeyPEM)
	if appJWTIssuer == "" || privateKeyPath == "" {
		return nil
	}
	timeout := boundedGitHubHTTPTimeout(cfg.GitHub.RequestTimeout)

	appTokenSource, err := githubapi.NewAppAuthenticator(appJWTIssuer, privateKeyPath, 9*time.Minute)
	if err != nil {
		return func(context.Context) ([]githubapi.UserInstallationSummaryItem, error) {
			return nil, err
		}
	}
	appClient, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:                        cfg.GitHub.APIBaseURL,
		APIVersion:                     cfg.GitHub.APIVersion,
		UserAgent:                      cfg.GitHub.UserAgent,
		TokenSource:                    appTokenSource,
		HTTPClient:                     &http.Client{Timeout: timeout},
		SecondaryBackoff:               cfg.GitHub.SecondaryBackoff,
		MaxConcurrency:                 cfg.GitHub.MaxConcurrency,
		CircuitBreakerFailureThreshold: cfg.GitHub.CircuitBreakerFailureThreshold,
		CircuitBreakerOpenInterval:     cfg.GitHub.CircuitBreakerOpenInterval,
		CircuitBreakerHalfOpenMax:      cfg.GitHub.CircuitBreakerHalfOpenMax,
	})
	if err != nil {
		return func(context.Context) ([]githubapi.UserInstallationSummaryItem, error) {
			return nil, err
		}
	}

	return func(ctx context.Context) ([]githubapi.UserInstallationSummaryItem, error) {
		perPage := boundedPageSize(cfg.GitHub.MaxPageSize, cfg.GitHub.InstallationRepositoryPageSize)
		maxPages := cfg.GitHub.InstallationRepositoryMaxPages
		if maxPages <= 0 {
			maxPages = 1
		}

		installations := make([]githubapi.UserInstallationSummaryItem, 0, perPage)
		page := 1
		for pageIndex := 0; pageIndex < maxPages; pageIndex++ {
			current, meta, err := githubapi.ListAppInstallations(ctx, appClient, githubapi.AppInstallationsRequest{
				PerPage: perPage,
				Page:    page,
			})
			if err != nil {
				return nil, err
			}
			installations = append(installations, current...)
			nextPage, ok := nextSearchPageFromLink(meta.Links["next"])
			if !ok || nextPage <= page {
				break
			}
			page = nextPage
		}
		return installations, nil
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
