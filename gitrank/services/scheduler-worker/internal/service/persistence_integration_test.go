package service

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPersistentSchedulerRestoresQueueAndBackfillState(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_SCHEDULER_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_SCHEDULER_DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	serviceName := fmt.Sprintf("scheduler-worker-persist-%d", time.Now().UnixNano())
	if _, err := pool.Exec(ctx, `DELETE FROM scheduler_runtime_states WHERE service_name = $1`, serviceName); err != nil {
		t.Fatalf("delete scheduler_runtime_states: %v", err)
	}

	cfg := testServiceConfig()
	cfg.ServiceName = serviceName
	cfg.Scheduler.MaxAttempts = 1
	now := time.Date(2026, time.May, 6, 16, 0, 0, 0, time.UTC)

	scheduler, err := NewPersistent(cfg, pool)
	if err != nil {
		t.Fatalf("NewPersistent() error = %v", err)
	}

	plan, err := scheduler.CreateBackfillPlan(contracts.SchedulerBackfillPlanRequest{
		Name: "durable-backfill",
		Targets: []contracts.SyncRequest{
			{Mode: "repository", Repository: "octo/repo"},
		},
	}, now)
	if err != nil {
		t.Fatalf("CreateBackfillPlan() error = %v", err)
	}

	enqueue, err := scheduler.EnqueueSync(contracts.SyncRequest{Mode: "repository", Repository: "octo/repo"}, "persist-correlation", now)
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}
	if len(enqueue.JobIDs) != 1 {
		t.Fatalf("job ids len = %d, want 1", len(enqueue.JobIDs))
	}

	failed, err := scheduler.Fail(enqueue.JobIDs[0], "forced failure", now.Add(time.Second))
	if err != nil {
		t.Fatalf("Fail() error = %v", err)
	}
	if failed.Status != "dead_lettered" {
		t.Fatalf("fail status = %q, want dead_lettered", failed.Status)
	}

	restored, err := NewPersistent(cfg, pool)
	if err != nil {
		t.Fatalf("NewPersistent() restore error = %v", err)
	}

	plans := restored.BackfillPlans(now.Add(2 * time.Second))
	if len(plans.Plans) != 1 {
		t.Fatalf("restored plan count = %d, want 1", len(plans.Plans))
	}
	if plans.Plans[0].ID != plan.ID {
		t.Fatalf("restored plan id = %q, want %q", plans.Plans[0].ID, plan.ID)
	}

	queue := restored.QueueStatus(now.Add(2*time.Second), contracts.SchedulerJobFilter{})
	if queue.QueueDepth != 0 {
		t.Fatalf("restored queue depth = %d, want 0", queue.QueueDepth)
	}
	if queue.DeadLetters != 1 {
		t.Fatalf("restored dead letters = %d, want 1", queue.DeadLetters)
	}

	deadLetters := restored.DeadLetters(now.Add(2 * time.Second))
	if len(deadLetters.Records) != 1 {
		t.Fatalf("restored dead letter records = %d, want 1", len(deadLetters.Records))
	}
	if deadLetters.Records[0].JobID != enqueue.JobIDs[0] {
		t.Fatalf("restored dead letter job id = %q, want %q", deadLetters.Records[0].JobID, enqueue.JobIDs[0])
	}
}
