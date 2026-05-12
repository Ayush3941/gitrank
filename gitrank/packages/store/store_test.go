package store

import (
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
)

func TestNewWebhookDelivery(t *testing.T) {
	delivery, err := NewWebhookDelivery(WebhookDeliveryInput{
		DeliveryID: "delivery-1",
		EventType:  "pull_request",
		Payload:    []byte(`{"action":"opened"}`),
	})
	if err != nil {
		t.Fatalf("NewWebhookDelivery() error = %v", err)
	}
	if delivery.PayloadSHA256 == "" {
		t.Fatal("PayloadSHA256 = empty, want value")
	}
}

func TestInMemoryDeliveryStoreRemember(t *testing.T) {
	store := NewInMemoryDeliveryStore(0)
	delivery, err := NewWebhookDelivery(WebhookDeliveryInput{
		DeliveryID: "delivery-1",
		EventType:  "pull_request",
		Payload:    []byte(`{"action":"opened"}`),
	})
	if err != nil {
		t.Fatalf("NewWebhookDelivery() error = %v", err)
	}

	duplicate, err := store.Remember(delivery)
	if err != nil {
		t.Fatalf("Remember() error = %v", err)
	}
	if duplicate {
		t.Fatal("first Remember() marked duplicate")
	}

	duplicate, err = store.Remember(delivery)
	if err != nil {
		t.Fatalf("Remember() second error = %v", err)
	}
	if !duplicate {
		t.Fatal("second Remember() duplicate = false, want true")
	}

	loaded, found, err := store.Lookup("delivery-1")
	if err != nil {
		t.Fatalf("Lookup() error = %v", err)
	}
	if !found {
		t.Fatal("Lookup() found = false, want true")
	}
	if loaded.DeliveryID != "delivery-1" {
		t.Fatalf("delivery id = %q, want %q", loaded.DeliveryID, "delivery-1")
	}
}

func TestNewQueueJob(t *testing.T) {
	job, err := NewQueueJob(QueueJobInput{
		QueueName:   "github-sync",
		Type:        SyncRepositoryJob,
		MaxAttempts: 5,
		Payload: map[string]string{
			"repository": "octo/repo",
		},
	})
	if err != nil {
		t.Fatalf("NewQueueJob() error = %v", err)
	}
	if job.Status != JobPending {
		t.Fatalf("Status = %q, want pending", job.Status)
	}
	if len(job.ID) != 36 || job.ID[8] != '-' || job.ID[13] != '-' || job.ID[18] != '-' || job.ID[23] != '-' {
		t.Fatalf("job id = %q, want UUID-like identifier", job.ID)
	}
}

func TestBuildSyncJobsRepository(t *testing.T) {
	jobs, err := BuildSyncJobs(contracts.SyncRequest{
		Mode:       "repository",
		Repository: "octo/repo",
	}, "github-sync", "req-1", 5)
	if err != nil {
		t.Fatalf("BuildSyncJobs() error = %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("jobs len = %d, want 1", len(jobs))
	}
	if jobs[0].DedupeKey != "repository:octo/repo" {
		t.Fatalf("dedupe key = %q, want %q", jobs[0].DedupeKey, "repository:octo/repo")
	}
}

func TestBuildSyncJobsScoreReplayUser(t *testing.T) {
	const userID = "8f0c38c9-671f-499d-a1b7-1f9f4f57cbb4"
	jobs, err := BuildSyncJobs(contracts.SyncRequest{
		Mode:   "score_replay",
		UserID: userID,
	}, "github-sync", "score-correlation", 5)
	if err != nil {
		t.Fatalf("BuildSyncJobs() error = %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("jobs len = %d, want 1", len(jobs))
	}
	if jobs[0].Type != ScoreReplayUserJob {
		t.Fatalf("job type = %q, want %q", jobs[0].Type, ScoreReplayUserJob)
	}
	if jobs[0].Subject != userID {
		t.Fatalf("subject = %q, want %q", jobs[0].Subject, userID)
	}
	if jobs[0].DedupeKey != "score_replay:"+userID {
		t.Fatalf("dedupe key = %q, want score_replay:%s", jobs[0].DedupeKey, userID)
	}
}

func TestBuildSyncJobsProfileRefreshUser(t *testing.T) {
	const userID = "8f0c38c9-671f-499d-a1b7-1f9f4f57cbb4"
	jobs, err := BuildSyncJobs(contracts.SyncRequest{
		Mode:   "profile_refresh",
		UserID: userID,
	}, "github-sync", "profile-correlation", 5)
	if err != nil {
		t.Fatalf("BuildSyncJobs() error = %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("jobs len = %d, want 1", len(jobs))
	}
	if jobs[0].Type != ProfileRefreshUserJob {
		t.Fatalf("job type = %q, want %q", jobs[0].Type, ProfileRefreshUserJob)
	}
	if jobs[0].Subject != userID {
		t.Fatalf("subject = %q, want %q", jobs[0].Subject, userID)
	}
	if jobs[0].DedupeKey != "profile_refresh:"+userID {
		t.Fatalf("dedupe key = %q, want profile_refresh:%s", jobs[0].DedupeKey, userID)
	}
}

func TestBuildSyncJobsGradePullRequest(t *testing.T) {
	const userID = "8f0c38c9-671f-499d-a1b7-1f9f4f57cbb4"
	jobs, err := BuildSyncJobs(contracts.SyncRequest{
		Mode:       "grade_pull_request",
		UserID:     userID,
		Repository: "octo/repo",
		Number:     17,
	}, "github-sync", "grade-correlation", 5)
	if err != nil {
		t.Fatalf("BuildSyncJobs() error = %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("jobs len = %d, want 1", len(jobs))
	}
	if jobs[0].Type != GradePullRequestJob {
		t.Fatalf("job type = %q, want %q", jobs[0].Type, GradePullRequestJob)
	}
	if jobs[0].Subject != "octo/repo#17" {
		t.Fatalf("subject = %q, want octo/repo#17", jobs[0].Subject)
	}
	if jobs[0].DedupeKey != "grade_pull_request:"+userID+":octo/repo#17" {
		t.Fatalf("dedupe key = %q, want grade_pull_request:%s:octo/repo#17", jobs[0].DedupeKey, userID)
	}
}

func TestBuildSyncJobsAnalysisPullRequest(t *testing.T) {
	jobs, err := BuildSyncJobs(contracts.SyncRequest{
		Mode:       "analysis_pull_request",
		Repository: "octo/repo",
		Number:     17,
	}, "github-sync", "analysis-correlation", 5)
	if err != nil {
		t.Fatalf("BuildSyncJobs() error = %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("jobs len = %d, want 1", len(jobs))
	}
	if jobs[0].Type != AnalysisPullRequestJob {
		t.Fatalf("job type = %q, want %q", jobs[0].Type, AnalysisPullRequestJob)
	}
	if jobs[0].Subject != "octo/repo#17" {
		t.Fatalf("subject = %q, want octo/repo#17", jobs[0].Subject)
	}
	if jobs[0].DedupeKey != "analysis_pull_request:octo/repo#17" {
		t.Fatalf("dedupe key = %q, want analysis_pull_request:octo/repo#17", jobs[0].DedupeKey)
	}
}

func TestBuildSyncJobsReportMaterializePullRequest(t *testing.T) {
	jobs, err := BuildSyncJobs(contracts.SyncRequest{
		Mode:       "report_materialize_pull_request",
		Repository: "octo/repo",
		Number:     17,
	}, "github-sync", "report-correlation", 5)
	if err != nil {
		t.Fatalf("BuildSyncJobs() error = %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("jobs len = %d, want 1", len(jobs))
	}
	if jobs[0].Type != ReportMaterializePRJob {
		t.Fatalf("job type = %q, want %q", jobs[0].Type, ReportMaterializePRJob)
	}
	if jobs[0].Subject != "octo/repo#17" {
		t.Fatalf("subject = %q, want octo/repo#17", jobs[0].Subject)
	}
	if jobs[0].DedupeKey != "report_materialize_pull_request:octo/repo#17" {
		t.Fatalf("dedupe key = %q, want report_materialize_pull_request:octo/repo#17", jobs[0].DedupeKey)
	}
}

func TestBuildSyncJobsReportBackfillUserPullRequests(t *testing.T) {
	const userID = "8f0c38c9-671f-499d-a1b7-1f9f4f57cbb4"
	jobs, err := BuildSyncJobs(contracts.SyncRequest{
		Mode:   "report_backfill_user_pull_requests",
		UserID: userID,
	}, "github-sync", "report-backfill-correlation", 5)
	if err != nil {
		t.Fatalf("BuildSyncJobs() error = %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("jobs len = %d, want 1", len(jobs))
	}
	if jobs[0].Type != ReportBackfillUserPRsJob {
		t.Fatalf("job type = %q, want %q", jobs[0].Type, ReportBackfillUserPRsJob)
	}
	if jobs[0].Subject != userID {
		t.Fatalf("subject = %q, want %q", jobs[0].Subject, userID)
	}
	if jobs[0].DedupeKey != "report_backfill_user_pull_requests:"+userID {
		t.Fatalf("dedupe key = %q, want report_backfill_user_pull_requests:%s", jobs[0].DedupeKey, userID)
	}
}

func TestBuildSyncJobsLeaderboardMaterializeSeason(t *testing.T) {
	jobs, err := BuildSyncJobs(contracts.SyncRequest{
		Mode: "leaderboard_materialize_season",
	}, "github-sync", "leaderboard-correlation", 5)
	if err != nil {
		t.Fatalf("BuildSyncJobs() error = %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("jobs len = %d, want 1", len(jobs))
	}
	if jobs[0].Type != LeaderboardMaterializeJob {
		t.Fatalf("job type = %q, want %q", jobs[0].Type, LeaderboardMaterializeJob)
	}
	if jobs[0].Subject != "current" {
		t.Fatalf("subject = %q, want current", jobs[0].Subject)
	}
	if jobs[0].DedupeKey != "leaderboard_materialize_season:current" {
		t.Fatalf("dedupe key = %q, want leaderboard_materialize_season:current", jobs[0].DedupeKey)
	}
}

func TestBuildSyncJobsPullRequestAndAnalysisHaveDistinctDedupeKeys(t *testing.T) {
	syncJobs, err := BuildSyncJobs(contracts.SyncRequest{
		Mode:       "pull_request",
		Repository: "octo/repo",
		Number:     17,
	}, "github-sync", "sync-correlation", 5)
	if err != nil {
		t.Fatalf("BuildSyncJobs(sync) error = %v", err)
	}

	analysisJobs, err := BuildSyncJobs(contracts.SyncRequest{
		Mode:       "analysis_pull_request",
		Repository: "octo/repo",
		Number:     17,
	}, "github-sync", "analysis-correlation", 5)
	if err != nil {
		t.Fatalf("BuildSyncJobs(analysis) error = %v", err)
	}

	if syncJobs[0].DedupeKey == analysisJobs[0].DedupeKey {
		t.Fatalf("dedupe keys should differ, both got %q", syncJobs[0].DedupeKey)
	}
	if syncJobs[0].DedupeKey != "pull_request:octo/repo#17" {
		t.Fatalf("sync dedupe key = %q, want pull_request:octo/repo#17", syncJobs[0].DedupeKey)
	}
	if analysisJobs[0].DedupeKey != "analysis_pull_request:octo/repo#17" {
		t.Fatalf("analysis dedupe key = %q, want analysis_pull_request:octo/repo#17", analysisJobs[0].DedupeKey)
	}
}

func TestBuildSyncJobsRejectsUnsafeRepository(t *testing.T) {
	_, err := BuildSyncJobs(contracts.SyncRequest{
		Mode:       "repository",
		Repository: "https://github.com/octo/repo",
	}, "github-sync", "req-1", 5)
	if err == nil {
		t.Fatal("BuildSyncJobs() error = nil, want unsafe repository rejection")
	}
}

func TestInMemoryJobQueueFailRetriesThenDeadLetters(t *testing.T) {
	queue := NewInMemoryJobQueue()
	job, err := NewQueueJob(QueueJobInput{
		QueueName:   "github-sync",
		Type:        SyncRepositoryJob,
		Repository:  "octo/repo",
		DedupeKey:   "repository:octo/repo",
		MaxAttempts: 2,
		Payload: map[string]string{
			"repository": "octo/repo",
		},
	})
	if err != nil {
		t.Fatalf("NewQueueJob() error = %v", err)
	}
	if _, _, err := queue.EnqueueUnique(job); err != nil {
		t.Fatalf("EnqueueUnique() error = %v", err)
	}

	now := time.Date(2026, 5, 5, 12, 0, 0, 0, time.UTC)
	retried, deadLetter, err := queue.Fail(job.ID, errBoom, now, time.Second)
	if err != nil {
		t.Fatalf("Fail() retry error = %v", err)
	}
	if deadLetter != nil {
		t.Fatalf("deadLetter = %+v, want nil on first failure", deadLetter)
	}
	if retried.Status != JobPending {
		t.Fatalf("status = %q, want %q", retried.Status, JobPending)
	}
	if retried.AttemptCount != 1 {
		t.Fatalf("attempt count = %d, want 1", retried.AttemptCount)
	}
	if got := retried.NotBefore.Sub(now); got != time.Second {
		t.Fatalf("retry backoff = %s, want 1s", got)
	}

	deadLettered, record, err := queue.Fail(job.ID, errBoom, now.Add(time.Second), time.Second)
	if err != nil {
		t.Fatalf("Fail() dead-letter error = %v", err)
	}
	if record == nil {
		t.Fatal("dead-letter record = nil, want value")
	}
	if deadLettered.Status != JobDeadLetter {
		t.Fatalf("status = %q, want %q", deadLettered.Status, JobDeadLetter)
	}
}

func TestInMemoryJobQueueLeasePauseResumeAndReplay(t *testing.T) {
	queue := NewInMemoryJobQueue()
	job, err := NewQueueJob(QueueJobInput{
		QueueName:   "github-sync",
		Type:        SyncUserHistoryJob,
		Subject:     "octocat",
		DedupeKey:   "user:octocat",
		MaxAttempts: 1,
		ScheduledAt: time.Date(2026, 5, 5, 12, 0, 0, 0, time.UTC),
		NotBefore:   time.Date(2026, 5, 5, 12, 0, 0, 0, time.UTC),
		Payload: map[string]string{
			"user": "octocat",
			"mode": "user",
		},
	})
	if err != nil {
		t.Fatalf("NewQueueJob() error = %v", err)
	}
	enqueued, _, err := queue.EnqueueUnique(job)
	if err != nil {
		t.Fatalf("EnqueueUnique() error = %v", err)
	}

	now := time.Date(2026, 5, 5, 12, 0, 0, 0, time.UTC)
	leased := queue.LeaseReady(now, 1, 1, time.Minute)
	if len(leased) != 1 {
		t.Fatalf("leased len = %d, want 1", len(leased))
	}
	if leased[0].Status != JobLeased {
		t.Fatalf("leased status = %q, want %q", leased[0].Status, JobLeased)
	}

	paused, err := queue.Pause(enqueued.ID)
	if err != nil {
		t.Fatalf("Pause() error = %v", err)
	}
	if paused.Status != JobPaused {
		t.Fatalf("paused status = %q, want %q", paused.Status, JobPaused)
	}

	resumed, err := queue.Resume(enqueued.ID, now.Add(time.Second))
	if err != nil {
		t.Fatalf("Resume() error = %v", err)
	}
	if resumed.Status != JobPending {
		t.Fatalf("resumed status = %q, want %q", resumed.Status, JobPending)
	}

	deadLettered, record, err := queue.Fail(enqueued.ID, errBoom, now.Add(2*time.Second), time.Second)
	if err != nil {
		t.Fatalf("Fail() error = %v", err)
	}
	if record == nil || deadLettered.Status != JobDeadLetter {
		t.Fatalf("expected dead-lettered job, got status=%q record=%+v", deadLettered.Status, record)
	}

	replayed, duplicate, err := queue.ReplayDeadLetter(record.ID, "req-replay", now.Add(3*time.Second))
	if err != nil {
		t.Fatalf("ReplayDeadLetter() error = %v", err)
	}
	if duplicate {
		t.Fatal("ReplayDeadLetter() duplicate = true, want false")
	}
	if replayed.ID == enqueued.ID {
		t.Fatalf("replayed job id = %q, want new id", replayed.ID)
	}
	if replayed.CorrelationID != "req-replay" {
		t.Fatalf("correlation id = %q, want %q", replayed.CorrelationID, "req-replay")
	}
}

func TestInMemoryJobQueueCancelByCorrelationCancelsOnlyActiveJobs(t *testing.T) {
	queue := NewInMemoryJobQueue()
	now := time.Date(2026, 5, 5, 12, 0, 0, 0, time.UTC)

	queuedJob, err := NewQueueJob(QueueJobInput{
		QueueName:     "github-sync",
		Type:          SyncRepositoryJob,
		CorrelationID: "backfill:plan:run-1",
		Repository:    "octo/repo",
		DedupeKey:     "repository:octo/repo",
		MaxAttempts:   2,
		ScheduledAt:   now,
		NotBefore:     now,
		Payload: map[string]string{
			"repository": "octo/repo",
			"mode":       "repository",
		},
	})
	if err != nil {
		t.Fatalf("NewQueueJob() queued error = %v", err)
	}
	if _, _, err := queue.EnqueueUnique(queuedJob); err != nil {
		t.Fatalf("EnqueueUnique() queued error = %v", err)
	}

	leasedJob, err := NewQueueJob(QueueJobInput{
		QueueName:     "github-sync",
		Type:          SyncUserHistoryJob,
		CorrelationID: "backfill:plan:run-1",
		Subject:       "octocat",
		DedupeKey:     "user:octocat",
		MaxAttempts:   2,
		ScheduledAt:   now,
		NotBefore:     now,
		Payload: map[string]string{
			"user": "octocat",
			"mode": "user",
		},
	})
	if err != nil {
		t.Fatalf("NewQueueJob() leased error = %v", err)
	}
	if _, _, err := queue.EnqueueUnique(leasedJob); err != nil {
		t.Fatalf("EnqueueUnique() leased error = %v", err)
	}
	if _, err := queue.LeaseJob(leasedJob.ID, now, 2, time.Minute); err != nil {
		t.Fatalf("LeaseJob() error = %v", err)
	}

	otherJob, err := NewQueueJob(QueueJobInput{
		QueueName:     "github-sync",
		Type:          SyncIssueJob,
		CorrelationID: "backfill:plan:run-2",
		Repository:    "octo/repo",
		Subject:       "#12",
		DedupeKey:     "issue:octo/repo:12",
		MaxAttempts:   2,
		ScheduledAt:   now,
		NotBefore:     now,
		Payload: map[string]any{
			"repository": "octo/repo",
			"number":     12,
			"mode":       "issue",
		},
	})
	if err != nil {
		t.Fatalf("NewQueueJob() other error = %v", err)
	}
	if _, _, err := queue.EnqueueUnique(otherJob); err != nil {
		t.Fatalf("EnqueueUnique() other error = %v", err)
	}

	canceled := queue.CancelByCorrelation(" backfill:plan:run-1 ")
	if len(canceled) != 2 {
		t.Fatalf("canceled len = %d, want 2", len(canceled))
	}
	for _, job := range canceled {
		if job.Status != JobCanceled {
			t.Fatalf("canceled job status = %q, want %q", job.Status, JobCanceled)
		}
	}

	loadedQueued, ok := queue.Job(queuedJob.ID)
	if !ok {
		t.Fatal("queued job missing after cancellation")
	}
	if loadedQueued.Status != JobCanceled {
		t.Fatalf("queued job status = %q, want %q", loadedQueued.Status, JobCanceled)
	}

	loadedLeased, ok := queue.Job(leasedJob.ID)
	if !ok {
		t.Fatal("leased job missing after cancellation")
	}
	if loadedLeased.Status != JobCanceled {
		t.Fatalf("leased job status = %q, want %q", loadedLeased.Status, JobCanceled)
	}
	if !loadedLeased.LeaseExpiresAt.IsZero() {
		t.Fatalf("leased job lease expiry = %v, want zero", loadedLeased.LeaseExpiresAt)
	}

	loadedOther, ok := queue.Job(otherJob.ID)
	if !ok {
		t.Fatal("other job missing after cancellation")
	}
	if loadedOther.Status != JobPending {
		t.Fatalf("other job status = %q, want %q", loadedOther.Status, JobPending)
	}
}

func TestInMemoryJobQueueLeaseJobTargetsReadyJob(t *testing.T) {
	queue := NewInMemoryJobQueue()
	readyAt := time.Date(2026, 5, 5, 12, 0, 0, 0, time.UTC)

	job, err := NewQueueJob(QueueJobInput{
		QueueName:   "github-sync",
		Type:        SyncRepositoryJob,
		Repository:  "octo/repo",
		DedupeKey:   "repository:octo/repo",
		MaxAttempts: 2,
		ScheduledAt: readyAt,
		NotBefore:   readyAt,
		Payload: map[string]string{
			"repository": "octo/repo",
			"mode":       "repository",
		},
	})
	if err != nil {
		t.Fatalf("NewQueueJob() error = %v", err)
	}
	if _, _, err := queue.EnqueueUnique(job); err != nil {
		t.Fatalf("EnqueueUnique() error = %v", err)
	}

	leased, err := queue.LeaseJob(job.ID, readyAt, 1, time.Minute)
	if err != nil {
		t.Fatalf("LeaseJob() error = %v", err)
	}
	if leased.Status != JobLeased {
		t.Fatalf("leased status = %q, want %q", leased.Status, JobLeased)
	}

	if _, err := queue.LeaseJob(job.ID, readyAt, 1, time.Minute); err == nil {
		t.Fatal("second LeaseJob() error = nil, want not ready error")
	}
}

var errBoom = boomError("boom")

type boomError string

func (e boomError) Error() string {
	return string(e)
}
