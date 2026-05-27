package service

import (
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
)

func TestNormalizeSyncRunViews(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 5, 27, 20, 0, 0, 0, time.UTC)
	finishedAt := now.Add(-time.Minute)
	runs := []contracts.GitHubSyncRunView{
		{
			ID:        "missing-status-inflight",
			Status:    "",
			StartedAt: now.Add(-2 * time.Minute),
		},
		{
			ID:         "missing-status-finished",
			Status:     "",
			StartedAt:  now.Add(-4 * time.Minute),
			FinishedAt: &finishedAt,
		},
		{
			ID:        "stale-running",
			Status:    "running",
			StartedAt: now.Add(-10 * time.Minute),
		},
		{
			ID:        "fresh-running",
			Status:    "in_progress",
			StartedAt: now.Add(-30 * time.Second),
		},
		{
			ID:         "finished-running",
			Status:     "syncing",
			StartedAt:  now.Add(-2 * time.Minute),
			FinishedAt: &finishedAt,
		},
	}

	normalized := normalizeSyncRunViews(runs, now, 2*time.Minute)
	if normalized[0].Status != "running" {
		t.Fatalf("normalized[0].Status = %q, want running", normalized[0].Status)
	}
	if normalized[1].Status != "completed" {
		t.Fatalf("normalized[1].Status = %q, want completed", normalized[1].Status)
	}
	if normalized[2].Status != "failed" {
		t.Fatalf("normalized[2].Status = %q, want failed", normalized[2].Status)
	}
	if normalized[2].LastError == "" {
		t.Fatal("normalized[2].LastError = empty, want generated stale-running error")
	}
	if normalized[3].Status != "running" {
		t.Fatalf("normalized[3].Status = %q, want running", normalized[3].Status)
	}
	if normalized[4].Status != "completed" {
		t.Fatalf("normalized[4].Status = %q, want completed", normalized[4].Status)
	}
}

func TestSyncRunActiveWindow(t *testing.T) {
	t.Parallel()

	cfg := config.GitHub{
		UserPRSyncTimeoutDefault: 45 * time.Second,
		UserPRSyncTimeoutMax:     90 * time.Second,
	}
	if got := syncRunActiveWindow(cfg); got != 2*time.Minute {
		t.Fatalf("syncRunActiveWindow(defaults) = %s, want 2m", got)
	}

	cfg = config.GitHub{
		UserPRSyncTimeoutDefault: 10 * time.Minute,
		UserPRSyncTimeoutMax:     15 * time.Minute,
	}
	if got := syncRunActiveWindow(cfg); got != 15*time.Minute+30*time.Second {
		t.Fatalf("syncRunActiveWindow(long) = %s, want 15m30s", got)
	}
}
