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
			{Method: "GET", Path: "/v1/jobs", Summary: "List current scheduler jobs and queue state", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/sync", Summary: "Schedule a sync job", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/lease", Summary: "Lease ready jobs up to the configured concurrency limit", Status: "implemented"},
			{Method: "GET", Path: "/v1/jobs/dead-letters", Summary: "List dead-lettered jobs", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/{job_id}/complete", Summary: "Mark a leased job as completed", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/{job_id}/fail", Summary: "Fail a job and retry or dead-letter it", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/{job_id}/pause", Summary: "Pause an in-flight or pending job", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/{job_id}/resume", Summary: "Resume a paused job", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/{job_id}/cancel", Summary: "Cancel a pending or leased job", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/dead-letters/{record_id}/replay", Summary: "Replay a dead-lettered job", Status: "implemented"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "In-memory queue preview", Kind: "queue", Purpose: "Local scheduler state, retries, and dead letters", Critical: true, Status: "implemented"},
			{Name: "Redis", Kind: "queue", Purpose: "Job state and coordination", Critical: true, Status: "planned"},
			{Name: "PostgreSQL", Kind: "database", Purpose: "Persistent job leases, cursors, and dead letters", Critical: true, Status: "planned"},
			{Name: "github-ingestor", Kind: "internal_http", BaseURL: cfg.Services.GitHubIngestorBaseURL, Purpose: "Repository and PR sync flows", Auth: "service_to_service", Critical: true, Status: "configured"},
			{Name: "scoring-engine", Kind: "internal_http", BaseURL: cfg.Services.ScoringBaseURL, Purpose: "Re-score requests and repair flows", Auth: "service_to_service", Critical: true, Status: "configured"},
		},
	}
}
