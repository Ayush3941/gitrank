package httpapi

import (
	"fmt"
	"io"
	"sort"
	"time"

	"github.com/Ayush3941/gitrank/packages/store"
)

type queueMetricsSource struct {
	service       string
	queueName     string
	deliveryStore *store.InMemoryDeliveryStore
	jobQueue      *store.InMemoryJobQueue
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
