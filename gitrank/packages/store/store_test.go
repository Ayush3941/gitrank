package store

import (
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
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

var errBoom = boomError("boom")

type boomError string

func (e boomError) Error() string {
	return string(e)
}
