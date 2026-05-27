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
			ID:     "missing-status-no-start",
			Status: "",
		},
		{
			ID:        "stale-running",
			Status:    "running",
			StartedAt: now.Add(-10 * time.Minute),
		},
		{
			ID:     "running-no-start",
			Status: "running",
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
		{
			ID:        "stale-queued",
			Status:    "queued",
			StartedAt: now.Add(-5 * time.Minute),
		},
	}

	normalized := normalizeSyncRunViews(runs, now, 2*time.Minute)
	if normalized[0].Status != "running" {
		t.Fatalf("normalized[0].Status = %q, want running", normalized[0].Status)
	}
	if normalized[1].Status != "completed" {
		t.Fatalf("normalized[1].Status = %q, want completed", normalized[1].Status)
	}
	if normalized[2].Status != "queued" {
		t.Fatalf("normalized[2].Status = %q, want queued", normalized[2].Status)
	}
	if normalized[3].Status != "failed" {
		t.Fatalf("normalized[3].Status = %q, want failed", normalized[3].Status)
	}
	if normalized[3].LastError == "" {
		t.Fatal("normalized[3].LastError = empty, want generated stale-running error")
	}
	if normalized[4].Status != "failed" {
		t.Fatalf("normalized[4].Status = %q, want failed", normalized[4].Status)
	}
	if normalized[4].LastError == "" {
		t.Fatal("normalized[4].LastError = empty, want generated missing-start error")
	}
	if normalized[5].Status != "running" {
		t.Fatalf("normalized[5].Status = %q, want running", normalized[5].Status)
	}
	if normalized[6].Status != "completed" {
		t.Fatalf("normalized[6].Status = %q, want completed", normalized[6].Status)
	}
	if normalized[7].Status != "failed" {
		t.Fatalf("normalized[7].Status = %q, want failed", normalized[7].Status)
	}
	if normalized[7].LastError == "" {
		t.Fatal("normalized[7].LastError = empty, want generated stale-queued error")
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
