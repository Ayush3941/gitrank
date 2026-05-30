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

type githubRESTClientFactory func(githubapi.TokenSource) (*githubapi.RESTClient, error)

type githubInstallationClientResolver func(int64) (*githubapi.RESTClient, bool, error)
type githubActorInstallationMatcher func(*githubapi.RESTClient) (bool, error)

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

	return selectActorInstallationClient(
		installationIDs,
		probeAllInstallations,
		func(installationID int64) (*githubapi.RESTClient, bool, error) {
			return e.installationClient(ctx, installationID)
		},
		func(client *githubapi.RESTClient) (bool, error) {
			return e.installationClientSupportsAuthoredPullRequests(ctx, client, githubLogin)
		},
	)
}

func selectActorInstallationClient(
	installationIDs []int64,
	probeAllInstallations bool,
	resolveClient githubInstallationClientResolver,
	matchesAuthoredPR githubActorInstallationMatcher,
) (*githubapi.RESTClient, bool, error) {
	var lastError error
	for _, installationID := range installationIDs {
		client, enabled, resolveErr := resolveClient(installationID)
		if resolveErr != nil {
			lastError = resolveErr
			continue
		}
		if !enabled || client == nil {
			continue
		}
		if !probeAllInstallations {
			return client, true, nil
		}
		matches, matchErr := matchesAuthoredPR(client)
		if matchErr != nil {
			lastError = matchErr
			continue
		}
		if matches {
			return client, true, nil
		}
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

	return e.cloneWithStrictAppClient(installationClient), "installation", nil
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
	return runtime, nil
}

func (e *Executor) executorForStrictAppSyncRequest(
	ctx context.Context,
	actor SyncRequestActor,
	installationID int64,
	now time.Time,
) (*Executor, error) {
	if installationID > 0 {
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
		return e.cloneWithStrictAppClient(installationClient), nil
	}

	return e.executorForStrictAppSyncActor(ctx, actor, now)
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

func (e *Executor) cloneWithStrictAppClient(installationClient *githubapi.RESTClient) *Executor {
	if e == nil {
		return nil
	}
	clone := *e
	clone.client = installationClient
	clone.actorInstallation = func(context.Context, SyncRequestActor) (*githubapi.RESTClient, bool, error) {
		return installationClient, true, nil
	}
	return &clone
}
