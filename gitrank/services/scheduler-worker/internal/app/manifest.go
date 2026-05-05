package app

import (
	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
)

func Manifest(cfg config.App, version string) contracts.ServiceManifest {
	return contracts.ServiceManifest{
		Service:     cfg.ServiceName,
		Description: "Async scheduler and repair job orchestration service.",
		Version:     version,
		Routes: []contracts.RouteSpec{
			{Method: "GET", Path: "/healthz", Summary: "Liveness probe", Status: "implemented"},
			{Method: "GET", Path: "/readyz", Summary: "Readiness probe", Status: "implemented"},
			{Method: "GET", Path: "/metrics", Summary: "Prometheus-style service metrics", Status: "implemented"},
			{Method: "GET", Path: "/v1/meta/manifest", Summary: "Service route manifest", Status: "implemented"},
			{Method: "GET", Path: "/v1/jobs/config", Summary: "Current scheduler configuration preview", Status: "implemented"},
			{Method: "GET", Path: "/v1/jobs/dead-letters/config", Summary: "Current dead-letter queue policy preview", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/sync", Summary: "Schedule a sync job", Status: "planned"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "Redis", Kind: "queue", Purpose: "Job state and coordination", Critical: true, Status: "planned"},
			{Name: "PostgreSQL", Kind: "database", Purpose: "Job leases, cursors, and dead letters", Critical: true, Status: "implemented"},
			{Name: "github-ingestor", Kind: "internal_http", BaseURL: cfg.Services.GitHubIngestorBaseURL, Purpose: "Repository and PR sync flows", Auth: "service_to_service", Critical: true, Status: "configured"},
			{Name: "scoring-engine", Kind: "internal_http", BaseURL: cfg.Services.ScoringBaseURL, Purpose: "Re-score requests and repair flows", Auth: "service_to_service", Critical: true, Status: "configured"},
		},
	}
}
