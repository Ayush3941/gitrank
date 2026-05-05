package contracts

import "time"

type SchedulerEnqueueResponse struct {
	Status        string    `json:"status"`
	JobIDs        []string  `json:"job_ids,omitempty"`
	QueueName     string    `json:"queue_name"`
	CorrelationID string    `json:"correlation_id,omitempty"`
	Deduplicated  bool      `json:"deduplicated"`
	AcceptedAt    time.Time `json:"accepted_at"`
}

type SchedulerLeaseRequest struct {
	Limit int `json:"limit,omitempty"`
}

type SchedulerJobFailureRequest struct {
	ErrorMessage string `json:"error_message,omitempty"`
}

type SchedulerQueueStatusResponse struct {
	QueueName     string             `json:"queue_name"`
	QueueDepth    int                `json:"queue_depth"`
	ActiveLeases  int                `json:"active_leases"`
	DeadLetters   int                `json:"dead_letters"`
	Retried       int                `json:"retried"`
	Failures      int                `json:"failures"`
	Replays       int                `json:"replays"`
	Jobs          []SchedulerJobView `json:"jobs,omitempty"`
	LastUpdatedAt time.Time          `json:"last_updated_at"`
}

type SchedulerLeaseResponse struct {
	QueueName     string             `json:"queue_name"`
	QueueDepth    int                `json:"queue_depth"`
	ActiveLeases  int                `json:"active_leases"`
	Jobs          []SchedulerJobView `json:"jobs,omitempty"`
	LastUpdatedAt time.Time          `json:"last_updated_at"`
}

type SchedulerJobActionResponse struct {
	QueueName     string           `json:"queue_name"`
	Status        string           `json:"status"`
	Deduplicated  bool             `json:"deduplicated,omitempty"`
	DeadLetterID  string           `json:"dead_letter_id,omitempty"`
	Job           SchedulerJobView `json:"job"`
	LastUpdatedAt time.Time        `json:"last_updated_at"`
}

type SchedulerDeadLetterListResponse struct {
	QueueName     string                 `json:"queue_name"`
	Records       []DeadLetterRecordView `json:"records,omitempty"`
	LastUpdatedAt time.Time              `json:"last_updated_at"`
}

type SchedulerJobView struct {
	ID             string    `json:"id"`
	QueueName      string    `json:"queue_name"`
	Type           string    `json:"type"`
	Status         string    `json:"status"`
	CorrelationID  string    `json:"correlation_id,omitempty"`
	DeliveryID     string    `json:"delivery_id,omitempty"`
	InstallationID int64     `json:"installation_id,omitempty"`
	Repository     string    `json:"repository,omitempty"`
	Subject        string    `json:"subject,omitempty"`
	DedupeKey      string    `json:"dedupe_key,omitempty"`
	AttemptCount   int       `json:"attempt_count"`
	MaxAttempts    int       `json:"max_attempts"`
	ScheduledAt    time.Time `json:"scheduled_at"`
	NotBefore      time.Time `json:"not_before"`
	LeaseExpiresAt time.Time `json:"lease_expires_at,omitempty"`
	LastError      string    `json:"last_error,omitempty"`
}

type DeadLetterRecordView struct {
	ID             string     `json:"id"`
	JobID          string     `json:"job_id"`
	QueueName      string     `json:"queue_name"`
	JobType        string     `json:"job_type"`
	DeliveryID     string     `json:"delivery_id,omitempty"`
	CorrelationID  string     `json:"correlation_id,omitempty"`
	InstallationID int64      `json:"installation_id,omitempty"`
	Repository     string     `json:"repository,omitempty"`
	Subject        string     `json:"subject,omitempty"`
	DedupeKey      string     `json:"dedupe_key,omitempty"`
	Attempts       int        `json:"attempts"`
	MaxAttempts    int        `json:"max_attempts"`
	ErrorMessage   string     `json:"error_message"`
	CreatedAt      time.Time  `json:"created_at"`
	ReplayedAt     *time.Time `json:"replayed_at,omitempty"`
}
