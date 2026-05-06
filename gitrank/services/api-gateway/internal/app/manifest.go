package app

import (
	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
)

func Manifest(cfg config.App, version string) contracts.ServiceManifest {
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
			{Method: "POST", Path: "/v1/sync", Summary: "Request a contribution sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/repository/execute", Summary: "Execute a bounded live repository sync through the GitHub ingestor", Status: "implemented"},
			{Method: "POST", Path: "/v1/me/account/unlink", Summary: "Disconnect the authenticated GitHub account", Status: "implemented"},
			{Method: "POST", Path: "/v1/me/account/delete", Summary: "Delete the authenticated account", Status: "implemented"},
			{Method: "GET", Path: "/v1/me/profile", Summary: "Get the authenticated user's profile summary", Status: "implemented"},
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
			{Name: "GitHub REST API", Kind: "external_http", BaseURL: cfg.GitHub.APIBaseURL, Purpose: "Pull request, review, repo, and identity data", Auth: "OAuth or App token", Critical: true, Status: "configured"},
			{Name: "GitHub GraphQL API", Kind: "external_http", BaseURL: cfg.GitHub.GraphQLURL, Purpose: "Efficient PR and repository queries", Auth: "OAuth or App token", Critical: true, Status: "configured"},
			{Name: "OpenAI Responses API", Kind: "external_http", BaseURL: cfg.AI.BaseURL, Purpose: "AI enrichment for contribution analysis", Auth: "API key", Critical: false, Status: "configured"},
		},
	}
}
