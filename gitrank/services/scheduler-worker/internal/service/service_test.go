package service

import (
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
)

func TestTickQueuesRecurringBackfillTargets(t *testing.T) {
	cfg := testServiceConfig()
	cfg.Scheduler.SyncCron = "*/5 * * * *"
	scheduler := New(cfg)
	createdAt := time.Date(2026, time.May, 5, 10, 0, 0, 0, time.UTC)

	plan, err := scheduler.CreateBackfillPlan(contracts.SchedulerBackfillPlanRequest{
		Name: "mixed-backfill",
		Targets: []contracts.SyncRequest{
			{Mode: "user", User: "octocat"},
			{Mode: "repository", Repository: "octo/repo"},
		},
	}, createdAt)
	if err != nil {
		t.Fatalf("CreateBackfillPlan() error = %v", err)
	}

	tickAt := createdAt.Add(5 * time.Minute)
	response, err := scheduler.Tick(tickAt)
	if err != nil {
		t.Fatalf("Tick() error = %v", err)
	}
	if response.DuePlans != 1 {
		t.Fatalf("due plans = %d, want 1", response.DuePlans)
	}
	if response.ExecutedPlans != 1 {
		t.Fatalf("executed plans = %d, want 1", response.ExecutedPlans)
	}
	if response.QueuedJobs != 2 {
		t.Fatalf("queued jobs = %d, want 2", response.QueuedJobs)
	}

	plans := scheduler.BackfillPlans(tickAt)
	if len(plans.Plans) != 1 {
		t.Fatalf("plan count = %d, want 1", len(plans.Plans))
	}
	if plans.Plans[0].ID != plan.ID {
		t.Fatalf("plan id = %q, want %q", plans.Plans[0].ID, plan.ID)
	}
	if plans.Plans[0].LastRunAt == nil || !plans.Plans[0].LastRunAt.Equal(tickAt) {
		t.Fatalf("last run at = %v, want %v", plans.Plans[0].LastRunAt, tickAt)
	}
	if plans.Plans[0].QueuedJobsTotal != 2 {
		t.Fatalf("queued jobs total = %d, want 2", plans.Plans[0].QueuedJobsTotal)
	}

	queue := scheduler.QueueStatus(tickAt)
	if queue.QueueDepth != 2 {
		t.Fatalf("queue depth = %d, want 2", queue.QueueDepth)
	}
}

func TestTickTracksInstallationRateLimitedTargets(t *testing.T) {
	cfg := testServiceConfig()
	cfg.Scheduler.PerInstallationRateWindow = time.Hour
	cfg.Scheduler.PerInstallationRateMax = 1
	scheduler := New(cfg)
	createdAt := time.Date(2026, time.May, 5, 12, 0, 0, 0, time.UTC)

	_, err := scheduler.CreateBackfillPlan(contracts.SchedulerBackfillPlanRequest{
		Name: "installation-backfill",
		Cron: "0 * * * *",
		Targets: []contracts.SyncRequest{
			{Mode: "installation", InstallationID: 42},
			{Mode: "installation", InstallationID: 42},
		},
	}, createdAt)
	if err != nil {
		t.Fatalf("CreateBackfillPlan() error = %v", err)
	}

	response, err := scheduler.Tick(createdAt.Add(time.Hour))
	if err != nil {
		t.Fatalf("Tick() error = %v", err)
	}
	if response.DuePlans != 1 {
		t.Fatalf("due plans = %d, want 1", response.DuePlans)
	}
	if response.QueuedJobs != 1 {
		t.Fatalf("queued jobs = %d, want 1", response.QueuedJobs)
	}
	if response.RateLimitedTargets != 1 {
		t.Fatalf("rate limited targets = %d, want 1", response.RateLimitedTargets)
	}

	plans := scheduler.BackfillPlans(createdAt.Add(time.Hour))
	if len(plans.Plans) != 1 {
		t.Fatalf("plan count = %d, want 1", len(plans.Plans))
	}
	if plans.Plans[0].RateLimitedTotal != 1 {
		t.Fatalf("plan rate limited total = %d, want 1", plans.Plans[0].RateLimitedTotal)
	}
	if scheduler.QueueStatus(createdAt.Add(time.Hour)).QueueDepth != 1 {
		t.Fatalf("queue depth = %d, want 1", scheduler.QueueStatus(createdAt.Add(time.Hour)).QueueDepth)
	}
}

func TestPauseResumeAndDeleteBackfillPlan(t *testing.T) {
	cfg := testServiceConfig()
	cfg.Scheduler.SyncCron = "*/5 * * * *"
	scheduler := New(cfg)
	createdAt := time.Date(2026, time.May, 5, 13, 0, 0, 0, time.UTC)

	plan, err := scheduler.CreateBackfillPlan(contracts.SchedulerBackfillPlanRequest{
		Name: "pauseable-plan",
		Targets: []contracts.SyncRequest{
			{Mode: "user", User: "octocat"},
		},
	}, createdAt)
	if err != nil {
		t.Fatalf("CreateBackfillPlan() error = %v", err)
	}

	paused, err := scheduler.PauseBackfillPlan(plan.ID, createdAt.Add(time.Minute))
	if err != nil {
		t.Fatalf("PauseBackfillPlan() error = %v", err)
	}
	if paused.Status != "paused" || paused.Plan.Enabled {
		t.Fatalf("pause response = %+v, want disabled plan", paused)
	}

	tickWhilePaused, err := scheduler.Tick(createdAt.Add(10 * time.Minute))
	if err != nil {
		t.Fatalf("Tick() while paused error = %v", err)
	}
	if tickWhilePaused.DuePlans != 0 {
		t.Fatalf("paused due plans = %d, want 0", tickWhilePaused.DuePlans)
	}

	resumed, err := scheduler.ResumeBackfillPlan(plan.ID, createdAt.Add(11*time.Minute))
	if err != nil {
		t.Fatalf("ResumeBackfillPlan() error = %v", err)
	}
	if resumed.Status != "resumed" || !resumed.Plan.Enabled {
		t.Fatalf("resume response = %+v, want enabled plan", resumed)
	}

	deleted, err := scheduler.DeleteBackfillPlan(plan.ID, createdAt.Add(12*time.Minute))
	if err != nil {
		t.Fatalf("DeleteBackfillPlan() error = %v", err)
	}
	if deleted.Status != "deleted" {
		t.Fatalf("delete status = %q, want deleted", deleted.Status)
	}
	if len(scheduler.BackfillPlans(createdAt.Add(12*time.Minute)).Plans) != 0 {
		t.Fatal("expected deleted plan to be removed from list")
	}
}

func testServiceConfig() config.App {
	return config.App{
		ServiceName: "scheduler-worker",
		Env:         config.Development,
		Addr:        ":8086",
		Log: config.Log{
			Level:  "info",
			Format: "text",
		},
		ShutdownTimeout: time.Second,
		Scheduler: config.Scheduler{
			SyncCron:                  "0 */6 * * *",
			MaxAttempts:               3,
			RetryBackoff:              time.Millisecond,
			WorkerConcurrency:         2,
			LeaseTTL:                  time.Second,
			PollInterval:              time.Second,
			DeadLetterQueue:           "github-sync-dead-letter",
			PerUserRateWindow:         time.Minute,
			PerUserRateMax:            6,
			PerInstallationRateWindow: time.Minute,
			PerInstallationRateMax:    10,
		},
	}
}
