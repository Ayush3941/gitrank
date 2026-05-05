package contracts

import "time"

type GitHubWebhookReceipt struct {
	DeliveryID      string   `json:"delivery_id"`
	EventType       string   `json:"event_type"`
	Action          string   `json:"action,omitempty"`
	Repository      string   `json:"repository,omitempty"`
	Installation    int64    `json:"installation,omitempty"`
	SignatureOK     bool     `json:"signature_ok"`
	ReplayProtected bool     `json:"replay_protected"`
	Deduplicated    bool     `json:"deduplicated"`
	DeliveryStatus  string   `json:"delivery_status"`
	JobIDs          []string `json:"job_ids,omitempty"`
	QueueName       string   `json:"queue_name,omitempty"`
}

type GitHubQueuePreview struct {
	Status        string    `json:"status"`
	JobIDs        []string  `json:"job_ids,omitempty"`
	JobTypes      []string  `json:"job_types,omitempty"`
	QueueName     string    `json:"queue_name"`
	CorrelationID string    `json:"correlation_id,omitempty"`
	Deduplicated  bool      `json:"deduplicated"`
	AcceptedAt    time.Time `json:"accepted_at"`
}
