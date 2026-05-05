package app

import (
	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
)

func Manifest(cfg config.App, version string) contracts.ServiceManifest {
	return contracts.ServiceManifest{
		Service:     cfg.ServiceName,
		Description: "GitHub webhook intake and sync orchestration service.",
		Version:     version,
		Routes: []contracts.RouteSpec{
			{Method: "GET", Path: "/healthz", Summary: "Liveness probe", Status: "implemented"},
			{Method: "GET", Path: "/readyz", Summary: "Readiness probe", Status: "implemented"},
			{Method: "GET", Path: "/v1/meta/manifest", Summary: "Service route manifest", Status: "implemented"},
			{Method: "POST", Path: "/webhooks/github", Summary: "Validate, deduplicate, and queue GitHub webhook deliveries", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/preview", Summary: "Build a sync event preview without queueing it", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/installation", Summary: "Queue an installation sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/user", Summary: "Queue a user history sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/repository", Summary: "Queue a repository sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/pull-request", Summary: "Queue a pull request sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/review", Summary: "Queue a review sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/issue", Summary: "Queue an issue sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/commit", Summary: "Queue a commit sync", Status: "implemented"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "GitHub REST API", Kind: "external_http", BaseURL: cfg.GitHub.APIBaseURL, Purpose: "Repository and PR synchronization", Auth: "GitHub App or OAuth token", Critical: true, Status: "configured"},
			{Name: "GitHub GraphQL API", Kind: "external_http", BaseURL: cfg.GitHub.GraphQLURL, Purpose: "Efficient repository and PR graph access", Auth: "GitHub App or OAuth token", Critical: true, Status: "configured"},
			{Name: "In-memory queue preview", Kind: "queue", Purpose: "Pending jobs and delivery deduplication during local development", Critical: true, Status: "implemented"},
			{Name: "Redis", Kind: "queue", Purpose: "Pending jobs and delivery deduplication", Critical: true, Status: "planned"},
			{Name: "PostgreSQL", Kind: "database", Purpose: "Normalized GitHub data persistence", Critical: true, Status: "implemented"},
		},
	}
}
