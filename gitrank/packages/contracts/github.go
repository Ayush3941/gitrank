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

type GitHubSyncRunFilter struct {
	RunType                string `json:"run_type,omitempty"`
	Status                 string `json:"status,omitempty"`
	Subject                string `json:"subject,omitempty"`
	Repository             string `json:"repository,omitempty"`
	User                   string `json:"user,omitempty"`
	RequestedBySubject     string `json:"requested_by_subject,omitempty"`
	RequestedByGitHubLogin string `json:"requested_by_github_login,omitempty"`
	CorrelationID          string `json:"correlation_id,omitempty"`
	DeliveryID             string `json:"delivery_id,omitempty"`
	Limit                  int    `json:"limit,omitempty"`
}

type GitHubSyncRunView struct {
	ID                     string         `json:"id"`
	RunType                string         `json:"run_type"`
	Status                 string         `json:"status"`
	Subject                string         `json:"subject,omitempty"`
	RequestedRepository    string         `json:"requested_repository,omitempty"`
	RequestedUser          string         `json:"requested_user,omitempty"`
	RequestedBySubject     string         `json:"requested_by_subject,omitempty"`
	RequestedByGitHubLogin string         `json:"requested_by_github_login,omitempty"`
	Installation           int64          `json:"installation,omitempty"`
	DeliveryID             string         `json:"delivery_id,omitempty"`
	CorrelationID          string         `json:"correlation_id,omitempty"`
	StartedAt              time.Time      `json:"started_at"`
	FinishedAt             *time.Time     `json:"finished_at,omitempty"`
	LastError              string         `json:"last_error,omitempty"`
	Metrics                map[string]int `json:"metrics,omitempty"`
}

type GitHubSyncRunListResponse struct {
	Runs          []GitHubSyncRunView `json:"runs,omitempty"`
	AppliedFilter GitHubSyncRunFilter `json:"applied_filter,omitempty"`
	LastUpdatedAt time.Time           `json:"last_updated_at"`
}
