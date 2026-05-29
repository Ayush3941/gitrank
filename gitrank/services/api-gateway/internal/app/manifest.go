package app

import (
	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
)

func Manifest(cfg config.App, version string) contracts.ServiceManifest {
	githubSyncStatus := dependencyStatusFromError(cfg.ValidateGitHubApp())
	return contracts.ServiceManifest{
		Service:     cfg.ServiceName,
		Description: "Edge API for GitRank clients and public consumers.",
		Version:     version,
		Routes: []contracts.RouteSpec{
			{Method: "GET", Path: "/healthz", Summary: "Liveness probe", Status: "implemented"},
			{Method: "GET", Path: "/readyz", Summary: "Readiness probe", Status: "implemented"},
			{Method: "GET", Path: "/metrics", Summary: "Prometheus-style service metrics", Status: "implemented"},
			{Method: "GET", Path: "/v1/meta/manifest", Summary: "Service route and dependency manifest", Status: "implemented"},
			{Method: "GET", Path: "/v1/meta/dependencies", Summary: "Internal and external API dependency map", Status: "implemented"},
			{Method: "GET", Path: "/v1/profile/schema", Summary: "Get public profile schema sections", Status: "implemented"},
			{Method: "GET", Path: "/v1/leaderboard", Summary: "Get the public GitRank leaderboard", Status: "implemented"},
			{Method: "GET", Path: "/v1/pr/{owner}/{repo}/{number}/report", Summary: "Get a public PR battle report from persisted evidence", Status: "implemented"},
			{Method: "POST", Path: "/v1/analytics/events", Summary: "Accept bounded product analytics events without code, token, or secret payloads", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync", Summary: "Request a contribution sync", Status: "implemented"},
			{Method: "GET", Path: "/v1/sync/runs", Summary: "List authenticated sync activity and execution outcomes", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/user/execute", Summary: "Execute a bounded live user sync through the GitHub ingestor", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/installation/execute", Summary: "Execute a bounded installation sync through repositories already associated with a persisted installation record", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/repository/execute", Summary: "Execute a bounded live repository sync through the GitHub ingestor", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/pull-request/execute", Summary: "Execute a bounded live pull-request sync through the GitHub ingestor", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/review/execute", Summary: "Execute a bounded live review sync through the GitHub ingestor", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/issue/execute", Summary: "Execute a bounded live issue sync through the GitHub ingestor", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/commit/execute", Summary: "Execute a bounded live commit sync through the GitHub ingestor", Status: "implemented"},
			{Method: "POST", Path: "/v1/me/account/unlink", Summary: "Disconnect the authenticated GitHub account", Status: "implemented"},
			{Method: "POST", Path: "/v1/me/account/delete", Summary: "Delete the authenticated account", Status: "implemented"},
			{Method: "GET", Path: "/v1/me/profile", Summary: "Get the authenticated user's profile summary", Status: "implemented"},
			{Method: "GET", Path: "/v1/me/quests", Summary: "Get authenticated live quest recommendations from profile evidence", Status: "implemented"},
			{Method: "GET", Path: "/v1/me/account/export", Summary: "Export authenticated account data without token secrets", Status: "implemented"},
			{Method: "PATCH", Path: "/v1/me/profile", Summary: "Update authenticated profile privacy settings", Status: "implemented"},
			{Method: "PATCH", Path: "/v1/me/profile/repositories/{owner}/{repo}", Summary: "Update per-repository public visibility", Status: "implemented"},
			{Method: "GET", Path: "/v1/users/{handle}", Summary: "Get a public GitRank profile", Status: "implemented"},
			{Method: "GET", Path: "/v1/users/{handle}/card", Summary: "Get shareable public GitRank card data", Status: "implemented"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "auth-service", Kind: "internal_http", BaseURL: cfg.Services.AuthBaseURL, Purpose: "OAuth and session lifecycle", Auth: "service_to_service", Critical: true, Status: "configured"},
			{Name: "github-ingestor", Kind: "internal_http", BaseURL: cfg.Services.GitHubIngestorBaseURL, Purpose: "GitHub webhooks and sync orchestration", Auth: "service_to_service", Critical: true, Status: "configured"},
			{Name: "pr-analyzer", Kind: "internal_http", BaseURL: cfg.Services.PRAnalyzerBaseURL, Purpose: "PR classification and technical signal extraction", Auth: "service_to_service", Critical: true, Status: "configured"},
			{Name: "profile-service", Kind: "internal_http", BaseURL: cfg.Services.ProfileBaseURL, Purpose: "Profile read models", Auth: "service_to_service", Critical: true, Status: "configured"},
			{Name: "scoring-engine", Kind: "internal_http", BaseURL: cfg.Services.ScoringBaseURL, Purpose: "Contribution scoring and explainability", Auth: "service_to_service", Critical: true, Status: "configured"},
			{Name: "GitHub REST API", Kind: "external_http", BaseURL: cfg.GitHub.APIBaseURL, Purpose: "Pull request, review, repo, and identity data", Auth: "GitHub App installation token for sync, OAuth user token only for identity/login", Critical: true, Status: githubSyncStatus},
			{Name: "AI chat completions API", Kind: "external_http", BaseURL: cfg.AI.BaseURL, Purpose: "AI enrichment for contribution analysis", Auth: "API key", Critical: false, Status: "configured"},
		},
	}
}

func dependencyStatusFromError(err error) string {
	if err != nil {
		return "misconfigured"
	}
	return "configured"
}
