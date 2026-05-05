package store

import "testing"

func TestNewWebhookDelivery(t *testing.T) {
	delivery, err := NewWebhookDelivery(WebhookDeliveryInput{
		DeliveryID: "delivery-1",
		EventType:  "pull_request",
		Payload:    []byte(`{"action":"opened"}`),
	})
	if err != nil {
		t.Fatalf("NewWebhookDelivery() error = %v", err)
	}
	if delivery.PayloadSHA256 == "" {
		t.Fatal("PayloadSHA256 = empty, want value")
	}
}

func TestInMemoryDeliveryStoreRemember(t *testing.T) {
	store := NewInMemoryDeliveryStore(0)
	delivery, err := NewWebhookDelivery(WebhookDeliveryInput{
		DeliveryID: "delivery-1",
		EventType:  "pull_request",
		Payload:    []byte(`{"action":"opened"}`),
	})
	if err != nil {
		t.Fatalf("NewWebhookDelivery() error = %v", err)
	}

	duplicate, err := store.Remember(delivery)
	if err != nil {
		t.Fatalf("Remember() error = %v", err)
	}
	if duplicate {
		t.Fatal("first Remember() marked duplicate")
	}

	duplicate, err = store.Remember(delivery)
	if err != nil {
		t.Fatalf("Remember() second error = %v", err)
	}
	if !duplicate {
		t.Fatal("second Remember() duplicate = false, want true")
	}
}

func TestNewQueueJob(t *testing.T) {
	job, err := NewQueueJob(QueueJobInput{
		QueueName:   "github-sync",
		Type:        SyncRepositoryJob,
		MaxAttempts: 5,
		Payload: map[string]string{
			"repository": "octo/repo",
		},
	})
	if err != nil {
		t.Fatalf("NewQueueJob() error = %v", err)
	}
	if job.Status != JobPending {
		t.Fatalf("Status = %q, want pending", job.Status)
	}
}
