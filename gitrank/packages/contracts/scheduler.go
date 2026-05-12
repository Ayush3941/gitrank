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

type SchedulerBackfillPlanRequest struct {
	Name    string        `json:"name,omitempty"`
	Cron    string        `json:"cron,omitempty"`
	Enabled *bool         `json:"enabled,omitempty"`
	Targets []SyncRequest `json:"targets"`
}

type SchedulerJobFailureRequest struct {
	ErrorMessage string `json:"error_message,omitempty"`
}

type SchedulerTickResponse struct {
	Status             string    `json:"status"`
	DuePlans           int       `json:"due_plans"`
	ExecutedPlans      int       `json:"executed_plans"`
	QueuedJobs         int       `json:"queued_jobs"`
	DeduplicatedJobs   int       `json:"deduplicated_jobs"`
	RateLimitedTargets int       `json:"rate_limited_targets"`
	LastTickAt         time.Time `json:"last_tick_at"`
}

type SchedulerJobFilter struct {
	Type           string `json:"type,omitempty"`
	Status         string `json:"status,omitempty"`
	Repository     string `json:"repository,omitempty"`
	User           string `json:"user,omitempty"`
	Subject        string `json:"subject,omitempty"`
	CorrelationID  string `json:"correlation_id,omitempty"`
	InstallationID int64  `json:"installation_id,omitempty"`
}

type SchedulerQueueStatusResponse struct {
	QueueName     string             `json:"queue_name"`
	QueueDepth    int                `json:"queue_depth"`
	ActiveLeases  int                `json:"active_leases"`
	DeadLetters   int                `json:"dead_letters"`
	Retried       int                `json:"retried"`
	Failures      int                `json:"failures"`
	Replays       int                `json:"replays"`
	VisibleJobs   int                `json:"visible_jobs"`
	AppliedFilter SchedulerJobFilter `json:"applied_filter,omitempty"`
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

type SchedulerRunResponse struct {
	QueueName      string                                 `json:"queue_name"`
	Status         string                                 `json:"status"`
	Job            *SchedulerJobView                      `json:"job,omitempty"`
	Execution      *GitHubSyncExecutionResponse           `json:"execution,omitempty"`
	Analysis       *SchedulerPullRequestAnalysisResponse  `json:"analysis,omitempty"`
	ScoreReplay    *SchedulerScoreReplayExecutionResponse `json:"score_replay,omitempty"`
	ProfileRefresh *SchedulerProfileRefreshResponse       `json:"profile_refresh,omitempty"`
	Grade          *SchedulerPullRequestGradeResponse     `json:"grade,omitempty"`
	LastUpdatedAt  time.Time                              `json:"last_updated_at"`
}

type SchedulerPullRequestAnalysisResponse struct {
	Status          string    `json:"status"`
	Repository      string    `json:"repository"`
	Number          int       `json:"number"`
	PullRequestID   string    `json:"pull_request_id"`
	AnalysisID      string    `json:"analysis_id"`
	AnalyzerVersion string    `json:"analyzer_version"`
	AnalysisSource  string    `json:"analysis_source"`
	Category        string    `json:"category"`
	CorrelationID   string    `json:"correlation_id,omitempty"`
	StartedAt       time.Time `json:"started_at"`
	FinishedAt      time.Time `json:"finished_at"`
}

type SchedulerScoreReplayExecutionResponse struct {
	Status        string    `json:"status"`
	UserID        string    `json:"user_id"`
	ReplayRunID   string    `json:"replay_run_id"`
	ScoreVersion  string    `json:"score_version"`
	TriggerType   string    `json:"trigger_type"`
	TotalXP       int       `json:"total_xp"`
	EventCount    int       `json:"event_count"`
	BadgeCount    int       `json:"badge_count"`
	CorrelationID string    `json:"correlation_id,omitempty"`
	StartedAt     time.Time `json:"started_at"`
	FinishedAt    time.Time `json:"finished_at"`
}

type SchedulerProfileRefreshResponse struct {
	Status                 string    `json:"status"`
	UserID                 string    `json:"user_id"`
	ProfileSnapshotID      string    `json:"profile_snapshot_id"`
	ProfileSnapshotVersion string    `json:"profile_snapshot_version"`
	ScoreVersion           string    `json:"score_version,omitempty"`
	TotalXP                int       `json:"total_xp"`
	LevelLabel             string    `json:"level_label"`
	SourceWatermark        time.Time `json:"source_watermark"`
	RefreshedAt            time.Time `json:"refreshed_at"`
	StaleAfter             time.Time `json:"stale_after"`
	CorrelationID          string    `json:"correlation_id,omitempty"`
	StartedAt              time.Time `json:"started_at"`
	FinishedAt             time.Time `json:"finished_at"`
}

type SchedulerPullRequestReportResponse struct {
	Status          string    `json:"status"`
	Repository      string    `json:"repository"`
	Number          int       `json:"number"`
	ContributionID  string    `json:"contribution_id"`
	EvidenceStatus  string    `json:"evidence_status,omitempty"`
	ScoreVersion    string    `json:"score_version,omitempty"`
	AnalysisVersion string    `json:"analysis_version,omitempty"`
	IsStale         bool      `json:"is_stale"`
	GeneratedAt     time.Time `json:"generated_at"`
}

type SchedulerPullRequestGradeResponse struct {
	Status         string                                 `json:"status"`
	Repository     string                                 `json:"repository"`
	Number         int                                    `json:"number"`
	UserID         string                                 `json:"user_id"`
	Sync           *GitHubSyncExecutionResponse           `json:"sync,omitempty"`
	Analysis       *SchedulerPullRequestAnalysisResponse  `json:"analysis,omitempty"`
	ScoreReplay    *SchedulerScoreReplayExecutionResponse `json:"score_replay,omitempty"`
	ProfileRefresh *SchedulerProfileRefreshResponse       `json:"profile_refresh,omitempty"`
	Report         *SchedulerPullRequestReportResponse    `json:"report,omitempty"`
	CorrelationID  string                                 `json:"correlation_id,omitempty"`
	StartedAt      time.Time                              `json:"started_at"`
	FinishedAt     time.Time                              `json:"finished_at"`
}

type SchedulerDeadLetterListResponse struct {
	QueueName     string                 `json:"queue_name"`
	Records       []DeadLetterRecordView `json:"records,omitempty"`
	LastUpdatedAt time.Time              `json:"last_updated_at"`
}

type SchedulerBackfillPlanListResponse struct {
	Plans         []SchedulerBackfillPlanView `json:"plans,omitempty"`
	LastUpdatedAt time.Time                   `json:"last_updated_at"`
}

type SchedulerBackfillPlanActionResponse struct {
	Status        string                    `json:"status"`
	Plan          SchedulerBackfillPlanView `json:"plan"`
	CorrelationID string                    `json:"correlation_id,omitempty"`
	AffectedJobs  int                       `json:"affected_jobs,omitempty"`
	LastUpdatedAt time.Time                 `json:"last_updated_at"`
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

type SchedulerBackfillPlanView struct {
	ID                string        `json:"id"`
	Name              string        `json:"name,omitempty"`
	Cron              string        `json:"cron"`
	Enabled           bool          `json:"enabled"`
	Targets           []SyncRequest `json:"targets,omitempty"`
	TargetCount       int           `json:"target_count"`
	LastRunAt         *time.Time    `json:"last_run_at,omitempty"`
	NextRunAt         time.Time     `json:"next_run_at"`
	QueuedJobsTotal   int           `json:"queued_jobs_total"`
	DeduplicatedTotal int           `json:"deduplicated_total"`
	RateLimitedTotal  int           `json:"rate_limited_total"`
	CreatedAt         time.Time     `json:"created_at"`
	UpdatedAt         time.Time     `json:"updated_at"`
	LastCorrelationID string        `json:"last_correlation_id,omitempty"`
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
