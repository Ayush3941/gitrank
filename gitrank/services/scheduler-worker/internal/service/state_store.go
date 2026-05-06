package service

import (
	"context"
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

type durableSchedulerState struct {
	Queue               store.JobQueueState   `json:"queue"`
	Plans               []persistedPlanRecord `json:"plans,omitempty"`
	Ticks               tickCountersState     `json:"ticks"`
	UserLimiter         scopeRateLimiterState `json:"user_limiter"`
	InstallationLimiter scopeRateLimiterState `json:"installation_limiter"`
}

type persistedPlanRecord struct {
	ID                string                  `json:"id"`
	Name              string                  `json:"name,omitempty"`
	Cron              string                  `json:"cron"`
	Enabled           bool                    `json:"enabled"`
	Targets           []contracts.SyncRequest `json:"targets,omitempty"`
	LastRunAt         *time.Time              `json:"last_run_at,omitempty"`
	NextRunAt         time.Time               `json:"next_run_at"`
	QueuedJobsTotal   int                     `json:"queued_jobs_total"`
	DeduplicatedTotal int                     `json:"deduplicated_total"`
	RateLimitedTotal  int                     `json:"rate_limited_total"`
	CreatedAt         time.Time               `json:"created_at"`
	UpdatedAt         time.Time               `json:"updated_at"`
	LastCorrelationID string                  `json:"last_correlation_id,omitempty"`
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

	var payload string
	err := s.pool.QueryRow(ctx, `
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

func (s *schedulerStateStore) Save(ctx context.Context, state durableSchedulerState, now time.Time) error {
	if s == nil || s.pool == nil {
		return nil
	}

	payload, err := json.Marshal(state)
	if err != nil {
		return err
	}

	_, err = s.pool.Exec(ctx, `
		INSERT INTO scheduler_runtime_states (
			service_name,
			state_key,
			state_jsonb,
			created_at,
			updated_at
		) VALUES (
			$1, $2, $3::jsonb, $4, $4
		)
		ON CONFLICT (service_name, state_key) DO UPDATE SET
			state_jsonb = EXCLUDED.state_jsonb,
			updated_at = EXCLUDED.updated_at
	`, s.serviceKey, schedulerStateKey, payload, now.UTC())
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
