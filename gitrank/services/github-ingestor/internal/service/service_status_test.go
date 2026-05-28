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

func TestNormalizeSyncRunViewsSupersedesOlderActiveRowsWithTerminalCorrelation(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 5, 27, 20, 0, 0, 0, time.UTC)
	finishedAt := now.Add(-time.Minute)
	runs := []contracts.GitHubSyncRunView{
		{
			ID:            "terminal-user-run",
			RunType:       "user",
			CorrelationID: "corr-1",
			Status:        "completed",
			StartedAt:     now.Add(-2 * time.Minute),
			FinishedAt:    &finishedAt,
		},
		{
			ID:            "older-running-row",
			RunType:       "user",
			CorrelationID: "corr-1",
			Status:        "running",
			StartedAt:     now.Add(-3 * time.Minute),
		},
		{
			ID:            "newer-running-row",
			RunType:       "user",
			CorrelationID: "corr-1",
			Status:        "running",
			StartedAt:     now.Add(-30 * time.Second),
		},
		{
			ID:            "other-correlation-running",
			RunType:       "user",
			CorrelationID: "corr-2",
			Status:        "running",
			StartedAt:     now.Add(-3 * time.Minute),
		},
	}

	normalized := normalizeSyncRunViews(runs, now, 10*time.Minute)

	if normalized[0].Status != "completed" {
		t.Fatalf("normalized[0].Status = %q, want completed", normalized[0].Status)
	}
	if normalized[1].Status != "failed" {
		t.Fatalf("normalized[1].Status = %q, want failed", normalized[1].Status)
	}
	if normalized[1].LastError == "" {
		t.Fatal("normalized[1].LastError = empty, want superseded-correlation reason")
	}
	if normalized[1].Metrics["superseded_by_terminal_correlation"] != 1 {
		t.Fatalf("normalized[1].Metrics[superseded_by_terminal_correlation] = %d, want 1", normalized[1].Metrics["superseded_by_terminal_correlation"])
	}
	if normalized[2].Status != "running" {
		t.Fatalf("normalized[2].Status = %q, want running (newer than terminal)", normalized[2].Status)
	}
	if normalized[2].Metrics != nil && normalized[2].Metrics["superseded_by_terminal_correlation"] > 0 {
		t.Fatalf("normalized[2] should not be tagged as superseded")
	}
	if normalized[3].Status != "running" {
		t.Fatalf("normalized[3].Status = %q, want running (different correlation)", normalized[3].Status)
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

func TestSyncRunQueuedWindow(t *testing.T) {
	t.Parallel()

	if got := syncRunQueuedWindow(10 * time.Second); got != time.Minute {
		t.Fatalf("syncRunQueuedWindow(short) = %s, want 1m", got)
	}

	if got := syncRunQueuedWindow(2 * time.Minute); got != 4*time.Minute {
		t.Fatalf("syncRunQueuedWindow(normal) = %s, want 4m", got)
	}
}

func TestNormalizeSyncRunFilterCanonicalizesCaseAndHandlePrefixes(t *testing.T) {
	t.Parallel()

	filter := normalizeSyncRunFilter(contracts.GitHubSyncRunFilter{
		RunType:                " User ",
		Status:                 " Completed ",
		Repository:             " Octo/Repo ",
		User:                   " @Ayush3941 ",
		RequestedByGitHubLogin: " @@Ayush3941 ",
		Limit:                  0,
	}, 25, 100)

	if filter.RunType != "user" {
		t.Fatalf("RunType = %q, want user", filter.RunType)
	}
	if filter.Status != "completed" {
		t.Fatalf("Status = %q, want completed", filter.Status)
	}
	if filter.Repository != "octo/repo" {
		t.Fatalf("Repository = %q, want octo/repo", filter.Repository)
	}
	if filter.User != "ayush3941" {
		t.Fatalf("User = %q, want ayush3941", filter.User)
	}
	if filter.RequestedByGitHubLogin != "ayush3941" {
		t.Fatalf("RequestedByGitHubLogin = %q, want ayush3941", filter.RequestedByGitHubLogin)
	}
	if filter.Limit != 25 {
		t.Fatalf("Limit = %d, want default 25", filter.Limit)
	}
}

func TestSummarizeSyncRunWatermarks(t *testing.T) {
	t.Parallel()

	attemptOne := time.Date(2026, 5, 27, 18, 0, 0, 0, time.UTC)
	successOne := attemptOne.Add(2 * time.Minute)
	attemptTwo := time.Date(2026, 5, 27, 19, 0, 0, 0, time.UTC)
	attemptThree := time.Date(2026, 5, 27, 20, 0, 0, 0, time.UTC)
	successThree := attemptThree.Add(30 * time.Second)

	lastAttemptedAt, lastSuccessfulAt := summarizeSyncRunWatermarks([]contracts.GitHubSyncRunView{
		{
			ID:         "completed",
			Status:     "completed",
			StartedAt:  attemptOne,
			FinishedAt: &successOne,
		},
		{
			ID:        "failed",
			Status:    "failed",
			StartedAt: attemptTwo,
		},
		{
			ID:         "completed-2",
			Status:     "completed",
			StartedAt:  attemptThree,
			FinishedAt: &successThree,
		},
		{
			ID:        "partial",
			Status:    "partial",
			StartedAt: attemptThree.Add(15 * time.Second),
		},
	})

	if lastAttemptedAt == nil {
		t.Fatal("lastAttemptedAt = nil, want timestamp")
	}
	if !lastAttemptedAt.Equal(attemptThree.Add(15 * time.Second)) {
		t.Fatalf("lastAttemptedAt = %s, want %s", lastAttemptedAt.UTC(), attemptThree.Add(15*time.Second))
	}
	if lastSuccessfulAt == nil {
		t.Fatal("lastSuccessfulAt = nil, want timestamp")
	}
	if !lastSuccessfulAt.Equal(successThree) {
		t.Fatalf("lastSuccessfulAt = %s, want %s", lastSuccessfulAt.UTC(), successThree)
	}
}

func TestSyncRunListUpdatedAtUsesNewestRunTimestamp(t *testing.T) {
	t.Parallel()

	fallback := time.Date(2026, 5, 27, 21, 0, 0, 0, time.UTC)
	started := time.Date(2026, 5, 27, 19, 0, 0, 0, time.UTC)
	finished := started.Add(45 * time.Second)
	newest := time.Date(2026, 5, 27, 22, 10, 0, 0, time.UTC)

	got := syncRunListUpdatedAt([]contracts.GitHubSyncRunView{
		{
			ID:         "completed",
			Status:     "completed",
			StartedAt:  started,
			FinishedAt: &finished,
		},
		{
			ID:        "running",
			Status:    "running",
			StartedAt: newest,
		},
	}, fallback)

	if !got.Equal(newest) {
		t.Fatalf("syncRunListUpdatedAt() = %s, want %s", got.UTC(), newest.UTC())
	}
}

func TestSyncRunListUpdatedAtFallsBackWhenNoRuns(t *testing.T) {
	t.Parallel()

	fallback := time.Date(2026, 5, 27, 21, 0, 0, 0, time.UTC)
	got := syncRunListUpdatedAt(nil, fallback)
	if !got.Equal(fallback.UTC()) {
		t.Fatalf("syncRunListUpdatedAt(nil) = %s, want %s", got.UTC(), fallback.UTC())
	}
}
