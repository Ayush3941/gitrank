package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/store"
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

	queue := scheduler.QueueStatus(tickAt, contracts.SchedulerJobFilter{})
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
	if scheduler.QueueStatus(createdAt.Add(time.Hour), contracts.SchedulerJobFilter{}).QueueDepth != 1 {
		t.Fatalf("queue depth = %d, want 1", scheduler.QueueStatus(createdAt.Add(time.Hour), contracts.SchedulerJobFilter{}).QueueDepth)
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

func TestCancelBackfillPlanJobsCancelsLatestRun(t *testing.T) {
	cfg := testServiceConfig()
	cfg.Scheduler.SyncCron = "*/5 * * * *"
	scheduler := New(cfg)
	createdAt := time.Date(2026, time.May, 5, 13, 0, 0, 0, time.UTC)

	plan, err := scheduler.CreateBackfillPlan(contracts.SchedulerBackfillPlanRequest{
		Name: "cancelable-plan",
		Targets: []contracts.SyncRequest{
			{Mode: "user", User: "octocat"},
			{Mode: "repository", Repository: "octo/repo"},
		},
	}, createdAt)
	if err != nil {
		t.Fatalf("CreateBackfillPlan() error = %v", err)
	}

	tickAt := createdAt.Add(5 * time.Minute)
	if _, err := scheduler.Tick(tickAt); err != nil {
		t.Fatalf("Tick() error = %v", err)
	}

	plans := scheduler.BackfillPlans(tickAt)
	if len(plans.Plans) != 1 {
		t.Fatalf("plan count = %d, want 1", len(plans.Plans))
	}
	if plans.Plans[0].LastCorrelationID == "" {
		t.Fatal("last correlation id is empty after tick")
	}

	canceled, err := scheduler.CancelBackfillPlanJobs(plan.ID, tickAt.Add(time.Minute))
	if err != nil {
		t.Fatalf("CancelBackfillPlanJobs() error = %v", err)
	}
	if canceled.Status != "canceled_jobs" {
		t.Fatalf("cancel status = %q, want canceled_jobs", canceled.Status)
	}
	if canceled.CorrelationID == "" {
		t.Fatal("cancel correlation id is empty")
	}
	if canceled.CorrelationID != plans.Plans[0].LastCorrelationID {
		t.Fatalf("cancel correlation id = %q, want %q", canceled.CorrelationID, plans.Plans[0].LastCorrelationID)
	}
	if canceled.AffectedJobs != 2 {
		t.Fatalf("affected jobs = %d, want 2", canceled.AffectedJobs)
	}

	queue := scheduler.QueueStatus(tickAt.Add(time.Minute), contracts.SchedulerJobFilter{
		CorrelationID: canceled.CorrelationID,
	})
	if queue.VisibleJobs != 2 {
		t.Fatalf("visible jobs = %d, want 2", queue.VisibleJobs)
	}
	for _, job := range queue.Jobs {
		if job.Status != string(store.JobCanceled) {
			t.Fatalf("job status = %q, want %q", job.Status, store.JobCanceled)
		}
	}
}

func TestQueueStatusFiltersJobsByUserAndRepository(t *testing.T) {
	cfg := testServiceConfig()
	scheduler := New(cfg)
	now := time.Date(2026, time.May, 5, 14, 0, 0, 0, time.UTC)

	if _, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "user", User: "octocat"}, "user-correlation", now); err != nil {
		t.Fatalf("EnqueueSync(user) error = %v", err)
	}
	if _, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "repository", Repository: "octo/repo"}, "repo-correlation", now); err != nil {
		t.Fatalf("EnqueueSync(repository) error = %v", err)
	}

	userView := scheduler.QueueStatus(now, contracts.SchedulerJobFilter{User: "octocat"})
	if userView.VisibleJobs != 1 {
		t.Fatalf("user visible jobs = %d, want 1", userView.VisibleJobs)
	}
	if len(userView.Jobs) != 1 || userView.Jobs[0].Type != string(store.SyncUserHistoryJob) {
		t.Fatalf("user jobs = %+v, want one sync.user_history job", userView.Jobs)
	}

	repoView := scheduler.QueueStatus(now, contracts.SchedulerJobFilter{Repository: "octo/repo"})
	if repoView.VisibleJobs != 1 {
		t.Fatalf("repository visible jobs = %d, want 1", repoView.VisibleJobs)
	}
	if len(repoView.Jobs) != 1 || repoView.Jobs[0].Repository != "octo/repo" {
		t.Fatalf("repository jobs = %+v, want repository octo/repo", repoView.Jobs)
	}
}

func TestLeaseFailRetryAndCompleteLifecycle(t *testing.T) {
	cfg := testServiceConfig()
	cfg.Scheduler.RetryBackoff = time.Second
	scheduler := New(cfg)
	leaseAt := time.Now().UTC().Add(2 * time.Second)

	enqueue, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "user", User: "octocat"}, "worker-correlation", leaseAt.Add(-2*time.Second))
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}
	if len(enqueue.JobIDs) != 1 {
		t.Fatalf("job ids len = %d, want 1", len(enqueue.JobIDs))
	}
	jobID := enqueue.JobIDs[0]

	firstLease, err := scheduler.Lease(1, leaseAt)
	if err != nil {
		t.Fatalf("Lease() error = %v", err)
	}
	if len(firstLease.Jobs) != 1 {
		t.Fatalf("first lease jobs = %d, want 1", len(firstLease.Jobs))
	}
	if firstLease.Jobs[0].ID != jobID {
		t.Fatalf("leased job id = %q, want %q", firstLease.Jobs[0].ID, jobID)
	}

	failed, err := scheduler.Fail(jobID, "temporary upstream failure", leaseAt)
	if err != nil {
		t.Fatalf("Fail() error = %v", err)
	}
	if failed.Status != "failed" {
		t.Fatalf("fail status = %q, want failed", failed.Status)
	}
	if failed.Job.AttemptCount != 1 {
		t.Fatalf("attempt count = %d, want 1", failed.Job.AttemptCount)
	}

	earlyLease, err := scheduler.Lease(1, leaseAt.Add(500*time.Millisecond))
	if err != nil {
		t.Fatalf("Lease() error = %v", err)
	}
	if len(earlyLease.Jobs) != 0 {
		t.Fatalf("early lease jobs = %d, want 0 before backoff expires", len(earlyLease.Jobs))
	}

	retryLease, err := scheduler.Lease(1, leaseAt.Add(1100*time.Millisecond))
	if err != nil {
		t.Fatalf("Lease() error = %v", err)
	}
	if len(retryLease.Jobs) != 1 {
		t.Fatalf("retry lease jobs = %d, want 1", len(retryLease.Jobs))
	}
	if retryLease.Jobs[0].ID != jobID {
		t.Fatalf("retry leased job id = %q, want %q", retryLease.Jobs[0].ID, jobID)
	}

	completed, err := scheduler.Complete(jobID, leaseAt.Add(2*time.Second))
	if err != nil {
		t.Fatalf("Complete() error = %v", err)
	}
	if completed.Status != "completed" {
		t.Fatalf("complete status = %q, want completed", completed.Status)
	}

	queue := scheduler.QueueStatus(leaseAt.Add(2*time.Second), contracts.SchedulerJobFilter{})
	if queue.QueueDepth != 0 {
		t.Fatalf("queue depth = %d, want 0", queue.QueueDepth)
	}
	if queue.ActiveLeases != 0 {
		t.Fatalf("active leases = %d, want 0", queue.ActiveLeases)
	}
	if queue.Retried != 1 {
		t.Fatalf("retried = %d, want 1", queue.Retried)
	}
}

func TestCompletePreservesCanceledStatus(t *testing.T) {
	cfg := testServiceConfig()
	scheduler := New(cfg)
	now := time.Now().UTC().Add(2 * time.Second).Truncate(time.Second)

	enqueue, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "user", User: "octocat"}, "cancel-before-complete", now)
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}
	jobID := enqueue.JobIDs[0]

	lease, err := scheduler.Lease(1, now.Add(time.Second))
	if err != nil {
		t.Fatalf("Lease() error = %v", err)
	}
	if len(lease.Jobs) != 1 || lease.Jobs[0].ID != jobID {
		t.Fatalf("leased jobs = %+v, want job %q", lease.Jobs, jobID)
	}

	canceled, err := scheduler.Cancel(jobID, now.Add(2*time.Second))
	if err != nil {
		t.Fatalf("Cancel() error = %v", err)
	}
	if canceled.Status != "canceled" {
		t.Fatalf("cancel status = %q, want canceled", canceled.Status)
	}

	completed, err := scheduler.Complete(jobID, now.Add(3*time.Second))
	if err != nil {
		t.Fatalf("Complete() error = %v", err)
	}
	if completed.Status != "canceled" {
		t.Fatalf("complete status = %q, want canceled", completed.Status)
	}
	if completed.Job.Status != string(store.JobCanceled) {
		t.Fatalf("complete job status = %q, want %q", completed.Job.Status, store.JobCanceled)
	}
}

func TestRunNextExecutesRepositoryJobAndCompletes(t *testing.T) {
	now := time.Now().UTC().Add(2 * time.Second).Truncate(time.Second)
	var observed contracts.SyncRequest
	var observedRequestID string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observedRequestID = r.Header.Get("X-Request-ID")
		if r.URL.Path != "/v1/sync/repository/execute" {
			t.Fatalf("path = %q, want %q", r.URL.Path, "/v1/sync/repository/execute")
		}
		if err := json.NewDecoder(r.Body).Decode(&observed); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		_ = json.NewEncoder(w).Encode(contracts.GitHubSyncExecutionResponse{
			Status:        "completed",
			Mode:          "repository",
			Repository:    observed.Repository,
			CorrelationID: observedRequestID,
			StartedAt:     now,
			FinishedAt:    now.Add(2 * time.Second),
			Fetched:       map[string]int{"pull_requests": 2},
			Persisted:     map[string]int{"pull_requests": 2},
		})
	}))
	defer server.Close()

	cfg := testServiceConfig()
	cfg.Services.GitHubIngestorBaseURL = server.URL
	cfg.Services.RequestTimeout = time.Second
	scheduler := New(cfg)

	enqueue, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "repository", Repository: "octo/repo"}, "repo-correlation", now)
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}
	if len(enqueue.JobIDs) != 1 {
		t.Fatalf("job ids len = %d, want 1", len(enqueue.JobIDs))
	}

	run, err := scheduler.RunNext(context.Background(), now)
	if err != nil {
		t.Fatalf("RunNext() error = %v", err)
	}
	if run.Status != "completed" {
		t.Fatalf("run status = %q, want completed", run.Status)
	}
	if run.Job == nil || run.Job.ID != enqueue.JobIDs[0] {
		t.Fatalf("run job = %+v, want executed job id %q", run.Job, enqueue.JobIDs[0])
	}
	if run.Execution == nil || run.Execution.Repository != "octo/repo" {
		t.Fatalf("run execution = %+v, want repository octo/repo", run.Execution)
	}
	if observed.Repository != "octo/repo" || observed.Mode != "repository" {
		t.Fatalf("observed request = %+v, want repository mode request", observed)
	}
	if observedRequestID != "repo-correlation" {
		t.Fatalf("observed request id = %q, want %q", observedRequestID, "repo-correlation")
	}

	queue := scheduler.QueueStatus(now, contracts.SchedulerJobFilter{})
	if queue.QueueDepth != 0 {
		t.Fatalf("queue depth = %d, want 0", queue.QueueDepth)
	}
}

func TestRunNextExecutesUserJobAndCompletes(t *testing.T) {
	now := time.Now().UTC().Add(30 * time.Second).Truncate(time.Second)
	var observed contracts.SyncRequest
	var observedPath string
	var observedRequestID string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observedPath = r.URL.Path
		observedRequestID = r.Header.Get("X-Request-ID")
		if err := json.NewDecoder(r.Body).Decode(&observed); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		_ = json.NewEncoder(w).Encode(contracts.GitHubSyncExecutionResponse{
			Status:        "completed",
			Mode:          "user",
			User:          observed.User,
			CorrelationID: observedRequestID,
			StartedAt:     now,
			FinishedAt:    now.Add(3 * time.Second),
			Fetched:       map[string]int{"repositories_selected": 2},
			Persisted:     map[string]int{"repositories": 2},
		})
	}))
	defer server.Close()

	cfg := testServiceConfig()
	cfg.Services.GitHubIngestorBaseURL = server.URL
	cfg.Services.RequestTimeout = time.Second
	scheduler := New(cfg)

	enqueue, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "user", User: "octocat"}, "user-correlation", now)
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}

	run, err := scheduler.RunNext(context.Background(), now)
	if err != nil {
		t.Fatalf("RunNext() error = %v", err)
	}
	if run.Status != "completed" {
		t.Fatalf("run status = %q, want completed", run.Status)
	}
	if run.Execution == nil || run.Execution.User != "octocat" || run.Execution.Mode != "user" {
		t.Fatalf("run execution = %+v, want completed user execution", run.Execution)
	}
	if observedPath != "/v1/sync/user/execute" {
		t.Fatalf("observed path = %q, want %q", observedPath, "/v1/sync/user/execute")
	}
	if observed.User != "octocat" || observed.Mode != "user" {
		t.Fatalf("observed request = %+v, want octocat user sync", observed)
	}
	if observedRequestID != "user-correlation" {
		t.Fatalf("observed request id = %q, want %q", observedRequestID, "user-correlation")
	}
	if run.Job == nil || run.Job.ID != enqueue.JobIDs[0] {
		t.Fatalf("run job = %+v, want executed job id %q", run.Job, enqueue.JobIDs[0])
	}
}

func TestRunNextExecutesInstallationJobAndCompletes(t *testing.T) {
	now := time.Now().UTC().Add(40 * time.Second).Truncate(time.Second)
	var observed contracts.SyncRequest
	var observedPath string
	var observedRequestID string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observedPath = r.URL.Path
		observedRequestID = r.Header.Get("X-Request-ID")
		if err := json.NewDecoder(r.Body).Decode(&observed); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		_ = json.NewEncoder(w).Encode(contracts.GitHubSyncExecutionResponse{
			Status:        "completed",
			Mode:          "installation",
			Installation:  observed.InstallationID,
			CorrelationID: observedRequestID,
			StartedAt:     now,
			FinishedAt:    now.Add(3 * time.Second),
			Fetched:       map[string]int{"repositories_selected": 2},
			Persisted:     map[string]int{"repositories": 2},
		})
	}))
	defer server.Close()

	cfg := testServiceConfig()
	cfg.Services.GitHubIngestorBaseURL = server.URL
	cfg.Services.RequestTimeout = time.Second
	scheduler := New(cfg)

	enqueue, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "installation", InstallationID: 42}, "installation-correlation", now)
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}

	run, err := scheduler.RunNext(context.Background(), now)
	if err != nil {
		t.Fatalf("RunNext() error = %v", err)
	}
	if run.Status != "completed" {
		t.Fatalf("run status = %q, want completed", run.Status)
	}
	if run.Execution == nil || run.Execution.Mode != "installation" || run.Execution.Installation != 42 {
		t.Fatalf("run execution = %+v, want completed installation execution", run.Execution)
	}
	if observedPath != "/v1/sync/installation/execute" {
		t.Fatalf("observed path = %q, want %q", observedPath, "/v1/sync/installation/execute")
	}
	if observed.InstallationID != 42 || observed.Mode != "installation" {
		t.Fatalf("observed request = %+v, want installation 42", observed)
	}
	if observedRequestID != "installation-correlation" {
		t.Fatalf("observed request id = %q, want %q", observedRequestID, "installation-correlation")
	}
	if run.Job == nil || run.Job.ID != enqueue.JobIDs[0] {
		t.Fatalf("run job = %+v, want executed job id %q", run.Job, enqueue.JobIDs[0])
	}
}

func TestRunNextExecutesPullRequestJobAndCompletes(t *testing.T) {
	now := time.Now().UTC().Add(45 * time.Second).Truncate(time.Second)
	var observed contracts.SyncRequest
	var observedPath string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observedPath = r.URL.Path
		if err := json.NewDecoder(r.Body).Decode(&observed); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		_ = json.NewEncoder(w).Encode(contracts.GitHubSyncExecutionResponse{
			Status:        "completed",
			Mode:          "pull_request",
			Repository:    observed.Repository,
			Number:        observed.Number,
			CorrelationID: r.Header.Get("X-Request-ID"),
			StartedAt:     now,
			FinishedAt:    now.Add(3 * time.Second),
			Fetched:       map[string]int{"pull_requests": 1, "reviews": 1},
			Persisted:     map[string]int{"pull_requests": 1, "reviews": 1},
		})
	}))
	defer server.Close()

	cfg := testServiceConfig()
	cfg.Services.GitHubIngestorBaseURL = server.URL
	cfg.Services.RequestTimeout = time.Second
	scheduler := New(cfg)

	enqueue, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "pull_request", Repository: "octo/repo", Number: 7}, "pr-correlation", now)
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}

	run, err := scheduler.RunNext(context.Background(), now)
	if err != nil {
		t.Fatalf("RunNext() error = %v", err)
	}
	if run.Status != "completed" {
		t.Fatalf("run status = %q, want completed", run.Status)
	}
	if run.Execution == nil || run.Execution.Mode != "pull_request" || run.Execution.Number != 7 {
		t.Fatalf("run execution = %+v, want completed pull request execution", run.Execution)
	}
	if observedPath != "/v1/sync/pull-request/execute" {
		t.Fatalf("observed path = %q, want %q", observedPath, "/v1/sync/pull-request/execute")
	}
	if observed.Repository != "octo/repo" || observed.Number != 7 || observed.Mode != "pull_request" {
		t.Fatalf("observed request = %+v, want repo octo/repo number 7", observed)
	}
	if run.Job == nil || run.Job.ID != enqueue.JobIDs[0] {
		t.Fatalf("run job = %+v, want executed job id %q", run.Job, enqueue.JobIDs[0])
	}
}

func TestRunNextExecutesReviewJobAndCompletes(t *testing.T) {
	now := time.Now().UTC().Add(47 * time.Second).Truncate(time.Second)
	var observed contracts.SyncRequest
	var observedPath string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observedPath = r.URL.Path
		if err := json.NewDecoder(r.Body).Decode(&observed); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		_ = json.NewEncoder(w).Encode(contracts.GitHubSyncExecutionResponse{
			Status:        "completed",
			Mode:          "review",
			Repository:    observed.Repository,
			Number:        observed.Number,
			CorrelationID: r.Header.Get("X-Request-ID"),
			StartedAt:     now,
			FinishedAt:    now.Add(3 * time.Second),
			Fetched:       map[string]int{"reviews": 1, "review_comments": 1},
			Persisted:     map[string]int{"reviews": 1, "review_comments": 1},
		})
	}))
	defer server.Close()

	cfg := testServiceConfig()
	cfg.Services.GitHubIngestorBaseURL = server.URL
	cfg.Services.RequestTimeout = time.Second
	scheduler := New(cfg)

	enqueue, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "review", Repository: "octo/repo", Number: 7}, "review-correlation", now)
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}

	run, err := scheduler.RunNext(context.Background(), now)
	if err != nil {
		t.Fatalf("RunNext() error = %v", err)
	}
	if run.Status != "completed" {
		t.Fatalf("run status = %q, want completed", run.Status)
	}
	if run.Execution == nil || run.Execution.Mode != "review" || run.Execution.Number != 7 {
		t.Fatalf("run execution = %+v, want completed review execution", run.Execution)
	}
	if observedPath != "/v1/sync/review/execute" {
		t.Fatalf("observed path = %q, want %q", observedPath, "/v1/sync/review/execute")
	}
	if observed.Repository != "octo/repo" || observed.Number != 7 || observed.Mode != "review" {
		t.Fatalf("observed request = %+v, want repo octo/repo number 7", observed)
	}
	if run.Job == nil || run.Job.ID != enqueue.JobIDs[0] {
		t.Fatalf("run job = %+v, want executed job id %q", run.Job, enqueue.JobIDs[0])
	}
}

func TestRunNextExecutesIssueJobAndCompletes(t *testing.T) {
	now := time.Now().UTC().Add(50 * time.Second).Truncate(time.Second)
	var observed contracts.SyncRequest
	var observedPath string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observedPath = r.URL.Path
		if err := json.NewDecoder(r.Body).Decode(&observed); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		_ = json.NewEncoder(w).Encode(contracts.GitHubSyncExecutionResponse{
			Status:        "completed",
			Mode:          "issue",
			Repository:    observed.Repository,
			Number:        observed.Number,
			CorrelationID: r.Header.Get("X-Request-ID"),
			StartedAt:     now,
			FinishedAt:    now.Add(2 * time.Second),
			Fetched:       map[string]int{"issues": 1},
			Persisted:     map[string]int{"issues": 1},
		})
	}))
	defer server.Close()

	cfg := testServiceConfig()
	cfg.Services.GitHubIngestorBaseURL = server.URL
	cfg.Services.RequestTimeout = time.Second
	scheduler := New(cfg)

	enqueue, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "issue", Repository: "octo/repo", Number: 3}, "issue-correlation", now)
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}

	run, err := scheduler.RunNext(context.Background(), now)
	if err != nil {
		t.Fatalf("RunNext() error = %v", err)
	}
	if run.Status != "completed" {
		t.Fatalf("run status = %q, want completed", run.Status)
	}
	if run.Execution == nil || run.Execution.Mode != "issue" || run.Execution.Number != 3 {
		t.Fatalf("run execution = %+v, want completed issue execution", run.Execution)
	}
	if observedPath != "/v1/sync/issue/execute" {
		t.Fatalf("observed path = %q, want %q", observedPath, "/v1/sync/issue/execute")
	}
	if observed.Repository != "octo/repo" || observed.Number != 3 || observed.Mode != "issue" {
		t.Fatalf("observed request = %+v, want repo octo/repo number 3", observed)
	}
	if run.Job == nil || run.Job.ID != enqueue.JobIDs[0] {
		t.Fatalf("run job = %+v, want executed job id %q", run.Job, enqueue.JobIDs[0])
	}
}

func TestRunNextExecutesCommitJobAndCompletes(t *testing.T) {
	now := time.Now().UTC().Add(55 * time.Second).Truncate(time.Second)
	var observed contracts.SyncRequest
	var observedPath string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observedPath = r.URL.Path
		if err := json.NewDecoder(r.Body).Decode(&observed); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		_ = json.NewEncoder(w).Encode(contracts.GitHubSyncExecutionResponse{
			Status:        "completed",
			Mode:          "commit",
			Repository:    observed.Repository,
			SHA:           observed.SHA,
			CorrelationID: r.Header.Get("X-Request-ID"),
			StartedAt:     now,
			FinishedAt:    now.Add(2 * time.Second),
			Fetched:       map[string]int{"commits": 1},
			Persisted:     map[string]int{"commits": 1},
		})
	}))
	defer server.Close()

	cfg := testServiceConfig()
	cfg.Services.GitHubIngestorBaseURL = server.URL
	cfg.Services.RequestTimeout = time.Second
	scheduler := New(cfg)

	enqueue, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "commit", Repository: "octo/repo", SHA: "abc123"}, "commit-correlation", now)
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}

	run, err := scheduler.RunNext(context.Background(), now)
	if err != nil {
		t.Fatalf("RunNext() error = %v", err)
	}
	if run.Status != "completed" {
		t.Fatalf("run status = %q, want completed", run.Status)
	}
	if run.Execution == nil || run.Execution.Mode != "commit" || run.Execution.SHA != "abc123" {
		t.Fatalf("run execution = %+v, want completed commit execution", run.Execution)
	}
	if observedPath != "/v1/sync/commit/execute" {
		t.Fatalf("observed path = %q, want %q", observedPath, "/v1/sync/commit/execute")
	}
	if observed.Repository != "octo/repo" || observed.SHA != "abc123" || observed.Mode != "commit" {
		t.Fatalf("observed request = %+v, want repo octo/repo sha abc123", observed)
	}
	if run.Job == nil || run.Job.ID != enqueue.JobIDs[0] {
		t.Fatalf("run job = %+v, want executed job id %q", run.Job, enqueue.JobIDs[0])
	}
}

func TestRunNextRetriesRepositoryJobOnUpstreamFailure(t *testing.T) {
	now := time.Now().UTC().Add(time.Minute).Truncate(time.Second)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(contracts.NewErrorResponse("upstream_failed", "temporary github outage", ""))
	}))
	defer server.Close()

	cfg := testServiceConfig()
	cfg.Services.GitHubIngestorBaseURL = server.URL
	cfg.Services.RequestTimeout = time.Second
	cfg.Scheduler.RetryBackoff = time.Second
	scheduler := New(cfg)

	enqueue, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "repository", Repository: "octo/repo"}, "retry-correlation", now)
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}

	run, err := scheduler.RunNext(context.Background(), now)
	if err != nil {
		t.Fatalf("RunNext() error = %v", err)
	}
	if run.Status != "failed" {
		t.Fatalf("run status = %q, want failed", run.Status)
	}
	if run.Job == nil || run.Job.AttemptCount != 1 {
		t.Fatalf("run job = %+v, want attempt_count=1", run.Job)
	}
	if run.Execution != nil {
		t.Fatalf("run execution = %+v, want nil on failure", run.Execution)
	}
	if run.Job.ID != enqueue.JobIDs[0] {
		t.Fatalf("run job id = %q, want %q", run.Job.ID, enqueue.JobIDs[0])
	}

	queue := scheduler.QueueStatus(now, contracts.SchedulerJobFilter{Repository: "octo/repo"})
	if queue.QueueDepth != 1 {
		t.Fatalf("queue depth = %d, want 1 after retry scheduling", queue.QueueDepth)
	}
	if len(queue.Jobs) != 1 || queue.Jobs[0].LastError == "" {
		t.Fatalf("queued jobs = %+v, want one job with last_error", queue.Jobs)
	}
}

func TestRunNextLeavesUnsupportedJobsQueued(t *testing.T) {
	now := time.Date(2026, time.May, 6, 14, 0, 0, 0, time.UTC)
	scheduler := New(testServiceConfig())

	if err := scheduler.queue.Enqueue(store.QueueJob{
		ID:            "repair-1",
		QueueName:     primaryQueueName,
		Type:          store.RepairWebhookJob,
		Status:        store.JobPending,
		CorrelationID: "repair-correlation",
		Subject:       "delivery-1",
		DedupeKey:     "repair:delivery-1",
		MaxAttempts:   1,
		ScheduledAt:   now,
		NotBefore:     now,
	}); err != nil {
		t.Fatalf("queue.Enqueue() error = %v", err)
	}

	run, err := scheduler.RunNext(context.Background(), now)
	if err != nil {
		t.Fatalf("RunNext() error = %v", err)
	}
	if run.Status != "idle" {
		t.Fatalf("run status = %q, want idle", run.Status)
	}
	if run.Job != nil {
		t.Fatalf("run job = %+v, want nil", run.Job)
	}

	queue := scheduler.QueueStatus(now, contracts.SchedulerJobFilter{Type: string(store.RepairWebhookJob)})
	if queue.QueueDepth != 1 || len(queue.Jobs) != 1 {
		t.Fatalf("queue = %+v, want one still-queued unsupported job", queue)
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
		Services: config.Services{
			RequestTimeout: time.Second,
		},
	}
}
