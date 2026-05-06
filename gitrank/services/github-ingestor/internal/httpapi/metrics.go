package httpapi

import (
	"fmt"
	"io"
	"sort"
	"sync"
	"time"

	"github.com/Ayush3941/gitrank/packages/store"
	"github.com/Ayush3941/gitrank/services/github-ingestor/internal/service"
)

type queueMetricsSource struct {
	service       string
	queueName     string
	deliveryStore store.DeliveryStore
	jobQueue      *store.InMemoryJobQueue
}

type syncMetricsSource struct {
	service string

	mu      sync.Mutex
	entries map[syncMetricKey]*syncMetricValue
}

type persistenceMetricsSource struct {
	service string

	mu             sync.Mutex
	byEntity       map[string]uint64
	byEventType    map[string]uint64
	failureByEvent map[string]uint64
}

type syncMetricKey struct {
	mode   string
	status string
}

type syncMetricValue struct {
	count         uint64
	durationTotal time.Duration
}

func newSyncMetricsSource(service string) *syncMetricsSource {
	return &syncMetricsSource{
		service: service,
		entries: make(map[syncMetricKey]*syncMetricValue),
	}
}

func newPersistenceMetricsSource(service string) *persistenceMetricsSource {
	return &persistenceMetricsSource{
		service:        service,
		byEntity:       make(map[string]uint64),
		byEventType:    make(map[string]uint64),
		failureByEvent: make(map[string]uint64),
	}
}

func (s *syncMetricsSource) Observe(mode, status string, duration time.Duration) {
	if s == nil {
		return
	}

	key := syncMetricKey{
		mode:   mode,
		status: status,
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	current, ok := s.entries[key]
	if !ok {
		current = &syncMetricValue{}
		s.entries[key] = current
	}
	current.count++
	current.durationTotal += duration
}

func (s *syncMetricsSource) WritePrometheus(w io.Writer) {
	if s == nil {
		return
	}

	_, _ = fmt.Fprintf(w, "# HELP gitrank_sync_requests_total Total manual sync requests observed by this service.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_sync_requests_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_sync_duration_ms_sum Sum of manual sync request duration in milliseconds.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_sync_duration_ms_sum counter\n")

	s.mu.Lock()
	keys := make([]syncMetricKey, 0, len(s.entries))
	for key := range s.entries {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].mode != keys[j].mode {
			return keys[i].mode < keys[j].mode
		}
		return keys[i].status < keys[j].status
	})
	snapshots := make([]struct {
		key   syncMetricKey
		value syncMetricValue
	}, 0, len(keys))
	for _, key := range keys {
		snapshots = append(snapshots, struct {
			key   syncMetricKey
			value syncMetricValue
		}{
			key:   key,
			value: *s.entries[key],
		})
	}
	service := s.service
	s.mu.Unlock()

	for _, snapshot := range snapshots {
		_, _ = fmt.Fprintf(
			w,
			`gitrank_sync_requests_total{service=%q,mode=%q,status=%q} %d`+"\n",
			service,
			snapshot.key.mode,
			snapshot.key.status,
			snapshot.value.count,
		)
		_, _ = fmt.Fprintf(
			w,
			`gitrank_sync_duration_ms_sum{service=%q,mode=%q,status=%q} %.3f`+"\n",
			service,
			snapshot.key.mode,
			snapshot.key.status,
			float64(snapshot.value.durationTotal.Microseconds())/1000.0,
		)
	}
}

func (s *persistenceMetricsSource) Observe(eventType string, result service.PersistResult) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	s.byEventType[eventType]++
	for entity, count := range result.EntityCounts() {
		if count > 0 {
			s.byEntity[entity] += uint64(count)
		}
	}
}

func (s *persistenceMetricsSource) ObserveFailure(eventType string) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failureByEvent[eventType]++
}

func (s *persistenceMetricsSource) WritePrometheus(w io.Writer) {
	if s == nil {
		return
	}

	_, _ = fmt.Fprintf(w, "# HELP gitrank_github_entities_persisted_total Total normalized GitHub entities persisted by entity type.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_github_entities_persisted_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_github_webhook_persistence_total Total persisted webhook deliveries by event type.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_github_webhook_persistence_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_github_webhook_persistence_failures_total Total webhook persistence failures by event type.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_github_webhook_persistence_failures_total counter\n")

	s.mu.Lock()
	entityKeys := sortedKeysUint64(s.byEntity)
	eventKeys := sortedKeysUint64(s.byEventType)
	failureKeys := sortedKeysUint64(s.failureByEvent)
	serviceName := s.service
	entities := cloneMap(s.byEntity)
	events := cloneMap(s.byEventType)
	failures := cloneMap(s.failureByEvent)
	s.mu.Unlock()

	for _, key := range entityKeys {
		_, _ = fmt.Fprintf(w, `gitrank_github_entities_persisted_total{service=%q,entity=%q} %d`+"\n", serviceName, key, entities[key])
	}
	for _, key := range eventKeys {
		_, _ = fmt.Fprintf(w, `gitrank_github_webhook_persistence_total{service=%q,event_type=%q} %d`+"\n", serviceName, key, events[key])
	}
	for _, key := range failureKeys {
		_, _ = fmt.Fprintf(w, `gitrank_github_webhook_persistence_failures_total{service=%q,event_type=%q} %d`+"\n", serviceName, key, failures[key])
	}
}

func sortedKeysUint64(values map[string]uint64) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func cloneMap(values map[string]uint64) map[string]uint64 {
	out := make(map[string]uint64, len(values))
	for key, value := range values {
		out[key] = value
	}
	return out
}

func (s queueMetricsSource) WritePrometheus(w io.Writer) {
	jobSnapshot := store.JobQueueSnapshot{}
	if s.jobQueue != nil {
		jobSnapshot = s.jobQueue.Snapshot()
	}
	deliverySnapshot := store.DeliveryStoreSnapshot{}
	if s.deliveryStore != nil {
		snapshot, err := s.deliveryStore.Snapshot(time.Now().UTC())
		if err == nil {
			deliverySnapshot = snapshot
		}
	}

	_, _ = fmt.Fprintf(w, "# HELP gitrank_queue_depth Current queued GitHub sync jobs.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_queue_depth gauge\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_queue_dead_letters Current dead-lettered GitHub sync jobs.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_queue_dead_letters gauge\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_webhook_deliveries_tracked Current tracked webhook deliveries by status.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_webhook_deliveries_tracked gauge\n")

	_, _ = fmt.Fprintf(
		w,
		`gitrank_queue_depth{service=%q,queue=%q} %d`+"\n",
		s.service,
		s.queueName,
		jobSnapshot.Queued,
	)
	_, _ = fmt.Fprintf(
		w,
		`gitrank_queue_dead_letters{service=%q,queue=%q} %d`+"\n",
		s.service,
		s.queueName,
		jobSnapshot.DeadLetters,
	)

	if len(deliverySnapshot.ByStatus) == 0 {
		_, _ = fmt.Fprintf(
			w,
			`gitrank_webhook_deliveries_tracked{service=%q,status=%q} %d`+"\n",
			s.service,
			"none",
			0,
		)
		return
	}

	statuses := make([]string, 0, len(deliverySnapshot.ByStatus))
	for status := range deliverySnapshot.ByStatus {
		statuses = append(statuses, string(status))
	}
	sort.Strings(statuses)
	for _, status := range statuses {
		_, _ = fmt.Fprintf(
			w,
			`gitrank_webhook_deliveries_tracked{service=%q,status=%q} %d`+"\n",
			s.service,
			status,
			deliverySnapshot.ByStatus[store.WebhookDeliveryStatus(status)],
		)
	}
}
