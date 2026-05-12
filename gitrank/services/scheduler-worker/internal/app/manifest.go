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
			{Method: "GET", Path: "/v1/jobs", Summary: "List current scheduler jobs and queue state, with optional filters for user, repository, installation, status, type, subject, or correlation ID", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/sync", Summary: "Schedule a GitHub sync or score replay job", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/tick", Summary: "Trigger one scheduler evaluation tick", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/lease", Summary: "Lease ready jobs up to the configured concurrency limit", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/run-once", Summary: "Execute the next ready in-process scheduler job", Status: "implemented"},
			{Method: "GET", Path: "/v1/jobs/backfills", Summary: "List recurring backfill plans", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/backfills", Summary: "Create a recurring backfill plan", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/backfills/{plan_id}/pause", Summary: "Pause a recurring backfill plan", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/backfills/{plan_id}/resume", Summary: "Resume a recurring backfill plan", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/backfills/{plan_id}/cancel", Summary: "Cancel queued or leased jobs from the latest recurring backfill run", Status: "implemented"},
			{Method: "DELETE", Path: "/v1/jobs/backfills/{plan_id}", Summary: "Delete a recurring backfill plan", Status: "implemented"},
			{Method: "GET", Path: "/v1/jobs/dead-letters", Summary: "List dead-lettered jobs", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/{job_id}/complete", Summary: "Mark a leased job as completed", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/{job_id}/fail", Summary: "Fail a job and retry or dead-letter it", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/{job_id}/pause", Summary: "Pause an in-flight or pending job", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/{job_id}/resume", Summary: "Resume a paused job", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/{job_id}/cancel", Summary: "Cancel a pending or leased job", Status: "implemented"},
			{Method: "POST", Path: "/v1/jobs/dead-letters/{record_id}/replay", Summary: "Replay a dead-lettered job", Status: "implemented"},
		},
		Dependencies: []contracts.DependencySpec{
			{Name: "In-memory queue and worker state", Kind: "queue", Purpose: "Local runtime scheduler state, recurring plans, retries, dead letters, and bounded sync job execution", Critical: true, Status: "implemented"},
			{Name: "Redis", Kind: "queue", Purpose: "Job state and coordination", Critical: true, Status: "planned"},
			{Name: "PostgreSQL", Kind: "database", Purpose: "Durable scheduler jobs, dead letters, recurring backfill plans, rate-limit windows, and scheduler counters", Critical: true, Status: "implemented"},
			{Name: "github-ingestor", Kind: "internal_http", BaseURL: cfg.Services.GitHubIngestorBaseURL, Purpose: "Repository and PR sync flows", Auth: "service_to_service", Critical: true, Status: "configured"},
			{Name: "pr-analyzer", Kind: "internal_http", BaseURL: cfg.Services.PRAnalyzerBaseURL, Purpose: "Executable persisted PR analysis jobs", Auth: "service_to_service", Critical: true, Status: "configured"},
			{Name: "scoring-engine", Kind: "internal_http", BaseURL: cfg.Services.ScoringBaseURL, Purpose: "Executable score replay jobs for V2 backfills and repair flows", Auth: "service_to_service", Critical: true, Status: "configured"},
			{Name: "profile-service", Kind: "internal_http", BaseURL: cfg.Services.ProfileBaseURL, Purpose: "Executable profile snapshot refresh jobs after scoring", Auth: "service_to_service", Critical: true, Status: "configured"},
		},
	}
}
