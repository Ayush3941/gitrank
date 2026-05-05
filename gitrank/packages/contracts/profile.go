package contracts

import "time"

type ProfileSchemaResponse struct {
	Sections []ProfileSection `json:"sections"`
}

type ProfileSection struct {
	Key     string `json:"key"`
	Summary string `json:"summary"`
	Status  string `json:"status"`
}

type PublicProfileSummary struct {
	Handle             string    `json:"handle"`
	DisplayName        string    `json:"display_name"`
	AvatarURL          string    `json:"avatar_url,omitempty"`
	Bio                string    `json:"bio,omitempty"`
	TotalXP            int       `json:"total_xp"`
	StrengthSummary    string    `json:"strength_summary"`
	TopSkills          []string  `json:"top_skills,omitempty"`
	BadgesEarned       int       `json:"badges_earned"`
	MergedPullRequests int       `json:"merged_pull_requests"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type ProfileTimeWindow struct {
	Label   string    `json:"label"`
	Bucket  string    `json:"bucket"`
	StartAt time.Time `json:"start_at"`
	EndAt   time.Time `json:"end_at"`
}

type ProfileTimelinePoint struct {
	BucketStart time.Time `json:"bucket_start"`
	BucketEnd   time.Time `json:"bucket_end"`
	DeltaXP     int       `json:"delta_xp"`
	TotalXP     int       `json:"total_xp"`
}

type ProfileTimeline struct {
	Window    ProfileTimeWindow      `json:"window"`
	Points    []ProfileTimelinePoint `json:"points"`
	UpdatedAt time.Time              `json:"updated_at"`
}

type SkillAreaView struct {
	Key        string  `json:"key"`
	TotalXP    int     `json:"total_xp"`
	Percentage float64 `json:"percentage"`
	Summary    string  `json:"summary,omitempty"`
}

type TopRepositoryView struct {
	FullName           string    `json:"full_name"`
	Owner              string    `json:"owner"`
	Name               string    `json:"name"`
	TotalXP            int       `json:"total_xp"`
	ContributionCount  int       `json:"contribution_count"`
	MergedPullRequests int       `json:"merged_pull_requests"`
	PrimarySkill       string    `json:"primary_skill,omitempty"`
	LastContributionAt time.Time `json:"last_contribution_at"`
	Visibility         string    `json:"visibility"`
}

type ProfileLevelView struct {
	Label        string `json:"label"`
	CurrentLevel int    `json:"current_level"`
	CurrentXP    int    `json:"current_xp"`
	NextLevelXP  int    `json:"next_level_xp"`
	RankTier     string `json:"rank_tier"`
}

type BadgeView struct {
	Key         string         `json:"key"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	AwardedAt   time.Time      `json:"awarded_at"`
	Evidence    map[string]any `json:"evidence,omitempty"`
}

type PullRequestReference struct {
	Repository string `json:"repository"`
	Number     int    `json:"number"`
	Title      string `json:"title,omitempty"`
}

type ScoreHistoryEntry struct {
	EventID     string                `json:"event_id"`
	EventType   string                `json:"event_type"`
	DeltaXP     int                   `json:"delta_xp"`
	CreatedAt   time.Time             `json:"created_at"`
	PullRequest *PullRequestReference `json:"pull_request,omitempty"`
	Explanation []string              `json:"explanation,omitempty"`
}

type ProfilePrivacySettings struct {
	PublicProfileEnabled         bool `json:"public_profile_enabled"`
	ShowExactPRs                 bool `json:"show_exact_prs"`
	ShowAISummaries              bool `json:"show_ai_summaries"`
	ShowLeaderboardParticipation bool `json:"show_leaderboard_participation"`
}

type RepositoryVisibilityView struct {
	FullName   string `json:"full_name"`
	Visibility string `json:"visibility"`
	Reason     string `json:"reason,omitempty"`
}

type ProfileStaleness struct {
	RefreshedAt             time.Time `json:"refreshed_at"`
	StaleAfter              time.Time `json:"stale_after"`
	SourceWatermark         time.Time `json:"source_watermark"`
	IsStale                 bool      `json:"is_stale"`
	PartialProfileAvailable bool      `json:"partial_profile_available"`
}

type ShareableProfileCard struct {
	Handle      string           `json:"handle"`
	DisplayName string           `json:"display_name"`
	AvatarURL   string           `json:"avatar_url,omitempty"`
	Headline    string           `json:"headline"`
	Level       ProfileLevelView `json:"level"`
	TotalXP     int              `json:"total_xp"`
	TopSkills   []string         `json:"top_skills,omitempty"`
	BadgeKeys   []string         `json:"badge_keys,omitempty"`
	RefreshedAt time.Time        `json:"refreshed_at"`
}

type PublicProfileResponse struct {
	Summary         PublicProfileSummary `json:"summary"`
	TopSkillAreas   []SkillAreaView      `json:"top_skill_areas,omitempty"`
	TopRepositories []TopRepositoryView  `json:"top_repositories,omitempty"`
	Level           ProfileLevelView     `json:"level"`
	Badges          []BadgeView          `json:"badges,omitempty"`
	ScoreHistory    []ScoreHistoryEntry  `json:"score_history,omitempty"`
	Timeline        ProfileTimeline      `json:"timeline"`
	ShareCard       ShareableProfileCard `json:"share_card"`
	Staleness       ProfileStaleness     `json:"staleness"`
}

type PrivateProfileResponse struct {
	Summary              PublicProfileSummary       `json:"summary"`
	TopSkillAreas        []SkillAreaView            `json:"top_skill_areas,omitempty"`
	TopRepositories      []TopRepositoryView        `json:"top_repositories,omitempty"`
	Level                ProfileLevelView           `json:"level"`
	Badges               []BadgeView                `json:"badges,omitempty"`
	Timeline             ProfileTimeline            `json:"timeline"`
	ScoreHistory         []ScoreHistoryEntry        `json:"score_history,omitempty"`
	Privacy              ProfilePrivacySettings     `json:"privacy"`
	RepositoryVisibility []RepositoryVisibilityView `json:"repository_visibility,omitempty"`
	ShareCard            ShareableProfileCard       `json:"share_card"`
	Staleness            ProfileStaleness           `json:"staleness"`
}

type UpdateProfilePrivacyRequest struct {
	PublicProfileEnabled         *bool `json:"public_profile_enabled,omitempty"`
	ShowExactPRs                 *bool `json:"show_exact_prs,omitempty"`
	ShowAISummaries              *bool `json:"show_ai_summaries,omitempty"`
	ShowLeaderboardParticipation *bool `json:"show_leaderboard_participation,omitempty"`
}

type UpdateRepositoryVisibilityRequest struct {
	Visibility string `json:"visibility"`
	Reason     string `json:"reason,omitempty"`
}

type SchedulerConfigResponse struct {
	SyncCron                  string   `json:"sync_cron"`
	MaxAttempts               int      `json:"max_attempts"`
	RetryBackoff              string   `json:"retry_backoff"`
	WorkerConcurrency         int      `json:"worker_concurrency"`
	LeaseTTL                  string   `json:"lease_ttl"`
	PollInterval              string   `json:"poll_interval"`
	DeadLetterQueue           string   `json:"dead_letter_queue"`
	PerUserRateWindow         string   `json:"per_user_rate_window"`
	PerUserRateMax            int      `json:"per_user_rate_max"`
	PerInstallationRateWindow string   `json:"per_installation_rate_window"`
	PerInstallationRateMax    int      `json:"per_installation_rate_max"`
	SupportedJobTypes         []string `json:"supported_job_types,omitempty"`
}

type DeadLetterQueueStatus struct {
	QueueName     string    `json:"queue_name"`
	PoisonJobs    int       `json:"poison_jobs"`
	LastUpdatedAt time.Time `json:"last_updated_at"`
}
