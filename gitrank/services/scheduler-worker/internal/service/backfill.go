package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/store"
	"github.com/robfig/cron/v3"
)

type backfillPlan struct {
	ID                string
	Name              string
	Cron              string
	schedule          cron.Schedule
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

type tickCounters struct {
	mu                 sync.Mutex
	runs               int
	duePlans           int
	executedPlans      int
	queuedJobs         int
	deduplicatedJobs   int
	rateLimitedTargets int
	lastTickAt         time.Time
	rateLimitedByScope map[string]int
}

type tickCountersState struct {
	Runs               int            `json:"runs"`
	DuePlans           int            `json:"due_plans"`
	ExecutedPlans      int            `json:"executed_plans"`
	QueuedJobs         int            `json:"queued_jobs"`
	DeduplicatedJobs   int            `json:"deduplicated_jobs"`
	RateLimitedTargets int            `json:"rate_limited_targets"`
	LastTickAt         time.Time      `json:"last_tick_at"`
	RateLimitedByScope map[string]int `json:"rate_limited_by_scope,omitempty"`
}

func newTickCounters() *tickCounters {
	return &tickCounters{rateLimitedByScope: make(map[string]int)}
}

func (t *tickCounters) snapshot() tickCountersState {
	if t == nil {
		return tickCountersState{}
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	state := tickCountersState{
		Runs:               t.runs,
		DuePlans:           t.duePlans,
		ExecutedPlans:      t.executedPlans,
		QueuedJobs:         t.queuedJobs,
		DeduplicatedJobs:   t.deduplicatedJobs,
		RateLimitedTargets: t.rateLimitedTargets,
		LastTickAt:         t.lastTickAt,
		RateLimitedByScope: make(map[string]int, len(t.rateLimitedByScope)),
	}
	for scope, count := range t.rateLimitedByScope {
		state.RateLimitedByScope[scope] = count
	}
	return state
}

func (t *tickCounters) restore(state tickCountersState) {
	if t == nil {
		return
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	t.runs = state.Runs
	t.duePlans = state.DuePlans
	t.executedPlans = state.ExecutedPlans
	t.queuedJobs = state.QueuedJobs
	t.deduplicatedJobs = state.DeduplicatedJobs
	t.rateLimitedTargets = state.RateLimitedTargets
	t.lastTickAt = state.LastTickAt
	t.rateLimitedByScope = make(map[string]int, len(state.RateLimitedByScope))
	for scope, count := range state.RateLimitedByScope {
		t.rateLimitedByScope[scope] = count
	}
}

func (s *Service) Run(ctx context.Context) {
	var workers sync.WaitGroup

	workers.Add(1)
	go func() {
		defer workers.Done()
		ticker := time.NewTicker(s.cfg.Scheduler.PollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				_, _ = s.Tick(now.UTC())
			}
		}
	}()

	workerCount := s.cfg.Scheduler.WorkerConcurrency
	if workerCount <= 0 {
		workerCount = 1
	}
	for range workerCount {
		workers.Add(1)
		go func() {
			defer workers.Done()
			s.runWorkerLoop(ctx)
		}()
	}

	<-ctx.Done()
	workers.Wait()
}

func (s *Service) CreateBackfillPlan(req contracts.SchedulerBackfillPlanRequest, now time.Time) (contracts.SchedulerBackfillPlanView, error) {
	if s.stateStore != nil {
		var view contracts.SchedulerBackfillPlanView
		err := s.withDurableMutation(context.Background(), now, func() error {
			plan, err := newBackfillPlan(req, defaultSchedule(req.Cron, s.cfg.Scheduler.SyncCron), now)
			if err != nil {
				return err
			}
			s.mu.Lock()
			s.plans[plan.ID] = plan
			view = plan.view()
			s.mu.Unlock()
			return nil
		})
		return view, err
	}
	plan, err := newBackfillPlan(req, defaultSchedule(req.Cron, s.cfg.Scheduler.SyncCron), now)
	if err != nil {
		return contracts.SchedulerBackfillPlanView{}, err
	}
	before := s.captureDurableState()

	s.mu.Lock()
	s.plans[plan.ID] = plan
	view := plan.view()
	s.mu.Unlock()
	if err := s.persistDurableStateWithRollback(before, now); err != nil {
		return contracts.SchedulerBackfillPlanView{}, err
	}
	return view, nil
}

func (s *Service) BackfillPlans(now time.Time) contracts.SchedulerBackfillPlanListResponse {
	s.tryRefreshDurableState()
	s.mu.Lock()
	defer s.mu.Unlock()

	plans := make([]*backfillPlan, 0, len(s.plans))
	for _, plan := range s.plans {
		plans = append(plans, plan)
	}
	sort.Slice(plans, func(i, j int) bool { return backfillPlanListLess(plans[i], plans[j]) })

	views := make([]contracts.SchedulerBackfillPlanView, 0, len(plans))
	for _, plan := range plans {
		views = append(views, plan.view())
	}
	return contracts.SchedulerBackfillPlanListResponse{
		Plans:         views,
		LastUpdatedAt: now.UTC(),
	}
}

func (s *Service) PauseBackfillPlan(planID string, now time.Time) (contracts.SchedulerBackfillPlanActionResponse, error) {
	if s.stateStore != nil {
		var response contracts.SchedulerBackfillPlanActionResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			s.mu.Lock()
			defer s.mu.Unlock()

			plan, err := s.planByIDLocked(planID)
			if err != nil {
				return err
			}

			plan.Enabled = false
			plan.NextRunAt = time.Time{}
			plan.UpdatedAt = now.UTC()
			response = contracts.SchedulerBackfillPlanActionResponse{
				Status:        "paused",
				Plan:          plan.view(),
				LastUpdatedAt: now.UTC(),
			}
			return nil
		})
		return response, err
	}
	before := s.captureDurableState()
	s.mu.Lock()

	plan, err := s.planByIDLocked(planID)
	if err != nil {
		s.mu.Unlock()
		return contracts.SchedulerBackfillPlanActionResponse{}, err
	}

	plan.Enabled = false
	plan.NextRunAt = time.Time{}
	plan.UpdatedAt = now.UTC()
	response := contracts.SchedulerBackfillPlanActionResponse{
		Status:        "paused",
		Plan:          plan.view(),
		LastUpdatedAt: now.UTC(),
	}
	s.mu.Unlock()
	if err := s.persistDurableStateWithRollback(before, now); err != nil {
		return contracts.SchedulerBackfillPlanActionResponse{}, err
	}
	return response, nil
}

func (s *Service) ResumeBackfillPlan(planID string, now time.Time) (contracts.SchedulerBackfillPlanActionResponse, error) {
	if s.stateStore != nil {
		var response contracts.SchedulerBackfillPlanActionResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			s.mu.Lock()
			defer s.mu.Unlock()

			plan, err := s.planByIDLocked(planID)
			if err != nil {
				return err
			}

			plan.Enabled = true
			plan.NextRunAt = plan.schedule.Next(now.UTC())
			plan.UpdatedAt = now.UTC()
			response = contracts.SchedulerBackfillPlanActionResponse{
				Status:        "resumed",
				Plan:          plan.view(),
				LastUpdatedAt: now.UTC(),
			}
			return nil
		})
		return response, err
	}
	before := s.captureDurableState()
	s.mu.Lock()

	plan, err := s.planByIDLocked(planID)
	if err != nil {
		s.mu.Unlock()
		return contracts.SchedulerBackfillPlanActionResponse{}, err
	}

	plan.Enabled = true
	plan.NextRunAt = plan.schedule.Next(now.UTC())
	plan.UpdatedAt = now.UTC()
	response := contracts.SchedulerBackfillPlanActionResponse{
		Status:        "resumed",
		Plan:          plan.view(),
		LastUpdatedAt: now.UTC(),
	}
	s.mu.Unlock()
	if err := s.persistDurableStateWithRollback(before, now); err != nil {
		return contracts.SchedulerBackfillPlanActionResponse{}, err
	}
	return response, nil
}

func (s *Service) DeleteBackfillPlan(planID string, now time.Time) (contracts.SchedulerBackfillPlanActionResponse, error) {
	if s.stateStore != nil {
		var response contracts.SchedulerBackfillPlanActionResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			s.mu.Lock()
			defer s.mu.Unlock()

			plan, err := s.planByIDLocked(planID)
			if err != nil {
				return err
			}

			view := plan.view()
			delete(s.plans, planID)
			response = contracts.SchedulerBackfillPlanActionResponse{
				Status:        "deleted",
				Plan:          view,
				LastUpdatedAt: now.UTC(),
			}
			return nil
		})
		return response, err
	}
	before := s.captureDurableState()
	s.mu.Lock()

	plan, err := s.planByIDLocked(planID)
	if err != nil {
		s.mu.Unlock()
		return contracts.SchedulerBackfillPlanActionResponse{}, err
	}

	view := plan.view()
	delete(s.plans, planID)
	response := contracts.SchedulerBackfillPlanActionResponse{
		Status:        "deleted",
		Plan:          view,
		LastUpdatedAt: now.UTC(),
	}
	s.mu.Unlock()
	if err := s.persistDurableStateWithRollback(before, now); err != nil {
		return contracts.SchedulerBackfillPlanActionResponse{}, err
	}
	return response, nil
}

func (s *Service) CancelBackfillPlanJobs(planID string, now time.Time) (contracts.SchedulerBackfillPlanActionResponse, error) {
	if s.stateStore != nil {
		var response contracts.SchedulerBackfillPlanActionResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			var innerErr error
			response, innerErr = s.cancelBackfillPlanJobsLocal(planID, now, false)
			return innerErr
		})
		return response, err
	}
	return s.cancelBackfillPlanJobsLocal(planID, now, true)
}

func (s *Service) cancelBackfillPlanJobsLocal(planID string, now time.Time, checkpoint bool) (contracts.SchedulerBackfillPlanActionResponse, error) {
	before := s.captureDurableState()

	s.mu.Lock()
	plan, err := s.planByIDLocked(planID)
	if err != nil {
		s.mu.Unlock()
		return contracts.SchedulerBackfillPlanActionResponse{}, err
	}
	correlationID := strings.TrimSpace(plan.LastCorrelationID)
	if correlationID == "" {
		s.mu.Unlock()
		return contracts.SchedulerBackfillPlanActionResponse{}, errors.New("backfill plan has no recorded run correlation")
	}
	plan.UpdatedAt = now.UTC()
	s.mu.Unlock()

	canceledJobs := s.queue.CancelByCorrelation(correlationID)

	s.mu.Lock()
	plan, err = s.planByIDLocked(planID)
	if err != nil {
		s.mu.Unlock()
		return contracts.SchedulerBackfillPlanActionResponse{}, err
	}
	plan.UpdatedAt = now.UTC()
	view := plan.view()
	s.mu.Unlock()

	status := "canceled_jobs"
	if len(canceledJobs) == 0 {
		status = "no_active_jobs"
	}
	response := contracts.SchedulerBackfillPlanActionResponse{
		Status:        status,
		Plan:          view,
		CorrelationID: correlationID,
		AffectedJobs:  len(canceledJobs),
		LastUpdatedAt: now.UTC(),
	}
	if checkpoint {
		if err := s.persistDurableStateWithRollback(before, now); err != nil {
			return contracts.SchedulerBackfillPlanActionResponse{}, err
		}
	}
	return response, nil
}

func (s *Service) Tick(now time.Time) (contracts.SchedulerTickResponse, error) {
	now = now.UTC()
	if s.stateStore != nil {
		var response contracts.SchedulerTickResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			var innerErr error
			response, innerErr = s.tickLocal(now, false)
			return innerErr
		})
		return response, err
	}
	return s.tickLocal(now, true)
}

func (s *Service) tickLocal(now time.Time, checkpoint bool) (contracts.SchedulerTickResponse, error) {
	before := s.captureDurableState()

	s.mu.Lock()
	duePlans := make([]*backfillPlan, 0)
	for _, plan := range s.plans {
		if plan.Enabled && !plan.NextRunAt.IsZero() && !plan.NextRunAt.After(now) {
			duePlans = append(duePlans, plan)
		}
	}
	sort.Slice(duePlans, func(i, j int) bool {
		if duePlans[i].NextRunAt.Equal(duePlans[j].NextRunAt) {
			return duePlans[i].CreatedAt.Before(duePlans[j].CreatedAt)
		}
		return duePlans[i].NextRunAt.Before(duePlans[j].NextRunAt)
	})
	s.mu.Unlock()

	response := contracts.SchedulerTickResponse{
		Status:     "idle",
		DuePlans:   len(duePlans),
		LastTickAt: now,
	}

	for _, plan := range duePlans {
		correlationID := "backfill:" + plan.ID + ":" + newPlanID()
		executed := false
		queuedForPlan := 0
		deduplicatedForPlan := 0
		rateLimitedForPlan := 0

		for _, target := range plan.Targets {
			enqueued, err := s.enqueueSyncRequest(target, correlationID, now, false)
			if err != nil {
				var rateLimitErr *RateLimitError
				if errors.As(err, &rateLimitErr) {
					rateLimitedForPlan++
					continue
				}
				return response, err
			}
			executed = true
			queuedForPlan += len(enqueued.JobIDs)
			if enqueued.Deduplicated {
				deduplicatedForPlan += len(enqueued.JobIDs)
			}
		}

		s.mu.Lock()
		plan.LastRunAt = ptrTime(now)
		plan.NextRunAt = plan.schedule.Next(now)
		plan.UpdatedAt = now
		plan.LastCorrelationID = correlationID
		plan.QueuedJobsTotal += queuedForPlan
		plan.DeduplicatedTotal += deduplicatedForPlan
		plan.RateLimitedTotal += rateLimitedForPlan
		s.mu.Unlock()

		response.ExecutedPlans++
		response.QueuedJobs += queuedForPlan
		response.DeduplicatedJobs += deduplicatedForPlan
		response.RateLimitedTargets += rateLimitedForPlan
		if !executed && rateLimitedForPlan == 0 {
			// still counts as executed; it just produced no new work because every target deduplicated.
		}
	}

	if response.DuePlans > 0 {
		response.Status = "ran_due_plans"
	}
	s.recordTick(response)
	if checkpoint {
		if err := s.persistDurableStateWithRollback(before, now); err != nil {
			return contracts.SchedulerTickResponse{}, err
		}
	}
	return response, nil
}

func newBackfillPlan(req contracts.SchedulerBackfillPlanRequest, cronExpr string, now time.Time) (*backfillPlan, error) {
	if len(req.Targets) == 0 {
		return nil, errors.New("at least one backfill target is required")
	}
	schedule, err := cron.ParseStandard(cronExpr)
	if err != nil {
		return nil, err
	}
	for _, target := range req.Targets {
		if _, err := validateSyncTarget(target); err != nil {
			return nil, err
		}
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	createdAt := now.UTC()
	return &backfillPlan{
		ID:        newPlanID(),
		Name:      strings.TrimSpace(req.Name),
		Cron:      cronExpr,
		schedule:  schedule,
		Enabled:   enabled,
		Targets:   cloneTargets(req.Targets),
		NextRunAt: schedule.Next(createdAt),
		CreatedAt: createdAt,
		UpdatedAt: createdAt,
	}, nil
}

func (p *backfillPlan) view() contracts.SchedulerBackfillPlanView {
	return contracts.SchedulerBackfillPlanView{
		ID:                p.ID,
		Name:              p.Name,
		Cron:              p.Cron,
		Enabled:           p.Enabled,
		Targets:           cloneTargets(p.Targets),
		TargetCount:       len(p.Targets),
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

func cloneTargets(targets []contracts.SyncRequest) []contracts.SyncRequest {
	cloned := make([]contracts.SyncRequest, 0, len(targets))
	for _, target := range targets {
		cloned = append(cloned, target)
	}
	return cloned
}

func backfillPlanListLess(left, right *backfillPlan) bool {
	if left.Enabled != right.Enabled {
		return left.Enabled
	}
	if left.NextRunAt.IsZero() != right.NextRunAt.IsZero() {
		return !left.NextRunAt.IsZero()
	}
	if left.NextRunAt.IsZero() && right.NextRunAt.IsZero() {
		return left.CreatedAt.Before(right.CreatedAt)
	}
	if left.NextRunAt.Equal(right.NextRunAt) {
		return left.CreatedAt.Before(right.CreatedAt)
	}
	return left.NextRunAt.Before(right.NextRunAt)
}

func defaultSchedule(planCron, fallback string) string {
	if strings.TrimSpace(planCron) != "" {
		return strings.TrimSpace(planCron)
	}
	return strings.TrimSpace(fallback)
}

func (s *Service) planByIDLocked(planID string) (*backfillPlan, error) {
	planID = strings.TrimSpace(planID)
	if planID == "" {
		return nil, errors.New("backfill plan not found")
	}
	plan, ok := s.plans[planID]
	if !ok {
		return nil, errors.New("backfill plan not found")
	}
	return plan, nil
}

func validateSyncTarget(target contracts.SyncRequest) ([]string, error) {
	jobs, err := store.BuildSyncJobs(target, primaryQueueName, "validate", 1)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(jobs))
	for _, job := range jobs {
		ids = append(ids, job.ID)
	}
	return ids, nil
}

func (s *Service) recordTick(response contracts.SchedulerTickResponse) {
	if s.ticks == nil {
		return
	}
	s.ticks.mu.Lock()
	defer s.ticks.mu.Unlock()
	s.ticks.runs++
	s.ticks.duePlans += response.DuePlans
	s.ticks.executedPlans += response.ExecutedPlans
	s.ticks.queuedJobs += response.QueuedJobs
	s.ticks.deduplicatedJobs += response.DeduplicatedJobs
	s.ticks.rateLimitedTargets += response.RateLimitedTargets
	s.ticks.lastTickAt = response.LastTickAt.UTC()
}

func (s *Service) recordRateLimited(scope string) {
	if s.ticks == nil {
		return
	}
	s.ticks.mu.Lock()
	defer s.ticks.mu.Unlock()
	s.ticks.rateLimitedByScope[scope]++
}

func ptrTime(t time.Time) *time.Time {
	value := t.UTC()
	return &value
}

func newPlanID() string {
	var bytes [16]byte
	_, _ = rand.Read(bytes[:])
	return hex.EncodeToString(bytes[:])
}
