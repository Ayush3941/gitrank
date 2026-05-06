package store

import (
	"errors"
	"slices"
	"sync"
	"time"
)

type InMemoryDeliveryStore struct {
	mu      sync.Mutex
	ttl     time.Duration
	entries map[string]WebhookDelivery
}

type DeliveryStoreSnapshot struct {
	Total          int
	ByStatus       map[WebhookDeliveryStatus]int
	Deduplicated   int
	ReplayRecorded int
}

func NewInMemoryDeliveryStore(ttl time.Duration) *InMemoryDeliveryStore {
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}
	return &InMemoryDeliveryStore{
		ttl:     ttl,
		entries: make(map[string]WebhookDelivery),
	}
}

func (s *InMemoryDeliveryStore) Remember(delivery WebhookDelivery) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked(time.Now().UTC())

	if _, ok := s.entries[delivery.DeliveryID]; ok {
		existing := s.entries[delivery.DeliveryID]
		existing.Status = DeliveryDuplicate
		s.entries[delivery.DeliveryID] = existing
		return true, nil
	}

	s.entries[delivery.DeliveryID] = delivery
	return false, nil
}

func (s *InMemoryDeliveryStore) MarkStatus(deliveryID string, status WebhookDeliveryStatus, err error) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delivery, ok := s.entries[deliveryID]
	if !ok {
		return errors.New("delivery not found")
	}
	delivery.Status = status
	if err != nil {
		delivery.LastError = err.Error()
	} else {
		delivery.LastError = ""
	}
	s.entries[deliveryID] = delivery
	return nil
}

func (s *InMemoryDeliveryStore) Lookup(deliveryID string) (WebhookDelivery, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.pruneLocked(time.Now().UTC())
	delivery, ok := s.entries[deliveryID]
	if !ok {
		return WebhookDelivery{}, false, nil
	}
	return delivery, true, nil
}

func (s *InMemoryDeliveryStore) pruneLocked(now time.Time) {
	for id, delivery := range s.entries {
		if now.Sub(delivery.ReceivedAt) > s.ttl {
			delete(s.entries, id)
		}
	}
}

func (s *InMemoryDeliveryStore) Snapshot(now time.Time) (DeliveryStoreSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.pruneLocked(now.UTC())
	snapshot := DeliveryStoreSnapshot{
		Total:    len(s.entries),
		ByStatus: make(map[WebhookDeliveryStatus]int),
	}
	for _, delivery := range s.entries {
		snapshot.ByStatus[delivery.Status]++
		if delivery.Status == DeliveryDuplicate {
			snapshot.Deduplicated++
		}
		if delivery.Signature != "" {
			snapshot.ReplayRecorded++
		}
	}
	return snapshot, nil
}

type InMemoryJobQueue struct {
	mu           sync.Mutex
	jobs         []QueueJob
	deadLetters  []DeadLetterRecord
	retryCount   int
	failureCount int
	replayCount  int
}

type JobQueueSnapshot struct {
	Queued       int
	DeadLetters  int
	ActiveLeases int
	Retried      int
	Failures     int
	Replays      int
	ByStatus     map[SyncJobStatus]int
}

type JobQueueState struct {
	Jobs         []QueueJob
	DeadLetters  []DeadLetterRecord
	RetryCount   int
	FailureCount int
	ReplayCount  int
}

func NewInMemoryJobQueue() *InMemoryJobQueue {
	return &InMemoryJobQueue{}
}

func (q *InMemoryJobQueue) Enqueue(job QueueJob) error {
	if job.ID == "" {
		return errors.New("job ID is required")
	}

	q.mu.Lock()
	defer q.mu.Unlock()
	q.jobs = append(q.jobs, job)
	return nil
}

func (q *InMemoryJobQueue) EnqueueUnique(job QueueJob) (QueueJob, bool, error) {
	if job.ID == "" {
		return QueueJob{}, false, errors.New("job ID is required")
	}

	q.mu.Lock()
	defer q.mu.Unlock()
	for _, existing := range q.jobs {
		if job.DedupeKey != "" && existing.DedupeKey == job.DedupeKey && isActiveJobStatus(existing.Status) {
			return existing, true, nil
		}
	}
	q.jobs = append(q.jobs, job)
	return job, false, nil
}

func (q *InMemoryJobQueue) Jobs() []QueueJob {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.reapExpiredLeasesLocked(time.Now().UTC())
	return slices.Clone(q.jobs)
}

func (q *InMemoryJobQueue) Job(jobID string) (QueueJob, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.reapExpiredLeasesLocked(time.Now().UTC())

	index := q.jobIndexLocked(jobID)
	if index < 0 {
		return QueueJob{}, false
	}
	return q.jobs[index], true
}

func (q *InMemoryJobQueue) DeadLetters() []DeadLetterRecord {
	q.mu.Lock()
	defer q.mu.Unlock()
	return slices.Clone(q.deadLetters)
}

func (q *InMemoryJobQueue) DeadLetter(recordID string) (DeadLetterRecord, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	for _, record := range q.deadLetters {
		if record.ID == recordID {
			return record, true
		}
	}
	return DeadLetterRecord{}, false
}

func (q *InMemoryJobQueue) RecordDeadLetter(job QueueJob, err error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.deadLetters = append(q.deadLetters, deadLetterRecordForJob(job, err, time.Now().UTC()))
	q.failureCount++
}

func (q *InMemoryJobQueue) LeaseReady(now time.Time, limit, maxConcurrency int, leaseTTL time.Duration) []QueueJob {
	q.mu.Lock()
	defer q.mu.Unlock()

	now = now.UTC()
	q.reapExpiredLeasesLocked(now)
	activeLeases := 0
	for _, job := range q.jobs {
		if job.Status == JobLeased || job.Status == JobRunning {
			activeLeases++
		}
	}
	if maxConcurrency > 0 {
		remaining := maxConcurrency - activeLeases
		if remaining <= 0 {
			return nil
		}
		if limit <= 0 || limit > remaining {
			limit = remaining
		}
	} else if limit <= 0 {
		limit = len(q.jobs)
	}

	leased := make([]QueueJob, 0, limit)
	for index := range q.jobs {
		if len(leased) >= limit {
			break
		}
		job := q.jobs[index]
		if job.Status != JobPending || job.NotBefore.After(now) {
			continue
		}
		job.Status = JobLeased
		if leaseTTL > 0 {
			job.LeaseExpiresAt = now.Add(leaseTTL)
		}
		q.jobs[index] = job
		leased = append(leased, job)
	}
	return leased
}

func (q *InMemoryJobQueue) LeaseJob(jobID string, now time.Time, maxConcurrency int, leaseTTL time.Duration) (QueueJob, error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	now = now.UTC()
	q.reapExpiredLeasesLocked(now)

	if maxConcurrency > 0 {
		activeLeases := 0
		for _, job := range q.jobs {
			if job.Status == JobLeased || job.Status == JobRunning {
				activeLeases++
			}
		}
		if activeLeases >= maxConcurrency {
			return QueueJob{}, errors.New("worker concurrency reached")
		}
	}

	index := q.jobIndexLocked(jobID)
	if index < 0 {
		return QueueJob{}, errors.New("job not found")
	}

	job := q.jobs[index]
	if job.Status != JobPending || job.NotBefore.After(now) {
		return QueueJob{}, errors.New("job is not ready")
	}

	job.Status = JobLeased
	if leaseTTL > 0 {
		job.LeaseExpiresAt = now.Add(leaseTTL)
	}
	q.jobs[index] = job
	return job, nil
}

func (q *InMemoryJobQueue) Complete(jobID string) (QueueJob, error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	index := q.jobIndexLocked(jobID)
	if index < 0 {
		return QueueJob{}, errors.New("job not found")
	}
	job := q.jobs[index]
	if isTerminalJobStatus(job.Status) {
		return job, nil
	}
	job.Status = JobSucceeded
	job.LeaseExpiresAt = time.Time{}
	job.LastError = ""
	q.jobs[index] = job
	return job, nil
}

func (q *InMemoryJobQueue) Pause(jobID string) (QueueJob, error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	index := q.jobIndexLocked(jobID)
	if index < 0 {
		return QueueJob{}, errors.New("job not found")
	}
	job := q.jobs[index]
	if isTerminalJobStatus(job.Status) {
		return QueueJob{}, errors.New("job is already terminal")
	}
	job.Status = JobPaused
	job.LeaseExpiresAt = time.Time{}
	q.jobs[index] = job
	return job, nil
}

func (q *InMemoryJobQueue) Resume(jobID string, now time.Time) (QueueJob, error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	index := q.jobIndexLocked(jobID)
	if index < 0 {
		return QueueJob{}, errors.New("job not found")
	}
	job := q.jobs[index]
	if job.Status != JobPaused {
		return QueueJob{}, errors.New("job is not paused")
	}
	job.Status = JobPending
	job.NotBefore = now.UTC()
	job.LeaseExpiresAt = time.Time{}
	q.jobs[index] = job
	return job, nil
}

func (q *InMemoryJobQueue) Cancel(jobID string) (QueueJob, error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	index := q.jobIndexLocked(jobID)
	if index < 0 {
		return QueueJob{}, errors.New("job not found")
	}
	job := q.jobs[index]
	if isTerminalJobStatus(job.Status) {
		return QueueJob{}, errors.New("job is already terminal")
	}
	job.Status = JobCanceled
	job.LeaseExpiresAt = time.Time{}
	q.jobs[index] = job
	return job, nil
}

func (q *InMemoryJobQueue) Fail(jobID string, err error, now time.Time, baseBackoff time.Duration) (QueueJob, *DeadLetterRecord, error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	index := q.jobIndexLocked(jobID)
	if index < 0 {
		return QueueJob{}, nil, errors.New("job not found")
	}
	job := q.jobs[index]
	if isTerminalJobStatus(job.Status) {
		return QueueJob{}, nil, errors.New("job is already terminal")
	}

	now = now.UTC()
	job.AttemptCount++
	job.LastError = ""
	if err != nil {
		job.LastError = err.Error()
	}
	job.LeaseExpiresAt = time.Time{}

	if job.AttemptCount >= job.MaxAttempts {
		job.Status = JobDeadLetter
		record := deadLetterRecordForJob(job, err, now)
		q.jobs[index] = job
		q.deadLetters = append(q.deadLetters, record)
		q.failureCount++
		return job, &record, nil
	}

	job.Status = JobPending
	backoff := baseBackoff
	if backoff <= 0 {
		backoff = time.Second
	}
	job.NotBefore = now.Add(backoff * time.Duration(1<<(job.AttemptCount-1)))
	q.jobs[index] = job
	q.retryCount++
	return job, nil, nil
}

func (q *InMemoryJobQueue) ReplayDeadLetter(recordID, correlationID string, now time.Time) (QueueJob, bool, error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	recordIndex := -1
	for index, record := range q.deadLetters {
		if record.ID == recordID {
			recordIndex = index
			break
		}
	}
	if recordIndex < 0 {
		return QueueJob{}, false, errors.New("dead-letter record not found")
	}

	record := q.deadLetters[recordIndex]
	replayedAt := now.UTC()
	record.ReplayedAt = &replayedAt
	q.deadLetters[recordIndex] = record

	job, err := NewQueueJob(QueueJobInput{
		QueueName:      record.QueueName,
		Type:           record.JobType,
		CorrelationID:  correlationID,
		DeliveryID:     record.DeliveryID,
		InstallationID: record.InstallationID,
		Repository:     record.Repository,
		Subject:        record.Subject,
		DedupeKey:      record.DedupeKey,
		MaxAttempts:    record.MaxAttempts,
		Payload:        record.Payload,
	})
	if err != nil {
		return QueueJob{}, false, err
	}
	if job.CorrelationID == "" {
		job.CorrelationID = record.CorrelationID
	}

	for _, existing := range q.jobs {
		if job.DedupeKey != "" && existing.DedupeKey == job.DedupeKey && isActiveJobStatus(existing.Status) {
			return existing, true, nil
		}
	}

	q.jobs = append(q.jobs, job)
	q.replayCount++
	return job, false, nil
}

func (q *InMemoryJobQueue) Snapshot() JobQueueSnapshot {
	q.mu.Lock()
	defer q.mu.Unlock()

	now := time.Now().UTC()
	q.reapExpiredLeasesLocked(now)

	snapshot := JobQueueSnapshot{
		DeadLetters: len(q.deadLetters),
		Retried:     q.retryCount,
		Failures:    q.failureCount,
		Replays:     q.replayCount,
		ByStatus:    make(map[SyncJobStatus]int),
	}
	for _, job := range q.jobs {
		snapshot.ByStatus[job.Status]++
		switch job.Status {
		case JobPending, JobLeased, JobRunning, JobPaused:
			snapshot.Queued++
		}
		switch job.Status {
		case JobLeased, JobRunning:
			snapshot.ActiveLeases++
		}
	}
	return snapshot
}

func (q *InMemoryJobQueue) ExportState() JobQueueState {
	q.mu.Lock()
	defer q.mu.Unlock()

	now := time.Now().UTC()
	q.reapExpiredLeasesLocked(now)

	return JobQueueState{
		Jobs:         cloneJobs(q.jobs),
		DeadLetters:  cloneDeadLetters(q.deadLetters),
		RetryCount:   q.retryCount,
		FailureCount: q.failureCount,
		ReplayCount:  q.replayCount,
	}
}

func (q *InMemoryJobQueue) RestoreState(state JobQueueState) {
	q.mu.Lock()
	defer q.mu.Unlock()

	q.jobs = cloneJobs(state.Jobs)
	q.deadLetters = cloneDeadLetters(state.DeadLetters)
	q.retryCount = state.RetryCount
	q.failureCount = state.FailureCount
	q.replayCount = state.ReplayCount
}

func (q *InMemoryJobQueue) jobIndexLocked(jobID string) int {
	for index, job := range q.jobs {
		if job.ID == jobID {
			return index
		}
	}
	return -1
}

func (q *InMemoryJobQueue) reapExpiredLeasesLocked(now time.Time) {
	for index, job := range q.jobs {
		if job.Status == JobLeased && !job.LeaseExpiresAt.IsZero() && !job.LeaseExpiresAt.After(now) {
			job.Status = JobPending
			job.LeaseExpiresAt = time.Time{}
			q.jobs[index] = job
		}
	}
}

func deadLetterRecordForJob(job QueueJob, err error, now time.Time) DeadLetterRecord {
	record := DeadLetterRecord{
		ID:             newID(),
		JobID:          job.ID,
		QueueName:      job.QueueName,
		JobType:        job.Type,
		DeliveryID:     job.DeliveryID,
		CorrelationID:  job.CorrelationID,
		InstallationID: job.InstallationID,
		Repository:     job.Repository,
		Subject:        job.Subject,
		DedupeKey:      job.DedupeKey,
		Attempts:       job.AttemptCount,
		MaxAttempts:    job.MaxAttempts,
		ErrorMessage:   "",
		Payload:        append([]byte(nil), job.Payload...),
		CreatedAt:      now.UTC(),
	}
	if err != nil {
		record.ErrorMessage = err.Error()
	}
	return record
}

func isActiveJobStatus(status SyncJobStatus) bool {
	switch status {
	case JobPending, JobLeased, JobRunning, JobPaused:
		return true
	default:
		return false
	}
}

func isTerminalJobStatus(status SyncJobStatus) bool {
	switch status {
	case JobSucceeded, JobDeadLetter, JobCanceled:
		return true
	default:
		return false
	}
}

func cloneJobs(in []QueueJob) []QueueJob {
	out := make([]QueueJob, 0, len(in))
	for _, job := range in {
		job.Payload = append([]byte(nil), job.Payload...)
		out = append(out, job)
	}
	return out
}

func cloneDeadLetters(in []DeadLetterRecord) []DeadLetterRecord {
	out := make([]DeadLetterRecord, 0, len(in))
	for _, record := range in {
		record.Payload = append([]byte(nil), record.Payload...)
		out = append(out, record)
	}
	return out
}
