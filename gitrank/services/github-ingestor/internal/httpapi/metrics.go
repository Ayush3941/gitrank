package httpapi

import (
	"fmt"
	"io"
	"sort"
	"sync"
	"time"

	"github.com/Ayush3941/gitrank/packages/store"
)

type queueMetricsSource struct {
	service       string
	queueName     string
	deliveryStore *store.InMemoryDeliveryStore
	jobQueue      *store.InMemoryJobQueue
}

type syncMetricsSource struct {
	service string

	mu      sync.Mutex
	entries map[syncMetricKey]*syncMetricValue
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

func (s queueMetricsSource) WritePrometheus(w io.Writer) {
	jobSnapshot := store.JobQueueSnapshot{}
	if s.jobQueue != nil {
		jobSnapshot = s.jobQueue.Snapshot()
	}
	deliverySnapshot := store.DeliveryStoreSnapshot{}
	if s.deliveryStore != nil {
		deliverySnapshot = s.deliveryStore.Snapshot(time.Now().UTC())
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
