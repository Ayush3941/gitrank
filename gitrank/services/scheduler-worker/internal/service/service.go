package service

import (
	"errors"
	"fmt"
	"io"
	"sort"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/packages/store"
)

const primaryQueueName = "github-sync"

type Service struct {
	cfg   config.App
	queue *store.InMemoryJobQueue
}

func New(cfg config.App) *Service {
	return &Service{
		cfg:   cfg,
		queue: store.NewInMemoryJobQueue(),
	}
}

func (s *Service) MetricsSource() httpkit.PrometheusSource {
	return s
}

func (s *Service) Config() contracts.SchedulerConfigResponse {
	return contracts.SchedulerConfigResponse{
		SyncCron:          s.cfg.Scheduler.SyncCron,
		MaxAttempts:       s.cfg.Scheduler.MaxAttempts,
		RetryBackoff:      s.cfg.Scheduler.RetryBackoff.String(),
		WorkerConcurrency: s.cfg.Scheduler.WorkerConcurrency,
		LeaseTTL:          s.cfg.Scheduler.LeaseTTL.String(),
		PollInterval:      s.cfg.Scheduler.PollInterval.String(),
		DeadLetterQueue:   s.cfg.Scheduler.DeadLetterQueue,
		SupportedJobTypes: supportedJobTypes(),
	}
}

func (s *Service) DeadLetterConfig(now time.Time) contracts.DeadLetterQueueStatus {
	snapshot := s.queue.Snapshot()
	return contracts.DeadLetterQueueStatus{
		QueueName:     s.cfg.Scheduler.DeadLetterQueue,
		PoisonJobs:    snapshot.DeadLetters,
		LastUpdatedAt: now.UTC(),
	}
}

func (s *Service) QueueStatus(now time.Time) contracts.SchedulerQueueStatusResponse {
	snapshot := s.queue.Snapshot()
	jobs := s.queue.Jobs()
	return contracts.SchedulerQueueStatusResponse{
		QueueName:     primaryQueueName,
		QueueDepth:    snapshot.Queued,
		ActiveLeases:  snapshot.ActiveLeases,
		DeadLetters:   snapshot.DeadLetters,
		Retried:       snapshot.Retried,
		Failures:      snapshot.Failures,
		Replays:       snapshot.Replays,
		Jobs:          jobViews(jobs),
		LastUpdatedAt: now.UTC(),
	}
}

func (s *Service) Lease(limit int, now time.Time) contracts.SchedulerLeaseResponse {
	leased := s.queue.LeaseReady(now, limit, s.cfg.Scheduler.WorkerConcurrency, s.cfg.Scheduler.LeaseTTL)
	snapshot := s.queue.Snapshot()
	return contracts.SchedulerLeaseResponse{
		QueueName:     primaryQueueName,
		QueueDepth:    snapshot.Queued,
		ActiveLeases:  snapshot.ActiveLeases,
		Jobs:          jobViews(leased),
		LastUpdatedAt: now.UTC(),
	}
}

func (s *Service) EnqueueSync(req contracts.SyncRequest, correlationID string, now time.Time) (contracts.SchedulerEnqueueResponse, error) {
	jobs, err := store.BuildSyncJobs(req, primaryQueueName, correlationID, s.cfg.Scheduler.MaxAttempts)
	if err != nil {
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
	return contracts.SchedulerEnqueueResponse{
		Status:        status,
		JobIDs:        jobIDs,
		QueueName:     primaryQueueName,
		CorrelationID: correlationID,
		Deduplicated:  deduplicated,
		AcceptedAt:    now.UTC(),
	}, nil
}

func (s *Service) Complete(jobID string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
	job, err := s.queue.Complete(jobID)
	if err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	return contracts.SchedulerJobActionResponse{
		QueueName:     primaryQueueName,
		Status:        "completed",
		Job:           jobView(job),
		LastUpdatedAt: now.UTC(),
	}, nil
}

func (s *Service) Fail(jobID, errorMessage string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
	if errorMessage == "" {
		errorMessage = "job failed"
	}
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
	return response, nil
}

func (s *Service) Pause(jobID string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
	job, err := s.queue.Pause(jobID)
	if err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	return contracts.SchedulerJobActionResponse{
		QueueName:     primaryQueueName,
		Status:        "paused",
		Job:           jobView(job),
		LastUpdatedAt: now.UTC(),
	}, nil
}

func (s *Service) Resume(jobID string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
	job, err := s.queue.Resume(jobID, now)
	if err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	return contracts.SchedulerJobActionResponse{
		QueueName:     primaryQueueName,
		Status:        "resumed",
		Job:           jobView(job),
		LastUpdatedAt: now.UTC(),
	}, nil
}

func (s *Service) Cancel(jobID string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
	job, err := s.queue.Cancel(jobID)
	if err != nil {
		return contracts.SchedulerJobActionResponse{}, err
	}
	return contracts.SchedulerJobActionResponse{
		QueueName:     primaryQueueName,
		Status:        "canceled",
		Job:           jobView(job),
		LastUpdatedAt: now.UTC(),
	}, nil
}

func (s *Service) DeadLetters(now time.Time) contracts.SchedulerDeadLetterListResponse {
	return contracts.SchedulerDeadLetterListResponse{
		QueueName:     s.cfg.Scheduler.DeadLetterQueue,
		Records:       deadLetterViews(s.queue.DeadLetters()),
		LastUpdatedAt: now.UTC(),
	}
}

func (s *Service) ReplayDeadLetter(recordID, correlationID string, now time.Time) (contracts.SchedulerJobActionResponse, error) {
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
	}, nil
}

func (s *Service) WritePrometheus(w io.Writer) {
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
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_queue_depth{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, primaryQueueName, snapshot.Queued)
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_active_leases{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, primaryQueueName, snapshot.ActiveLeases)
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_dead_letters{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, s.cfg.Scheduler.DeadLetterQueue, snapshot.DeadLetters)
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_job_retries_total{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, primaryQueueName, snapshot.Retried)
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_job_failures_total{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, primaryQueueName, snapshot.Failures)
	_, _ = fmt.Fprintf(w, `gitrank_scheduler_job_replays_total{service=%q,queue=%q} %d`+"\n", s.cfg.ServiceName, s.cfg.Scheduler.DeadLetterQueue, snapshot.Replays)
	statuses := make([]string, 0, len(snapshot.ByStatus))
	for status := range snapshot.ByStatus {
		statuses = append(statuses, string(status))
	}
	sort.Strings(statuses)
	for _, status := range statuses {
		_, _ = fmt.Fprintf(w, `gitrank_scheduler_jobs_by_status{service=%q,queue=%q,status=%q} %d`+"\n", s.cfg.ServiceName, primaryQueueName, status, snapshot.ByStatus[store.SyncJobStatus(status)])
	}
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
