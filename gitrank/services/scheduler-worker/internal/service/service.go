package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/packages/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

const primaryQueueName = "github-sync"

type Service struct {
	cfg                 config.App
	queue               *store.InMemoryJobQueue
	durableMu           sync.Mutex
	mu                  sync.Mutex
	plans               map[string]*backfillPlan
	userLimiter         *scopeRateLimiter
	installationLimiter *scopeRateLimiter
	ticks               *tickCounters
	repositoryRunner    boundedSyncExecutor
	runs                *executionCounters
	stateStore          *schedulerStateStore
}

func New(cfg config.App) *Service {
	return newService(cfg, nil)
}

func NewPersistent(cfg config.App, pool *pgxpool.Pool) (*Service, error) {
	stateStore := newSchedulerStateStore(pool, cfg.ServiceName)
	scheduler := newService(cfg, stateStore)
	if err := scheduler.restorePersistedState(context.Background()); err != nil {
		return nil, err
	}
	return scheduler, nil
}

func newService(cfg config.App, stateStore *schedulerStateStore) *Service {
	return &Service{
		cfg:                 cfg,
		queue:               store.NewInMemoryJobQueue(),
		plans:               make(map[string]*backfillPlan),
		userLimiter:         newScopeRateLimiter(cfg.Scheduler.PerUserRateWindow, cfg.Scheduler.PerUserRateMax),
		installationLimiter: newScopeRateLimiter(cfg.Scheduler.PerInstallationRateWindow, cfg.Scheduler.PerInstallationRateMax),
		ticks:               newTickCounters(),
		repositoryRunner:    newBoundedSyncExecutor(cfg),
		runs:                newExecutionCounters(),
		stateStore:          stateStore,
	}
}

func (s *Service) Ready(ctx context.Context) error {
	if s == nil || s.stateStore == nil {
		return nil
	}
	return s.stateStore.Ready(ctx)
}

func (s *Service) MetricsSource() httpkit.PrometheusSource {
	return s
}

func (s *Service) Config() contracts.SchedulerConfigResponse {
	return contracts.SchedulerConfigResponse{
		SyncCron:                  s.cfg.Scheduler.SyncCron,
		MaxAttempts:               s.cfg.Scheduler.MaxAttempts,
		RetryBackoff:              s.cfg.Scheduler.RetryBackoff.String(),
		WorkerConcurrency:         s.cfg.Scheduler.WorkerConcurrency,
		LeaseTTL:                  s.cfg.Scheduler.LeaseTTL.String(),
		PollInterval:              s.cfg.Scheduler.PollInterval.String(),
		DeadLetterQueue:           s.cfg.Scheduler.DeadLetterQueue,
		PerUserRateWindow:         s.cfg.Scheduler.PerUserRateWindow.String(),
		PerUserRateMax:            s.cfg.Scheduler.PerUserRateMax,
		PerInstallationRateWindow: s.cfg.Scheduler.PerInstallationRateWindow.String(),
		PerInstallationRateMax:    s.cfg.Scheduler.PerInstallationRateMax,
		SupportedJobTypes:         supportedJobTypes(),
	}
}

func (s *Service) DeadLetterConfig(now time.Time) contracts.DeadLetterQueueStatus {
	s.tryRefreshDurableState()
	snapshot := s.queue.Snapshot()
	return contracts.DeadLetterQueueStatus{
		QueueName:     s.cfg.Scheduler.DeadLetterQueue,
		PoisonJobs:    snapshot.DeadLetters,
		LastUpdatedAt: now.UTC(),
	}
}

func (s *Service) QueueStatus(now time.Time, filter contracts.SchedulerJobFilter) contracts.SchedulerQueueStatusResponse {
	s.tryRefreshDurableState()
	snapshot := s.queue.Snapshot()
	jobs := s.queue.Jobs()
	filtered := filterJobs(jobs, filter)
	return contracts.SchedulerQueueStatusResponse{
		QueueName:     primaryQueueName,
		QueueDepth:    snapshot.Queued,
		ActiveLeases:  snapshot.ActiveLeases,
		DeadLetters:   snapshot.DeadLetters,
		Retried:       snapshot.Retried,
		Failures:      snapshot.Failures,
		Replays:       snapshot.Replays,
		VisibleJobs:   len(filtered),
		AppliedFilter: normalizeJobFilter(filter),
		Jobs:          jobViews(filtered),
		LastUpdatedAt: now.UTC(),
	}
}

func (s *Service) Lease(limit int, now time.Time) (contracts.SchedulerLeaseResponse, error) {
	var (
		leased   []store.QueueJob
		snapshot store.JobQueueSnapshot
	)
	if s.stateStore != nil {
		err := s.withDurableMutation(context.Background(), now, func() error {
			leased = s.queue.LeaseReady(now, limit, s.cfg.Scheduler.WorkerConcurrency, s.cfg.Scheduler.LeaseTTL)
			snapshot = s.queue.Snapshot()
			return nil
		})
		if err != nil {
			return contracts.SchedulerLeaseResponse{}, err
		}
	} else {
		leased = s.queue.LeaseReady(now, limit, s.cfg.Scheduler.WorkerConcurrency, s.cfg.Scheduler.LeaseTTL)
		snapshot = s.queue.Snapshot()
	}
	return contracts.SchedulerLeaseResponse{
		QueueName:     primaryQueueName,
		QueueDepth:    snapshot.Queued,
		ActiveLeases:  snapshot.ActiveLeases,
		Jobs:          jobViews(leased),
		LastUpdatedAt: now.UTC(),
	}, nil
}

func (s *Service) EnqueueSync(req contracts.SyncRequest, correlationID string, now time.Time) (contracts.SchedulerEnqueueResponse, error) {
	if s.stateStore != nil {
		var response contracts.SchedulerEnqueueResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			var innerErr error
			response, innerErr = s.enqueueSyncRequest(req, correlationID, now, false)
			return innerErr
		})
		return response, err
	}
	return s.enqueueSyncRequest(req, correlationID, now, true)
}

func (s *Service) enqueueSyncRequest(req contracts.SyncRequest, correlationID string, now time.Time, checkpoint bool) (contracts.SchedulerEnqueueResponse, error) {
	before := s.captureDurableState()

	jobs, err := store.BuildSyncJobs(req, primaryQueueName, correlationID, s.cfg.Scheduler.MaxAttempts)
	if err != nil {
		return contracts.SchedulerEnqueueResponse{}, err
	}
	if err := s.allowScopedRates(req, now); err != nil {
		return contracts.SchedulerEnqueueResponse{}, err
	}

	jobIDs := make([]string, 0, len(jobs))
	deduplicated := true
	for _, job := range jobs {
		enqueued, duplicate, err := s.queue.EnqueueUnique(job)
		if err != nil {
			return contracts.SchedulerEnqueueResponse{}, err
		}
		if !duplicate {
			deduplicated = false
		}
		jobIDs = append(jobIDs, enqueued.ID)
	}

	status := "queued"
	if deduplicated {
		status = "deduplicated"
	}
	response := contracts.SchedulerEnqueueResponse{
		Status:        status,
		JobIDs:        jobIDs,
		QueueName:     primaryQueueName,
		CorrelationID: correlationID,
		Deduplicated:  deduplicated,
		AcceptedAt:    now.UTC(),
	}
	if checkpoint {
		if err := s.persistDurableStateWithRollback(before, now); err != nil {
			return contracts.SchedulerEnqueueResponse{}, err
		}
	}
	return response, nil
}

func (s *Service) Complete(jobID string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
	if s.stateStore != nil {
		var response contracts.SchedulerJobActionResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			job, err := s.queue.Complete(jobID)
			if err != nil {
				return err
			}
			response = contracts.SchedulerJobActionResponse{
				QueueName:     primaryQueueName,
				Status:        "completed",
				Job:           jobView(job),
				LastUpdatedAt: now.UTC(),
			}
			return nil
		})
		return response, err
	}
	before := s.captureDurableState()
	job, err := s.queue.Complete(jobID)
	if err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	response := contracts.SchedulerJobActionResponse{
		QueueName:     primaryQueueName,
		Status:        "completed",
		Job:           jobView(job),
		LastUpdatedAt: now.UTC(),
	}
	if err := s.persistDurableStateWithRollback(before, now); err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	return response, nil
}

func (s *Service) Fail(jobID, errorMessage string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
	if errorMessage == "" {
		errorMessage = "job failed"
	}
	if s.stateStore != nil {
		var response contracts.SchedulerJobActionResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			job, deadLetter, err := s.queue.Fail(jobID, errors.New(errorMessage), now, s.cfg.Scheduler.RetryBackoff)
			if err != nil {
				return err
			}
			response = contracts.SchedulerJobActionResponse{
				QueueName:     primaryQueueName,
				Status:        "failed",
				Job:           jobView(job),
				LastUpdatedAt: now.UTC(),
			}
			if deadLetter != nil {
				response.Status = "dead_lettered"
				response.DeadLetterID = deadLetter.ID
			}
			return nil
		})
		return response, err
	}
	before := s.captureDurableState()
	job, deadLetter, err := s.queue.Fail(jobID, errors.New(errorMessage), now, s.cfg.Scheduler.RetryBackoff)
	if err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	response := contracts.SchedulerJobActionResponse{
		QueueName:     primaryQueueName,
		Status:        "failed",
		Job:           jobView(job),
		LastUpdatedAt: now.UTC(),
	}
	if deadLetter != nil {
		response.Status = "dead_lettered"
		response.DeadLetterID = deadLetter.ID
	}
	if err := s.persistDurableStateWithRollback(before, now); err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	return response, nil
}

func (s *Service) Pause(jobID string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
	if s.stateStore != nil {
		var response contracts.SchedulerJobActionResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			job, err := s.queue.Pause(jobID)
			if err != nil {
				return err
			}
			response = contracts.SchedulerJobActionResponse{
				QueueName:     primaryQueueName,
				Status:        "paused",
				Job:           jobView(job),
				LastUpdatedAt: now.UTC(),
			}
			return nil
		})
		return response, err
	}
	before := s.captureDurableState()
	job, err := s.queue.Pause(jobID)
	if err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	response := contracts.SchedulerJobActionResponse{
		QueueName:     primaryQueueName,
		Status:        "paused",
		Job:           jobView(job),
		LastUpdatedAt: now.UTC(),
	}
	if err := s.persistDurableStateWithRollback(before, now); err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	return response, nil
}

func (s *Service) Resume(jobID string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
	if s.stateStore != nil {
		var response contracts.SchedulerJobActionResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			job, err := s.queue.Resume(jobID, now)
			if err != nil {
				return err
			}
			response = contracts.SchedulerJobActionResponse{
				QueueName:     primaryQueueName,
				Status:        "resumed",
				Job:           jobView(job),
				LastUpdatedAt: now.UTC(),
			}
			return nil
		})
		return response, err
	}
	before := s.captureDurableState()
	job, err := s.queue.Resume(jobID, now)
	if err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	response := contracts.SchedulerJobActionResponse{
		QueueName:     primaryQueueName,
		Status:        "resumed",
		Job:           jobView(job),
		LastUpdatedAt: now.UTC(),
	}
	if err := s.persistDurableStateWithRollback(before, now); err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	return response, nil
}

func (s *Service) Cancel(jobID string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
	if s.stateStore != nil {
		var response contracts.SchedulerJobActionResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			job, err := s.queue.Cancel(jobID)
			if err != nil {
				return err
			}
			response = contracts.SchedulerJobActionResponse{
				QueueName:     primaryQueueName,
				Status:        "canceled",
				Job:           jobView(job),
				LastUpdatedAt: now.UTC(),
			}
			return nil
		})
		return response, err
	}
	before := s.captureDurableState()
	job, err := s.queue.Cancel(jobID)
	if err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	response := contracts.SchedulerJobActionResponse{
		QueueName:     primaryQueueName,
		Status:        "canceled",
		Job:           jobView(job),
		LastUpdatedAt: now.UTC(),
	}
	if err := s.persistDurableStateWithRollback(before, now); err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	return response, nil
}

func (s *Service) DeadLetters(now time.Time) contracts.SchedulerDeadLetterListResponse {
	s.tryRefreshDurableState()
	return contracts.SchedulerDeadLetterListResponse{
		QueueName:     s.cfg.Scheduler.DeadLetterQueue,
		Records:       deadLetterViews(s.queue.DeadLetters()),
		LastUpdatedAt: now.UTC(),
	}
}

func (s *Service) ReplayDeadLetter(recordID, correlationID string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
	if s.stateStore != nil {
		var response contracts.SchedulerJobActionResponse
		err := s.withDurableMutation(context.Background(), now, func() error {
			job, duplicate, err := s.queue.ReplayDeadLetter(recordID, correlationID, now)
			if err != nil {
				return err
			}
			status := "replayed"
			if duplicate {
				status = "deduplicated"
			}
			response = contracts.SchedulerJobActionResponse{
				QueueName:     primaryQueueName,
				Status:        status,
				Deduplicated:  duplicate,
				Job:           jobView(job),
				LastUpdatedAt: now.UTC(),
			}
			return nil
		})
		return response, err
	}
	before := s.captureDurableState()
	job, duplicate, err := s.queue.ReplayDeadLetter(recordID, correlationID, now)
	if err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	status := "replayed"
	if duplicate {
		status = "deduplicated"
	}
	return contracts.SchedulerJobActionResponse{
		QueueName:     primaryQueueName,
		Status:        status,
		Deduplicated:  duplicate,
		Job:           jobView(job),
		LastUpdatedAt: now.UTC(),
	}, s.persistDurableStateWithRollback(before, now)
}

func (s *Service) WritePrometheus(w io.Writer) {
	s.tryRefreshDurableState()
	snapshot := s.queue.Snapshot()

	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_queue_depth Current queued scheduler jobs.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_queue_depth gauge\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_active_leases Current leased scheduler jobs.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_active_leases gauge\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_dead_letters Current dead-lettered scheduler jobs.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_dead_letters gauge\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_job_retries_total Total scheduler job retries.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_job_retries_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_job_failures_total Total scheduler job failures resulting in dead letters.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_job_failures_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_job_replays_total Total scheduler dead-letter replays.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_job_replays_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_backfill_plans_total Total configured backfill plans.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_backfill_plans_total gauge\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_tick_runs_total Total scheduler tick executions.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_tick_runs_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_due_plans_total Total due backfill plans observed across ticks.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_due_plans_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_executed_plans_total Total backfill plans executed across ticks.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_executed_plans_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_rate_limited_targets_total Total backfill or sync targets blocked by scope rate limits.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_rate_limited_targets_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_last_tick_unix Last scheduler tick timestamp as a Unix time.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_last_tick_unix gauge\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_job_runs_total Total scheduler jobs executed by the in-process worker.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_job_runs_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_scheduler_last_job_run_unix Last completed scheduler worker execution timestamp as a Unix time.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_scheduler_last_job_run_unix gauge\n")
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_queue_depth{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, primaryQueueName, snapshot.Queued)
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_active_leases{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, primaryQueueName, snapshot.ActiveLeases)
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_dead_letters{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, s.cfg.Scheduler.DeadLetterQueue, snapshot.DeadLetters)
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_job_retries_total{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, primaryQueueName, snapshot.Retried)
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_job_failures_total{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, primaryQueueName, snapshot.Failures)
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_job_replays_total{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, s.cfg.Scheduler.DeadLetterQueue, snapshot.Replays)

	s.mu.Lock()
	planCount := len(s.plans)
	s.mu.Unlock()
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_backfill_plans_total{service=%q} %d`+"\n", s.cfg.ServiceName, planCount)

	if s.ticks != nil {
		s.ticks.mu.Lock()
		runs := s.ticks.runs
		duePlans := s.ticks.duePlans
		executedPlans := s.ticks.executedPlans
		rateLimitedTargets := s.ticks.rateLimitedTargets
		lastTickAt := s.ticks.lastTickAt.Unix()
		rateLimitedByScope := make(map[string]int, len(s.ticks.rateLimitedByScope))
		for scope, count := range s.ticks.rateLimitedByScope {
			rateLimitedByScope[scope] = count
		}
		s.ticks.mu.Unlock()

		_, _ = fmt.Fprintf(w, `gitrank_scheduler_tick_runs_total{service=%q} %d`+"\n", s.cfg.ServiceName, runs)
		_, _ = fmt.Fprintf(w, `gitrank_scheduler_due_plans_total{service=%q} %d`+"\n", s.cfg.ServiceName, duePlans)
		_, _ = fmt.Fprintf(w, `gitrank_scheduler_executed_plans_total{service=%q} %d`+"\n", s.cfg.ServiceName, executedPlans)
		_, _ = fmt.Fprintf(w, `gitrank_scheduler_rate_limited_targets_total{service=%q} %d`+"\n", s.cfg.ServiceName, rateLimitedTargets)
		_, _ = fmt.Fprintf(w, `gitrank_scheduler_last_tick_unix{service=%q} %d`+"\n", s.cfg.ServiceName, lastTickAt)

		scopes := make([]string, 0, len(rateLimitedByScope))
		for scope := range rateLimitedByScope {
			scopes = append(scopes, scope)
		}
		sort.Strings(scopes)
		for _, scope := range scopes {
			_, _ = fmt.Fprintf(w, `gitrank_scheduler_rate_limited_by_scope_total{service=%q,scope=%q} %d`+"\n", s.cfg.ServiceName, scope, rateLimitedByScope[scope])
		}
	}

	if s.runs != nil {
		s.runs.mu.Lock()
		lastRunAt := int64(0)
		if !s.runs.lastRunAt.IsZero() {
			lastRunAt = s.runs.lastRunAt.Unix()
		}
		byOutcome := make(map[string]int, len(s.runs.byOutcome))
		for key, count := range s.runs.byOutcome {
			byOutcome[key] = count
		}
		s.runs.mu.Unlock()

		_, _ = fmt.Fprintf(w, `gitrank_scheduler_last_job_run_unix{service=%q} %d`+"\n", s.cfg.ServiceName, lastRunAt)

		keys := make([]string, 0, len(byOutcome))
		for key := range byOutcome {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			jobType, status := splitExecutionMetricKey(key)
			_, _ = fmt.Fprintf(w, `gitrank_scheduler_job_runs_total{service=%q,job_type=%q,status=%q} %d`+"\n", s.cfg.ServiceName, jobType, status, byOutcome[key])
		}
	}

	statuses := make([]string, 0, len(snapshot.ByStatus))
	for status := range snapshot.ByStatus {
		statuses = append(statuses, string(status))
	}
	sort.Strings(statuses)
	for _, status := range statuses {
		_, _ = fmt.Fprintf(w, `gitrank_scheduler_jobs_by_status{service=%q,queue=%q,status=%q} %d`+"\n", s.cfg.ServiceName, primaryQueueName, status, snapshot.ByStatus[store.SyncJobStatus(status)])
	}
}

func (s *Service) allowScopedRates(req contracts.SyncRequest, now time.Time) error {
	if user := strings.TrimSpace(req.User); user != "" {
		if allowed, retryAfter := s.userLimiter.Allow(user, now); !allowed {
			s.recordRateLimited("user")
			return &RateLimitError{Scope: "user", Key: user, RetryAfter: retryAfter}
		}
	}
	if req.InstallationID > 0 {
		key := fmt.Sprintf("%d", req.InstallationID)
		if allowed, retryAfter := s.installationLimiter.Allow(key, now); !allowed {
			s.recordRateLimited("installation")
			return &RateLimitError{Scope: "installation", Key: key, RetryAfter: retryAfter}
		}
	}
	return nil
}

func jobViews(jobs []store.QueueJob) []contracts.SchedulerJobView {
	views := make([]contracts.SchedulerJobView, 0, len(jobs))
	for _, job := range jobs {
		views = append(views, jobView(job))
	}
	return views
}

func jobView(job store.QueueJob) contracts.SchedulerJobView {
	return contracts.SchedulerJobView{
		ID:             job.ID,
		QueueName:      job.QueueName,
		Type:           string(job.Type),
		Status:         string(job.Status),
		CorrelationID:  job.CorrelationID,
		DeliveryID:     job.DeliveryID,
		InstallationID: job.InstallationID,
		Repository:     job.Repository,
		Subject:        job.Subject,
		DedupeKey:      job.DedupeKey,
		AttemptCount:   job.AttemptCount,
		MaxAttempts:    job.MaxAttempts,
		ScheduledAt:    job.ScheduledAt,
		NotBefore:      job.NotBefore,
		LeaseExpiresAt: job.LeaseExpiresAt,
		LastError:      job.LastError,
	}
}

func deadLetterViews(records []store.DeadLetterRecord) []contracts.DeadLetterRecordView {
	views := make([]contracts.DeadLetterRecordView, 0, len(records))
	for _, record := range records {
		views = append(views, contracts.DeadLetterRecordView{
			ID:             record.ID,
			JobID:          record.JobID,
			QueueName:      record.QueueName,
			JobType:        string(record.JobType),
			DeliveryID:     record.DeliveryID,
			CorrelationID:  record.CorrelationID,
			InstallationID: record.InstallationID,
			Repository:     record.Repository,
			Subject:        record.Subject,
			DedupeKey:      record.DedupeKey,
			Attempts:       record.Attempts,
			MaxAttempts:    record.MaxAttempts,
			ErrorMessage:   record.ErrorMessage,
			CreatedAt:      record.CreatedAt,
			ReplayedAt:     record.ReplayedAt,
		})
	}
	return views
}

func supportedJobTypes() []string {
	types := store.SupportedSyncJobTypes()
	labels := make([]string, 0, len(types))
	for _, jobType := range types {
		labels = append(labels, string(jobType))
	}
	return labels
}

func filterJobs(jobs []store.QueueJob, filter contracts.SchedulerJobFilter) []store.QueueJob {
	filter = normalizeJobFilter(filter)
	if filter == (contracts.SchedulerJobFilter{}) {
		return jobs
	}

	filtered := make([]store.QueueJob, 0, len(jobs))
	for _, job := range jobs {
		if filter.Type != "" && string(job.Type) != filter.Type {
			continue
		}
		if filter.Status != "" && string(job.Status) != filter.Status {
			continue
		}
		if filter.Repository != "" && !strings.EqualFold(job.Repository, filter.Repository) {
			continue
		}
		if filter.User != "" && !(job.Type == store.SyncUserHistoryJob && strings.EqualFold(job.Subject, filter.User)) {
			continue
		}
		if filter.Subject != "" && !strings.EqualFold(job.Subject, filter.Subject) {
			continue
		}
		if filter.CorrelationID != "" && job.CorrelationID != filter.CorrelationID {
			continue
		}
		if filter.InstallationID > 0 && job.InstallationID != filter.InstallationID {
			continue
		}
		filtered = append(filtered, job)
	}
	return filtered
}

func normalizeJobFilter(filter contracts.SchedulerJobFilter) contracts.SchedulerJobFilter {
	filter.Type = strings.TrimSpace(filter.Type)
	filter.Status = strings.TrimSpace(filter.Status)
	filter.Repository = strings.TrimSpace(filter.Repository)
	filter.User = strings.TrimSpace(filter.User)
	filter.Subject = strings.TrimSpace(filter.Subject)
	filter.CorrelationID = strings.TrimSpace(filter.CorrelationID)
	return filter
}
