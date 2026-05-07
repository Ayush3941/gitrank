package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
)

const schedulerStateKey = "primary"

type schedulerStateStore struct {
	pool       *pgxpool.Pool
	serviceKey string
}

type schedulerStateQueryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

type durableSchedulerState struct {
	Queue               store.JobQueueState
	Plans               []persistedPlanRecord
	Ticks               tickCountersState
	UserLimiter         scopeRateLimiterState
	InstallationLimiter scopeRateLimiterState
}

type persistedPlanRecord struct {
	ID                string
	Name              string
	Cron              string
	Enabled           bool
	Targets           []contracts.SyncRequest
	LastRunAt         *time.Time
	NextRunAt         time.Time
	QueuedJobsTotal   int
	DeduplicatedTotal int
	RateLimitedTotal  int
	CreatedAt         time.Time
	UpdatedAt         time.Time
	LastCorrelationID string
}

func newSchedulerStateStore(pool *pgxpool.Pool, serviceName string) *schedulerStateStore {
	if pool == nil {
		return nil
	}
	return &schedulerStateStore{
		pool:       pool,
		serviceKey: strings.TrimSpace(serviceName),
	}
}

func (s *schedulerStateStore) Ready(ctx context.Context) error {
	if s == nil || s.pool == nil {
		return nil
	}
	return s.pool.Ping(ctx)
}

func (s *schedulerStateStore) Load(ctx context.Context) (durableSchedulerState, bool, error) {
	if s == nil || s.pool == nil {
		return durableSchedulerState{}, false, nil
	}

	normalizedExists, err := s.normalizedStateExists(ctx, s.pool)
	if err != nil {
		return durableSchedulerState{}, false, err
	}
	if normalizedExists {
		state, err := s.loadNormalizedState(ctx, s.pool)
		return state, true, err
	}

	legacy, found, err := s.loadLegacyState(ctx, s.pool)
	if err != nil || !found {
		return legacy, found, err
	}
	if err := s.Save(ctx, legacy, time.Now().UTC()); err != nil {
		return durableSchedulerState{}, false, err
	}
	return legacy, true, nil
}

func (s *schedulerStateStore) Save(ctx context.Context, state durableSchedulerState, now time.Time) error {
	if s == nil || s.pool == nil {
		return nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := s.saveStateTx(ctx, tx, state, now.UTC()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *schedulerStateStore) Mutate(ctx context.Context, now time.Time, fn func(durableSchedulerState) (durableSchedulerState, error)) error {
	if s == nil || s.pool == nil {
		_, err := fn(durableSchedulerState{})
		return err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	normalizedExists, err := s.normalizedStateExists(ctx, tx)
	if err != nil {
		return err
	}
	if err := s.ensureRuntimeCountersRowTx(ctx, tx, now.UTC()); err != nil {
		return err
	}
	if err := s.lockRuntimeCountersRowTx(ctx, tx); err != nil {
		return err
	}

	state, err := s.loadNormalizedState(ctx, tx)
	if err != nil {
		return err
	}
	if !normalizedExists && !hasMeaningfulDurableState(state) {
		legacy, found, err := s.loadLegacyState(ctx, tx)
		if err != nil {
			return err
		}
		if found {
			state = legacy
		}
	}

	next, err := fn(state)
	if err != nil {
		return err
	}
	if err := s.saveStateTx(ctx, tx, next, now.UTC()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *schedulerStateStore) normalizedStateExists(ctx context.Context, q schedulerStateQueryer) (bool, error) {
	var exists bool
	err := q.QueryRow(ctx, `
		SELECT
			EXISTS (SELECT 1 FROM scheduler_runtime_counters WHERE service_name = $1) OR
			EXISTS (SELECT 1 FROM scheduler_jobs WHERE service_name = $1) OR
			EXISTS (SELECT 1 FROM scheduler_dead_letters WHERE service_name = $1) OR
			EXISTS (SELECT 1 FROM scheduler_backfill_plans WHERE service_name = $1) OR
			EXISTS (SELECT 1 FROM scheduler_rate_limit_windows WHERE service_name = $1) OR
			EXISTS (SELECT 1 FROM scheduler_tick_scope_totals WHERE service_name = $1)
	`, s.serviceKey).Scan(&exists)
	return exists, err
}

func (s *schedulerStateStore) ensureRuntimeCountersRowTx(ctx context.Context, tx pgx.Tx, now time.Time) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO scheduler_runtime_counters (
			service_name,
			queue_retry_count,
			queue_failure_count,
			queue_replay_count,
			tick_runs,
			due_plans,
			executed_plans,
			queued_jobs,
			deduplicated_jobs,
			rate_limited_targets,
			last_tick_at,
			created_at,
			updated_at
		) VALUES (
			$1, 0, 0, 0, 0, 0, 0, 0, 0, 0, NULL, $2, $2
		)
		ON CONFLICT (service_name) DO NOTHING
	`, s.serviceKey, now.UTC())
	return err
}

func (s *schedulerStateStore) lockRuntimeCountersRowTx(ctx context.Context, tx pgx.Tx) error {
	var serviceName string
	return tx.QueryRow(ctx, `
		SELECT service_name
		FROM scheduler_runtime_counters
		WHERE service_name = $1
		FOR UPDATE
	`, s.serviceKey).Scan(&serviceName)
}

func (s *schedulerStateStore) loadNormalizedState(ctx context.Context, q schedulerStateQueryer) (durableSchedulerState, error) {
	state := durableSchedulerState{
		UserLimiter:         scopeRateLimiterState{Hits: make(map[string]scopeWindow)},
		InstallationLimiter: scopeRateLimiterState{Hits: make(map[string]scopeWindow)},
	}

	if err := s.loadRuntimeCounters(ctx, q, &state); err != nil {
		return durableSchedulerState{}, err
	}

	jobs, err := s.loadJobs(ctx, q)
	if err != nil {
		return durableSchedulerState{}, err
	}
	state.Queue.Jobs = jobs

	deadLetters, err := s.loadDeadLetters(ctx, q)
	if err != nil {
		return durableSchedulerState{}, err
	}
	state.Queue.DeadLetters = deadLetters

	plans, err := s.loadPlans(ctx, q)
	if err != nil {
		return durableSchedulerState{}, err
	}
	state.Plans = plans

	if err := s.loadRateLimitWindows(ctx, q, &state); err != nil {
		return durableSchedulerState{}, err
	}
	if err := s.loadTickScopeTotals(ctx, q, &state); err != nil {
		return durableSchedulerState{}, err
	}
	return state, nil
}

func (s *schedulerStateStore) loadRuntimeCounters(ctx context.Context, q schedulerStateQueryer, state *durableSchedulerState) error {
	var (
		lastTickAt         sql.NullTime
		queueRetryCount    int
		queueFailureCount  int
		queueReplayCount   int
		tickRuns           int
		duePlans           int
		executedPlans      int
		queuedJobs         int
		deduplicatedJobs   int
		rateLimitedTargets int
	)
	err := q.QueryRow(ctx, `
		SELECT
			queue_retry_count,
			queue_failure_count,
			queue_replay_count,
			tick_runs,
			due_plans,
			executed_plans,
			queued_jobs,
			deduplicated_jobs,
			rate_limited_targets,
			last_tick_at
		FROM scheduler_runtime_counters
		WHERE service_name = $1
	`, s.serviceKey).Scan(
		&queueRetryCount,
		&queueFailureCount,
		&queueReplayCount,
		&tickRuns,
		&duePlans,
		&executedPlans,
		&queuedJobs,
		&deduplicatedJobs,
		&rateLimitedTargets,
		&lastTickAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return err
	}

	state.Queue.RetryCount = queueRetryCount
	state.Queue.FailureCount = queueFailureCount
	state.Queue.ReplayCount = queueReplayCount
	state.Ticks.Runs = tickRuns
	state.Ticks.DuePlans = duePlans
	state.Ticks.ExecutedPlans = executedPlans
	state.Ticks.QueuedJobs = queuedJobs
	state.Ticks.DeduplicatedJobs = deduplicatedJobs
	state.Ticks.RateLimitedTargets = rateLimitedTargets
	if lastTickAt.Valid {
		state.Ticks.LastTickAt = lastTickAt.Time.UTC()
	}
	return nil
}

func (s *schedulerStateStore) loadJobs(ctx context.Context, q schedulerStateQueryer) ([]store.QueueJob, error) {
	rows, err := q.Query(ctx, `
		SELECT
			job_id,
			queue_name,
			job_type,
			status,
			correlation_id,
			delivery_id,
			installation_id,
			repository,
			subject,
			dedupe_key,
			attempt_count,
			max_attempts,
			scheduled_at,
			not_before,
			lease_expires_at,
			last_error,
			payload_jsonb::text
		FROM scheduler_jobs
		WHERE service_name = $1
		ORDER BY scheduled_at ASC, job_id ASC
	`, s.serviceKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobs := make([]store.QueueJob, 0)
	for rows.Next() {
		var (
			job          store.QueueJob
			leaseExpires sql.NullTime
			payload      string
		)
		if err := rows.Scan(
			&job.ID,
			&job.QueueName,
			&job.Type,
			&job.Status,
			&job.CorrelationID,
			&job.DeliveryID,
			&job.InstallationID,
			&job.Repository,
			&job.Subject,
			&job.DedupeKey,
			&job.AttemptCount,
			&job.MaxAttempts,
			&job.ScheduledAt,
			&job.NotBefore,
			&leaseExpires,
			&job.LastError,
			&payload,
		); err != nil {
			return nil, err
		}
		if leaseExpires.Valid {
			job.LeaseExpiresAt = leaseExpires.Time.UTC()
		}
		job.ScheduledAt = job.ScheduledAt.UTC()
		job.NotBefore = job.NotBefore.UTC()
		job.Payload = payloadBytes(payload)
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func (s *schedulerStateStore) loadDeadLetters(ctx context.Context, q schedulerStateQueryer) ([]store.DeadLetterRecord, error) {
	rows, err := q.Query(ctx, `
		SELECT
			record_id,
			job_id,
			queue_name,
			job_type,
			delivery_id,
			correlation_id,
			installation_id,
			repository,
			subject,
			dedupe_key,
			attempts,
			max_attempts,
			error_message,
			payload_jsonb::text,
			created_at,
			replayed_at
		FROM scheduler_dead_letters
		WHERE service_name = $1
		ORDER BY created_at ASC, record_id ASC
	`, s.serviceKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := make([]store.DeadLetterRecord, 0)
	for rows.Next() {
		var (
			record     store.DeadLetterRecord
			payload    string
			replayedAt sql.NullTime
		)
		if err := rows.Scan(
			&record.ID,
			&record.JobID,
			&record.QueueName,
			&record.JobType,
			&record.DeliveryID,
			&record.CorrelationID,
			&record.InstallationID,
			&record.Repository,
			&record.Subject,
			&record.DedupeKey,
			&record.Attempts,
			&record.MaxAttempts,
			&record.ErrorMessage,
			&payload,
			&record.CreatedAt,
			&replayedAt,
		); err != nil {
			return nil, err
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.Payload = payloadBytes(payload)
		if replayedAt.Valid {
			replayedAtValue := replayedAt.Time.UTC()
			record.ReplayedAt = &replayedAtValue
		}
		records = append(records, record)
	}
	return records, rows.Err()
}

func (s *schedulerStateStore) loadPlans(ctx context.Context, q schedulerStateQueryer) ([]persistedPlanRecord, error) {
	rows, err := q.Query(ctx, `
		SELECT
			plan_id,
			name,
			cron,
			enabled,
			targets_jsonb::text,
			last_run_at,
			next_run_at,
			queued_jobs_total,
			deduplicated_total,
			rate_limited_total,
			created_at,
			updated_at,
			last_correlation_id
		FROM scheduler_backfill_plans
		WHERE service_name = $1
		ORDER BY created_at ASC, plan_id ASC
	`, s.serviceKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	plans := make([]persistedPlanRecord, 0)
	for rows.Next() {
		var (
			record      persistedPlanRecord
			targetsJSON string
			lastRunAt   sql.NullTime
			nextRunAt   sql.NullTime
		)
		if err := rows.Scan(
			&record.ID,
			&record.Name,
			&record.Cron,
			&record.Enabled,
			&targetsJSON,
			&lastRunAt,
			&nextRunAt,
			&record.QueuedJobsTotal,
			&record.DeduplicatedTotal,
			&record.RateLimitedTotal,
			&record.CreatedAt,
			&record.UpdatedAt,
			&record.LastCorrelationID,
		); err != nil {
			return nil, err
		}
		record.CreatedAt = record.CreatedAt.UTC()
		record.UpdatedAt = record.UpdatedAt.UTC()
		if lastRunAt.Valid {
			lastRunAtValue := lastRunAt.Time.UTC()
			record.LastRunAt = &lastRunAtValue
		}
		if nextRunAt.Valid {
			record.NextRunAt = nextRunAt.Time.UTC()
		}
		if err := unmarshalTargets(targetsJSON, &record.Targets); err != nil {
			return nil, fmt.Errorf("restore backfill plan %s targets: %w", record.ID, err)
		}
		plans = append(plans, record)
	}
	return plans, rows.Err()
}

func (s *schedulerStateStore) loadRateLimitWindows(ctx context.Context, q schedulerStateQueryer, state *durableSchedulerState) error {
	rows, err := q.Query(ctx, `
		SELECT scope, scope_key, started_at, hit_count
		FROM scheduler_rate_limit_windows
		WHERE service_name = $1
		ORDER BY scope ASC, scope_key ASC
	`, s.serviceKey)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			scope     string
			key       string
			startedAt time.Time
			hitCount  int
		)
		if err := rows.Scan(&scope, &key, &startedAt, &hitCount); err != nil {
			return err
		}
		window := scopeWindow{startedAt: startedAt.UTC(), count: hitCount}
		switch scope {
		case "user":
			state.UserLimiter.Hits[key] = window
		case "installation":
			state.InstallationLimiter.Hits[key] = window
		}
	}
	return rows.Err()
}

func (s *schedulerStateStore) loadTickScopeTotals(ctx context.Context, q schedulerStateQueryer, state *durableSchedulerState) error {
	rows, err := q.Query(ctx, `
		SELECT scope, total_count
		FROM scheduler_tick_scope_totals
		WHERE service_name = $1
		ORDER BY scope ASC
	`, s.serviceKey)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			scope string
			total int
		)
		if err := rows.Scan(&scope, &total); err != nil {
			return err
		}
		if state.Ticks.RateLimitedByScope == nil {
			state.Ticks.RateLimitedByScope = make(map[string]int)
		}
		state.Ticks.RateLimitedByScope[scope] = total
	}
	return rows.Err()
}

func (s *schedulerStateStore) saveStateTx(ctx context.Context, tx pgx.Tx, state durableSchedulerState, now time.Time) error {
	if err := s.saveRuntimeCountersTx(ctx, tx, state, now); err != nil {
		return err
	}
	if err := s.replaceJobsTx(ctx, tx, state.Queue.Jobs, now); err != nil {
		return err
	}
	if err := s.replaceDeadLettersTx(ctx, tx, state.Queue.DeadLetters, now); err != nil {
		return err
	}
	if err := s.replacePlansTx(ctx, tx, state.Plans, now); err != nil {
		return err
	}
	if err := s.replaceRateLimitWindowsTx(ctx, tx, state, now); err != nil {
		return err
	}
	if err := s.replaceTickScopeTotalsTx(ctx, tx, state.Ticks.RateLimitedByScope, now); err != nil {
		return err
	}
	if err := s.deleteLegacySnapshotTx(ctx, tx); err != nil {
		return err
	}
	return nil
}

func (s *schedulerStateStore) saveRuntimeCountersTx(ctx context.Context, tx pgx.Tx, state durableSchedulerState, now time.Time) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO scheduler_runtime_counters (
			service_name,
			queue_retry_count,
			queue_failure_count,
			queue_replay_count,
			tick_runs,
			due_plans,
			executed_plans,
			queued_jobs,
			deduplicated_jobs,
			rate_limited_targets,
			last_tick_at,
			created_at,
			updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12
		)
		ON CONFLICT (service_name) DO UPDATE SET
			queue_retry_count = EXCLUDED.queue_retry_count,
			queue_failure_count = EXCLUDED.queue_failure_count,
			queue_replay_count = EXCLUDED.queue_replay_count,
			tick_runs = EXCLUDED.tick_runs,
			due_plans = EXCLUDED.due_plans,
			executed_plans = EXCLUDED.executed_plans,
			queued_jobs = EXCLUDED.queued_jobs,
			deduplicated_jobs = EXCLUDED.deduplicated_jobs,
			rate_limited_targets = EXCLUDED.rate_limited_targets,
			last_tick_at = EXCLUDED.last_tick_at,
			updated_at = EXCLUDED.updated_at
	`, s.serviceKey,
		state.Queue.RetryCount,
		state.Queue.FailureCount,
		state.Queue.ReplayCount,
		state.Ticks.Runs,
		state.Ticks.DuePlans,
		state.Ticks.ExecutedPlans,
		state.Ticks.QueuedJobs,
		state.Ticks.DeduplicatedJobs,
		state.Ticks.RateLimitedTargets,
		nullableTimeValue(state.Ticks.LastTickAt),
		now.UTC(),
	)
	return err
}

func (s *schedulerStateStore) replaceJobsTx(ctx context.Context, tx pgx.Tx, jobs []store.QueueJob, now time.Time) error {
	if _, err := tx.Exec(ctx, `DELETE FROM scheduler_jobs WHERE service_name = $1`, s.serviceKey); err != nil {
		return err
	}
	for _, job := range jobs {
		_, err := tx.Exec(ctx, `
			INSERT INTO scheduler_jobs (
				service_name,
				job_id,
				queue_name,
				job_type,
				status,
				correlation_id,
				delivery_id,
				installation_id,
				repository,
				subject,
				dedupe_key,
				attempt_count,
				max_attempts,
				scheduled_at,
				not_before,
				lease_expires_at,
				last_error,
				payload_jsonb,
				created_at,
				updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
				$12, $13, $14, $15, $16, $17, $18::jsonb, $19, $19
			)
		`, s.serviceKey,
			job.ID,
			job.QueueName,
			string(job.Type),
			string(job.Status),
			job.CorrelationID,
			job.DeliveryID,
			job.InstallationID,
			job.Repository,
			job.Subject,
			job.DedupeKey,
			job.AttemptCount,
			job.MaxAttempts,
			job.ScheduledAt.UTC(),
			job.NotBefore.UTC(),
			nullableTimeValue(job.LeaseExpiresAt),
			job.LastError,
			jsonPayload(job.Payload),
			now.UTC(),
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *schedulerStateStore) replaceDeadLettersTx(ctx context.Context, tx pgx.Tx, records []store.DeadLetterRecord, now time.Time) error {
	if _, err := tx.Exec(ctx, `DELETE FROM scheduler_dead_letters WHERE service_name = $1`, s.serviceKey); err != nil {
		return err
	}
	for _, record := range records {
		_, err := tx.Exec(ctx, `
			INSERT INTO scheduler_dead_letters (
				service_name,
				record_id,
				job_id,
				queue_name,
				job_type,
				delivery_id,
				correlation_id,
				installation_id,
				repository,
				subject,
				dedupe_key,
				attempts,
				max_attempts,
				error_message,
				payload_jsonb,
				created_at,
				replayed_at,
				updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
				$12, $13, $14, $15::jsonb, $16, $17, $18
			)
		`, s.serviceKey,
			record.ID,
			record.JobID,
			record.QueueName,
			string(record.JobType),
			record.DeliveryID,
			record.CorrelationID,
			record.InstallationID,
			record.Repository,
			record.Subject,
			record.DedupeKey,
			record.Attempts,
			record.MaxAttempts,
			record.ErrorMessage,
			jsonPayload(record.Payload),
			record.CreatedAt.UTC(),
			nullableTimePtr(record.ReplayedAt),
			now.UTC(),
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *schedulerStateStore) replacePlansTx(ctx context.Context, tx pgx.Tx, plans []persistedPlanRecord, now time.Time) error {
	if _, err := tx.Exec(ctx, `DELETE FROM scheduler_backfill_plans WHERE service_name = $1`, s.serviceKey); err != nil {
		return err
	}
	for _, plan := range plans {
		targetsJSON, err := json.Marshal(cloneTargets(plan.Targets))
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO scheduler_backfill_plans (
				service_name,
				plan_id,
				name,
				cron,
				enabled,
				targets_jsonb,
				last_run_at,
				next_run_at,
				queued_jobs_total,
				deduplicated_total,
				rate_limited_total,
				created_at,
				updated_at,
				last_correlation_id
			) VALUES (
				$1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14
			)
		`, s.serviceKey,
			plan.ID,
			plan.Name,
			plan.Cron,
			plan.Enabled,
			string(targetsJSON),
			nullableTimePtr(plan.LastRunAt),
			nullableTimeValue(plan.NextRunAt),
			plan.QueuedJobsTotal,
			plan.DeduplicatedTotal,
			plan.RateLimitedTotal,
			plan.CreatedAt.UTC(),
			plan.UpdatedAt.UTC(),
			plan.LastCorrelationID,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *schedulerStateStore) replaceRateLimitWindowsTx(ctx context.Context, tx pgx.Tx, state durableSchedulerState, now time.Time) error {
	if _, err := tx.Exec(ctx, `DELETE FROM scheduler_rate_limit_windows WHERE service_name = $1`, s.serviceKey); err != nil {
		return err
	}
	for key, window := range state.UserLimiter.Hits {
		if err := s.insertRateLimitWindowTx(ctx, tx, "user", key, window, now); err != nil {
			return err
		}
	}
	for key, window := range state.InstallationLimiter.Hits {
		if err := s.insertRateLimitWindowTx(ctx, tx, "installation", key, window, now); err != nil {
			return err
		}
	}
	return nil
}

func (s *schedulerStateStore) insertRateLimitWindowTx(ctx context.Context, tx pgx.Tx, scope, key string, window scopeWindow, now time.Time) error {
	if window.startedAt.IsZero() || window.count <= 0 {
		return nil
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO scheduler_rate_limit_windows (
			service_name,
			scope,
			scope_key,
			started_at,
			hit_count,
			updated_at
		) VALUES ($1, $2, $3, $4, $5, $6)
	`, s.serviceKey, scope, key, window.startedAt.UTC(), window.count, now.UTC())
	return err
}

func (s *schedulerStateStore) replaceTickScopeTotalsTx(ctx context.Context, tx pgx.Tx, totals map[string]int, now time.Time) error {
	if _, err := tx.Exec(ctx, `DELETE FROM scheduler_tick_scope_totals WHERE service_name = $1`, s.serviceKey); err != nil {
		return err
	}
	scopes := make([]string, 0, len(totals))
	for scope := range totals {
		scopes = append(scopes, scope)
	}
	sort.Strings(scopes)
	for _, scope := range scopes {
		total := totals[scope]
		if total <= 0 {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO scheduler_tick_scope_totals (
				service_name,
				scope,
				total_count,
				updated_at
			) VALUES ($1, $2, $3, $4)
		`, s.serviceKey, scope, total, now.UTC())
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *schedulerStateStore) loadLegacyState(ctx context.Context, q schedulerStateQueryer) (durableSchedulerState, bool, error) {
	var payload string
	err := q.QueryRow(ctx, `
		SELECT state_jsonb::text
		FROM scheduler_runtime_states
		WHERE service_name = $1 AND state_key = $2
	`, s.serviceKey, schedulerStateKey).Scan(&payload)
	if err != nil {
		if err == pgx.ErrNoRows {
			return durableSchedulerState{}, false, nil
		}
		return durableSchedulerState{}, false, err
	}

	var state durableSchedulerState
	if strings.TrimSpace(payload) == "" {
		return durableSchedulerState{}, true, nil
	}
	if err := json.Unmarshal([]byte(payload), &state); err != nil {
		return durableSchedulerState{}, false, err
	}
	return state, true, nil
}

func (s *schedulerStateStore) deleteLegacySnapshotTx(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM scheduler_runtime_states
		WHERE service_name = $1 AND state_key = $2
	`, s.serviceKey, schedulerStateKey)
	return err
}

func (s *Service) captureDurableState() durableSchedulerState {
	if s == nil {
		return durableSchedulerState{}
	}

	state := durableSchedulerState{
		Queue:               s.queue.ExportState(),
		Ticks:               s.ticks.snapshot(),
		UserLimiter:         s.userLimiter.snapshot(),
		InstallationLimiter: s.installationLimiter.snapshot(),
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	plans := make([]*backfillPlan, 0, len(s.plans))
	for _, plan := range s.plans {
		plans = append(plans, plan)
	}
	sort.Slice(plans, func(i, j int) bool { return plans[i].ID < plans[j].ID })
	state.Plans = make([]persistedPlanRecord, 0, len(plans))
	for _, plan := range plans {
		state.Plans = append(state.Plans, plan.persisted())
	}
	return state
}

func (s *Service) persistDurableStateWithRollback(before durableSchedulerState, now time.Time) error {
	if s == nil || s.stateStore == nil {
		return nil
	}

	after := s.captureDurableState()
	if err := s.stateStore.Save(context.Background(), after, now.UTC()); err != nil {
		s.restoreDurableState(before)
		return err
	}
	return nil
}

func (s *Service) restorePersistedState(ctx context.Context) error {
	if s == nil || s.stateStore == nil {
		return nil
	}

	state, found, err := s.stateStore.Load(ctx)
	if err != nil || !found {
		return err
	}
	return s.restoreDurableState(state)
}

func (s *Service) restoreDurableState(state durableSchedulerState) error {
	if s == nil {
		return nil
	}

	s.queue.RestoreState(state.Queue)
	plans, err := restorePlans(state.Plans)
	if err != nil {
		return err
	}

	s.mu.Lock()
	s.plans = plans
	s.mu.Unlock()
	s.ticks.restore(state.Ticks)
	s.userLimiter.restore(state.UserLimiter)
	s.installationLimiter.restore(state.InstallationLimiter)
	return nil
}

func restorePlans(records []persistedPlanRecord) (map[string]*backfillPlan, error) {
	plans := make(map[string]*backfillPlan, len(records))
	for _, record := range records {
		plan, err := record.runtime()
		if err != nil {
			return nil, err
		}
		plans[plan.ID] = plan
	}
	return plans, nil
}

func (p *backfillPlan) persisted() persistedPlanRecord {
	return persistedPlanRecord{
		ID:                p.ID,
		Name:              p.Name,
		Cron:              p.Cron,
		Enabled:           p.Enabled,
		Targets:           cloneTargets(p.Targets),
		LastRunAt:         p.LastRunAt,
		NextRunAt:         p.NextRunAt,
		QueuedJobsTotal:   p.QueuedJobsTotal,
		DeduplicatedTotal: p.DeduplicatedTotal,
		RateLimitedTotal:  p.RateLimitedTotal,
		CreatedAt:         p.CreatedAt,
		UpdatedAt:         p.UpdatedAt,
		LastCorrelationID: p.LastCorrelationID,
	}
}

func (p persistedPlanRecord) runtime() (*backfillPlan, error) {
	schedule, err := cron.ParseStandard(strings.TrimSpace(p.Cron))
	if err != nil {
		return nil, fmt.Errorf("restore backfill plan %s: %w", p.ID, err)
	}
	return &backfillPlan{
		ID:                p.ID,
		Name:              p.Name,
		Cron:              p.Cron,
		schedule:          schedule,
		Enabled:           p.Enabled,
		Targets:           cloneTargets(p.Targets),
		LastRunAt:         p.LastRunAt,
		NextRunAt:         p.NextRunAt,
		QueuedJobsTotal:   p.QueuedJobsTotal,
		DeduplicatedTotal: p.DeduplicatedTotal,
		RateLimitedTotal:  p.RateLimitedTotal,
		CreatedAt:         p.CreatedAt,
		UpdatedAt:         p.UpdatedAt,
		LastCorrelationID: p.LastCorrelationID,
	}, nil
}

func hasMeaningfulDurableState(state durableSchedulerState) bool {
	if len(state.Queue.Jobs) > 0 || len(state.Queue.DeadLetters) > 0 || len(state.Plans) > 0 {
		return true
	}
	if state.Queue.RetryCount > 0 || state.Queue.FailureCount > 0 || state.Queue.ReplayCount > 0 {
		return true
	}
	if state.Ticks.Runs > 0 || state.Ticks.DuePlans > 0 || state.Ticks.ExecutedPlans > 0 ||
		state.Ticks.QueuedJobs > 0 || state.Ticks.DeduplicatedJobs > 0 || state.Ticks.RateLimitedTargets > 0 ||
		!state.Ticks.LastTickAt.IsZero() || len(state.Ticks.RateLimitedByScope) > 0 {
		return true
	}
	if len(state.UserLimiter.Hits) > 0 || len(state.InstallationLimiter.Hits) > 0 {
		return true
	}
	return false
}

func nullableTimePtr(value *time.Time) any {
	if value == nil || value.IsZero() {
		return nil
	}
	return value.UTC()
}

func nullableTimeValue(value time.Time) any {
	if value.IsZero() {
		return nil
	}
	return value.UTC()
}

func jsonPayload(payload []byte) string {
	if strings.TrimSpace(string(payload)) == "" {
		return "{}"
	}
	return string(payload)
}

func payloadBytes(payload string) []byte {
	if strings.TrimSpace(payload) == "" {
		return []byte("{}")
	}
	return []byte(payload)
}

func unmarshalTargets(payload string, targets *[]contracts.SyncRequest) error {
	if strings.TrimSpace(payload) == "" {
		*targets = nil
		return nil
	}
	return json.Unmarshal([]byte(payload), targets)
}
