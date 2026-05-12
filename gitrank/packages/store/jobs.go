package store

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

type SyncJobType string

const (
	SyncInstallationJob       SyncJobType = "sync.installation"
	SyncRepositoryJob         SyncJobType = "sync.repository"
	SyncUserHistoryJob        SyncJobType = "sync.user_history"
	SyncPullRequestJob        SyncJobType = "sync.pull_request"
	SyncReviewJob             SyncJobType = "sync.review"
	SyncIssueJob              SyncJobType = "sync.issue"
	SyncCommitJob             SyncJobType = "sync.commit"
	AnalysisPullRequestJob    SyncJobType = "analysis.pull_request"
	ScoreReplayUserJob        SyncJobType = "score.replay_user"
	ProfileRefreshUserJob     SyncJobType = "profile.refresh_user"
	ReportMaterializePRJob    SyncJobType = "report.materialize_pull_request"
	ReportBackfillUserPRsJob  SyncJobType = "report.backfill_user_pull_requests"
	LeaderboardMaterializeJob SyncJobType = "leaderboard.materialize_season"
	GradePullRequestJob       SyncJobType = "pipeline.grade_pull_request"
	RepairWebhookJob          SyncJobType = "repair.webhook_delivery"
)

type SyncJobStatus string

const (
	JobPending    SyncJobStatus = "pending"
	JobLeased     SyncJobStatus = "leased"
	JobRunning    SyncJobStatus = "running"
	JobSucceeded  SyncJobStatus = "succeeded"
	JobFailed     SyncJobStatus = "failed"
	JobDeadLetter SyncJobStatus = "dead_letter"
	JobPaused     SyncJobStatus = "paused"
	JobCanceled   SyncJobStatus = "canceled"
)

type QueueJob struct {
	ID             string          `json:"id"`
	QueueName      string          `json:"queue_name"`
	Type           SyncJobType     `json:"type"`
	Status         SyncJobStatus   `json:"status"`
	CorrelationID  string          `json:"correlation_id,omitempty"`
	DeliveryID     string          `json:"delivery_id,omitempty"`
	InstallationID int64           `json:"installation_id,omitempty"`
	Repository     string          `json:"repository,omitempty"`
	Subject        string          `json:"subject,omitempty"`
	DedupeKey      string          `json:"dedupe_key,omitempty"`
	AttemptCount   int             `json:"attempt_count"`
	MaxAttempts    int             `json:"max_attempts"`
	ScheduledAt    time.Time       `json:"scheduled_at"`
	NotBefore      time.Time       `json:"not_before"`
	LeaseExpiresAt time.Time       `json:"lease_expires_at,omitempty"`
	LastError      string          `json:"last_error,omitempty"`
	Payload        json.RawMessage `json:"payload"`
}

type DeadLetterRecord struct {
	ID             string          `json:"id"`
	JobID          string          `json:"job_id"`
	QueueName      string          `json:"queue_name"`
	JobType        SyncJobType     `json:"job_type"`
	DeliveryID     string          `json:"delivery_id,omitempty"`
	CorrelationID  string          `json:"correlation_id,omitempty"`
	InstallationID int64           `json:"installation_id,omitempty"`
	Repository     string          `json:"repository,omitempty"`
	Subject        string          `json:"subject,omitempty"`
	DedupeKey      string          `json:"dedupe_key,omitempty"`
	Attempts       int             `json:"attempts"`
	MaxAttempts    int             `json:"max_attempts"`
	ErrorMessage   string          `json:"error_message"`
	Payload        json.RawMessage `json:"payload"`
	CreatedAt      time.Time       `json:"created_at"`
	ReplayedAt     *time.Time      `json:"replayed_at,omitempty"`
}

type QueueJobInput struct {
	QueueName      string
	Type           SyncJobType
	CorrelationID  string
	DeliveryID     string
	InstallationID int64
	Repository     string
	Subject        string
	DedupeKey      string
	MaxAttempts    int
	ScheduledAt    time.Time
	NotBefore      time.Time
	Payload        any
}

func NewQueueJob(input QueueJobInput) (QueueJob, error) {
	if strings.TrimSpace(input.QueueName) == "" {
		return QueueJob{}, errors.New("queue name is required")
	}
	if input.Type == "" {
		return QueueJob{}, errors.New("job type is required")
	}
	if input.MaxAttempts <= 0 {
		return QueueJob{}, errors.New("max attempts must be positive")
	}

	payload, err := json.Marshal(input.Payload)
	if err != nil {
		return QueueJob{}, err
	}

	now := time.Now().UTC()
	scheduledAt := input.ScheduledAt.UTC()
	if scheduledAt.IsZero() {
		scheduledAt = now
	}
	notBefore := input.NotBefore.UTC()
	if notBefore.IsZero() {
		notBefore = scheduledAt
	}

	return QueueJob{
		ID:             newID(),
		QueueName:      input.QueueName,
		Type:           input.Type,
		Status:         JobPending,
		CorrelationID:  strings.TrimSpace(input.CorrelationID),
		DeliveryID:     strings.TrimSpace(input.DeliveryID),
		InstallationID: input.InstallationID,
		Repository:     strings.TrimSpace(input.Repository),
		Subject:        strings.TrimSpace(input.Subject),
		DedupeKey:      strings.TrimSpace(input.DedupeKey),
		AttemptCount:   0,
		MaxAttempts:    input.MaxAttempts,
		ScheduledAt:    scheduledAt,
		NotBefore:      notBefore,
		Payload:        payload,
	}, nil
}

func SupportedSyncJobTypes() []SyncJobType {
	return []SyncJobType{
		SyncInstallationJob,
		SyncRepositoryJob,
		SyncUserHistoryJob,
		SyncPullRequestJob,
		SyncReviewJob,
		SyncIssueJob,
		SyncCommitJob,
		AnalysisPullRequestJob,
		ScoreReplayUserJob,
		ProfileRefreshUserJob,
		ReportMaterializePRJob,
		ReportBackfillUserPRsJob,
		LeaderboardMaterializeJob,
		GradePullRequestJob,
		RepairWebhookJob,
	}
}

func newID() string {
	var bytes [16]byte
	_, _ = rand.Read(bytes[:])
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	return fmt.Sprintf(
		"%08x-%04x-%04x-%04x-%012x",
		bytes[0:4],
		bytes[4:6],
		bytes[6:8],
		bytes[8:10],
		bytes[10:16],
	)
}
