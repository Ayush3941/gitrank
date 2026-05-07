package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5/pgxpool"
)

func clearSchedulerPersistentState(t *testing.T, ctx context.Context, pool *pgxpool.Pool, serviceName string) {
	t.Helper()

	for _, statement := range []string{
		`DELETE FROM scheduler_tick_scope_totals WHERE service_name = $1`,
		`DELETE FROM scheduler_rate_limit_windows WHERE service_name = $1`,
		`DELETE FROM scheduler_backfill_plans WHERE service_name = $1`,
		`DELETE FROM scheduler_dead_letters WHERE service_name = $1`,
		`DELETE FROM scheduler_jobs WHERE service_name = $1`,
		`DELETE FROM scheduler_runtime_counters WHERE service_name = $1`,
		`DELETE FROM scheduler_runtime_states WHERE service_name = $1`,
	} {
		if _, err := pool.Exec(ctx, statement, serviceName); err != nil {
			t.Fatalf("clear persistent scheduler state %q: %v", statement, err)
		}
	}
}

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
	clearSchedulerPersistentState(t, ctx, pool, serviceName)

	cfg := testServiceConfig()
	cfg.ServiceName = serviceName
	cfg.Scheduler.MaxAttempts = 1
	now := time.Now().UTC().Add(2 * time.Second).Truncate(time.Second)

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

	var (
		planRows       int
		deadLetterRows int
		counterRows    int
	)
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM scheduler_backfill_plans WHERE service_name = $1`, serviceName).Scan(&planRows); err != nil {
		t.Fatalf("count scheduler_backfill_plans: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM scheduler_dead_letters WHERE service_name = $1`, serviceName).Scan(&deadLetterRows); err != nil {
		t.Fatalf("count scheduler_dead_letters: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM scheduler_runtime_counters WHERE service_name = $1`, serviceName).Scan(&counterRows); err != nil {
		t.Fatalf("count scheduler_runtime_counters: %v", err)
	}
	if planRows != 1 {
		t.Fatalf("scheduler_backfill_plans rows = %d, want 1", planRows)
	}
	if deadLetterRows != 1 {
		t.Fatalf("scheduler_dead_letters rows = %d, want 1", deadLetterRows)
	}
	if counterRows != 1 {
		t.Fatalf("scheduler_runtime_counters rows = %d, want 1", counterRows)
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

func TestPersistentSchedulerMigratesLegacySnapshotToNormalizedTables(t *testing.T) {
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

	serviceName := fmt.Sprintf("scheduler-worker-legacy-%d", time.Now().UnixNano())
	clearSchedulerPersistentState(t, ctx, pool, serviceName)

	cfg := testServiceConfig()
	cfg.ServiceName = serviceName
	now := time.Now().UTC().Add(2 * time.Second).Truncate(time.Second)

	legacyScheduler := New(cfg)
	plan, err := legacyScheduler.CreateBackfillPlan(contracts.SchedulerBackfillPlanRequest{
		Name: "legacy-backfill",
		Targets: []contracts.SyncRequest{
			{Mode: "repository", Repository: "octo/repo"},
		},
	}, now)
	if err != nil {
		t.Fatalf("CreateBackfillPlan() legacy error = %v", err)
	}
	enqueue, err := legacyScheduler.EnqueueSync(contracts.SyncRequest{Mode: "repository", Repository: "octo/repo"}, "legacy-correlation", now)
	if err != nil {
		t.Fatalf("EnqueueSync() legacy error = %v", err)
	}
	if len(enqueue.JobIDs) != 1 {
		t.Fatalf("legacy job ids len = %d, want 1", len(enqueue.JobIDs))
	}

	payload, err := json.Marshal(legacyScheduler.captureDurableState())
	if err != nil {
		t.Fatalf("json.Marshal() legacy state error = %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO scheduler_runtime_states (
			service_name,
			state_key,
			state_jsonb,
			created_at,
			updated_at
		) VALUES ($1, $2, $3::jsonb, $4, $4)
	`, serviceName, schedulerStateKey, string(payload), now); err != nil {
		t.Fatalf("insert legacy scheduler_runtime_states: %v", err)
	}

	restored, err := NewPersistent(cfg, pool)
	if err != nil {
		t.Fatalf("NewPersistent() migrate error = %v", err)
	}

	plans := restored.BackfillPlans(now)
	if len(plans.Plans) != 1 || plans.Plans[0].ID != plan.ID {
		t.Fatalf("restored plans = %+v, want migrated plan %q", plans.Plans, plan.ID)
	}
	queue := restored.QueueStatus(now, contracts.SchedulerJobFilter{Repository: "octo/repo"})
	if queue.QueueDepth != 1 || len(queue.Jobs) != 1 || queue.Jobs[0].ID != enqueue.JobIDs[0] {
		t.Fatalf("restored queue = %+v, want migrated queued job %q", queue, enqueue.JobIDs[0])
	}

	var (
		jobRows    int
		planRows   int
		legacyRows int
	)
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM scheduler_jobs WHERE service_name = $1`, serviceName).Scan(&jobRows); err != nil {
		t.Fatalf("count scheduler_jobs: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM scheduler_backfill_plans WHERE service_name = $1`, serviceName).Scan(&planRows); err != nil {
		t.Fatalf("count scheduler_backfill_plans: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM scheduler_runtime_states WHERE service_name = $1`, serviceName).Scan(&legacyRows); err != nil {
		t.Fatalf("count scheduler_runtime_states: %v", err)
	}
	if jobRows != 1 {
		t.Fatalf("scheduler_jobs rows = %d, want 1", jobRows)
	}
	if planRows != 1 {
		t.Fatalf("scheduler_backfill_plans rows = %d, want 1", planRows)
	}
	if legacyRows != 0 {
		t.Fatalf("scheduler_runtime_states rows = %d, want 0 after migration", legacyRows)
	}
}

func TestPersistentSchedulerSharesLeasesAcrossInstances(t *testing.T) {
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

	serviceName := fmt.Sprintf("scheduler-worker-shared-%d", time.Now().UnixNano())
	clearSchedulerPersistentState(t, ctx, pool, serviceName)

	cfg := testServiceConfig()
	cfg.ServiceName = serviceName
	cfg.Scheduler.WorkerConcurrency = 1
	now := time.Now().UTC().Add(2 * time.Second).Truncate(time.Second)

	first, err := NewPersistent(cfg, pool)
	if err != nil {
		t.Fatalf("NewPersistent() first error = %v", err)
	}
	second, err := NewPersistent(cfg, pool)
	if err != nil {
		t.Fatalf("NewPersistent() second error = %v", err)
	}

	enqueue, err := first.EnqueueSync(contracts.SyncRequest{Mode: "repository", Repository: "octo/repo"}, "shared-correlation", now)
	if err != nil {
		t.Fatalf("EnqueueSync() error = %v", err)
	}
	if len(enqueue.JobIDs) != 1 {
		t.Fatalf("job ids len = %d, want 1", len(enqueue.JobIDs))
	}

	queue := second.QueueStatus(now, contracts.SchedulerJobFilter{Repository: "octo/repo"})
	if queue.QueueDepth != 1 || len(queue.Jobs) != 1 {
		t.Fatalf("queue = %+v, want one shared queued job", queue)
	}
	if queue.Jobs[0].ID != enqueue.JobIDs[0] {
		t.Fatalf("shared queue job id = %q, want %q", queue.Jobs[0].ID, enqueue.JobIDs[0])
	}

	firstLease, err := first.Lease(1, now.Add(time.Second))
	if err != nil {
		t.Fatalf("Lease() first error = %v", err)
	}
	if len(firstLease.Jobs) != 1 || firstLease.Jobs[0].ID != enqueue.JobIDs[0] {
		t.Fatalf("first lease = %+v, want job %q", firstLease, enqueue.JobIDs[0])
	}

	secondLease, err := second.Lease(1, now.Add(time.Second))
	if err != nil {
		t.Fatalf("Lease() second error = %v", err)
	}
	if len(secondLease.Jobs) != 0 {
		t.Fatalf("second lease jobs = %d, want 0 after shared lease coordination", len(secondLease.Jobs))
	}
}

func TestPersistentSchedulerSerializesDuePlanTicksAcrossInstances(t *testing.T) {
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

	serviceName := fmt.Sprintf("scheduler-worker-tick-%d", time.Now().UnixNano())
	clearSchedulerPersistentState(t, ctx, pool, serviceName)

	cfg := testServiceConfig()
	cfg.ServiceName = serviceName
	now := time.Now().UTC().Add(2 * time.Second).Truncate(time.Second)

	first, err := NewPersistent(cfg, pool)
	if err != nil {
		t.Fatalf("NewPersistent() first error = %v", err)
	}
	second, err := NewPersistent(cfg, pool)
	if err != nil {
		t.Fatalf("NewPersistent() second error = %v", err)
	}

	plan, err := first.CreateBackfillPlan(contracts.SchedulerBackfillPlanRequest{
		Name: "shared-tick",
		Cron: "* * * * *",
		Targets: []contracts.SyncRequest{
			{Mode: "repository", Repository: "octo/repo"},
		},
	}, now)
	if err != nil {
		t.Fatalf("CreateBackfillPlan() error = %v", err)
	}

	visible := second.BackfillPlans(now)
	if len(visible.Plans) != 1 || visible.Plans[0].ID != plan.ID {
		t.Fatalf("shared plans = %+v, want plan %q", visible.Plans, plan.ID)
	}

	firstTick, err := first.Tick(plan.NextRunAt)
	if err != nil {
		t.Fatalf("Tick() first error = %v", err)
	}
	if firstTick.DuePlans != 1 || firstTick.QueuedJobs != 1 {
		t.Fatalf("first tick = %+v, want one due plan and one queued job", firstTick)
	}

	secondTick, err := second.Tick(plan.NextRunAt)
	if err != nil {
		t.Fatalf("Tick() second error = %v", err)
	}
	if secondTick.DuePlans != 0 || secondTick.QueuedJobs != 0 {
		t.Fatalf("second tick = %+v, want no duplicate due-plan execution", secondTick)
	}

	queue := second.QueueStatus(plan.NextRunAt, contracts.SchedulerJobFilter{Repository: "octo/repo"})
	if queue.QueueDepth != 1 || len(queue.Jobs) != 1 {
		t.Fatalf("queue = %+v, want one queued job after serialized tick", queue)
	}
}
