package app

import (
	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
)

func Manifest(cfg config.App, version string) contracts.ServiceManifest {
	return contracts.ServiceManifest{
		Service:     cfg.ServiceName,
		Description: "GitHub webhook intake and sync orchestration service.",
		Version:     version,
		Routes: []contracts.RouteSpec{
			{Method: "GET", Path: "/healthz", Summary: "Liveness probe", Status: "implemented"},
			{Method: "GET", Path: "/readyz", Summary: "Readiness probe", Status: "implemented"},
			{Method: "GET", Path: "/metrics", Summary: "Prometheus-style service metrics", Status: "implemented"},
			{Method: "GET", Path: "/v1/meta/manifest", Summary: "Service route manifest", Status: "implemented"},
			{Method: "POST", Path: "/webhooks/github", Summary: "Validate, deduplicate, and queue GitHub webhook deliveries", Status: "implemented"},
			{Method: "POST", Path: "/v1/webhooks/github/deliveries/{delivery_id}/requeue", Summary: "Manually requeue a stored GitHub webhook delivery", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/preview", Summary: "Build a sync event preview without queueing it", Status: "implemented"},
			{Method: "GET", Path: "/v1/sync/runs", Summary: "List persisted webhook and manual sync run records with user, repository, subject, or correlation filters", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/installation/execute", Summary: "Run a bounded installation sync using live GitHub App installation inventory when configured, with persisted-repository fallback", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/user/execute", Summary: "Fetch and persist a bounded live user sync by discovering authored PRs and hydrating them with GitHub App installation credentials", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/repository/execute", Summary: "Fetch and persist a bounded live repository sync directly from the GitHub REST API", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/pull-request/execute", Summary: "Fetch and persist a bounded live pull request sync with reviews and review comments", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/review/execute", Summary: "Fetch and persist a bounded live review sync by refreshing the review surface for one pull request", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/issue/execute", Summary: "Fetch and persist a bounded live issue sync directly from the GitHub REST API", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/commit/execute", Summary: "Fetch and persist a bounded live commit sync directly from the GitHub REST API", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/installation", Summary: "Queue an installation sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/user", Summary: "Queue a user history sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/repository", Summary: "Queue a repository sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/pull-request", Summary: "Queue a pull request sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/review", Summary: "Queue a review sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/issue", Summary: "Queue an issue sync", Status: "implemented"},
			{Method: "POST", Path: "/v1/sync/commit", Summary: "Queue a commit sync", Status: "implemented"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "GitHub REST API", Kind: "external_http", BaseURL: cfg.GitHub.APIBaseURL, Purpose: "Repository and PR synchronization", Auth: "GitHub App installation token for sync, OAuth user token only for installation discovery", Critical: true, Status: "configured"},
			{Name: "GitHub GraphQL API", Kind: "external_http", BaseURL: cfg.GitHub.GraphQLURL, Purpose: "Efficient repository and PR graph access", Auth: "GitHub App installation token for sync, OAuth user token only for installation discovery", Critical: true, Status: "configured"},
			{Name: "In-memory queue preview", Kind: "queue", Purpose: "Pending jobs and delivery deduplication during local development", Critical: true, Status: "implemented"},
			{Name: "Redis", Kind: "queue", Purpose: "Pending jobs and delivery deduplication", Critical: true, Status: "planned"},
			{Name: "PostgreSQL", Kind: "database", Purpose: "Durable webhook delivery deduplication and normalized GitHub data persistence", Critical: true, Status: "implemented"},
		},
	}
}
