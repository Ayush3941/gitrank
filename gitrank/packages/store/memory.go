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

func (s *InMemoryDeliveryStore) Lookup(deliveryID string) (WebhookDelivery, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.pruneLocked(time.Now().UTC())
	delivery, ok := s.entries[deliveryID]
	if !ok {
		return WebhookDelivery{}, false
	}
	return delivery, true
}

func (s *InMemoryDeliveryStore) pruneLocked(now time.Time) {
	for id, delivery := range s.entries {
		if now.Sub(delivery.ReceivedAt) > s.ttl {
			delete(s.entries, id)
		}
	}
}

func (s *InMemoryDeliveryStore) Snapshot(now time.Time) DeliveryStoreSnapshot {
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
	return snapshot
}

type InMemoryJobQueue struct {
	mu          sync.Mutex
	jobs        []QueueJob
	deadLetters []DeadLetterRecord
}

type JobQueueSnapshot struct {
	Queued      int
	DeadLetters int
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

func (q *InMemoryJobQueue) Jobs() []QueueJob {
	q.mu.Lock()
	defer q.mu.Unlock()
	return slices.Clone(q.jobs)
}

func (q *InMemoryJobQueue) DeadLetters() []DeadLetterRecord {
	q.mu.Lock()
	defer q.mu.Unlock()
	return slices.Clone(q.deadLetters)
}

func (q *InMemoryJobQueue) RecordDeadLetter(job QueueJob, err error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	record := DeadLetterRecord{
		ID:            newID(),
		JobID:         job.ID,
		JobType:       job.Type,
		DeliveryID:    job.DeliveryID,
		CorrelationID: job.CorrelationID,
		Attempts:      job.AttemptCount,
		ErrorMessage:  "",
		Payload:       append([]byte(nil), job.Payload...),
		CreatedAt:     time.Now().UTC(),
	}
	if err != nil {
		record.ErrorMessage = err.Error()
	}
	q.deadLetters = append(q.deadLetters, record)
}

func (q *InMemoryJobQueue) Snapshot() JobQueueSnapshot {
	q.mu.Lock()
	defer q.mu.Unlock()
	return JobQueueSnapshot{
		Queued:      len(q.jobs),
		DeadLetters: len(q.deadLetters),
	}
}
