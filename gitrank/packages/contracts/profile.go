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
	Key            string  `json:"key"`
	TotalXP        int     `json:"total_xp"`
	Percentage     float64 `json:"percentage"`
	Summary        string  `json:"summary,omitempty"`
	EvidenceSource string  `json:"evidence_source,omitempty"`
	Confidence     float64 `json:"confidence,omitempty"`
	EvidenceState  string  `json:"evidence_state,omitempty"`
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
	EventID         string                `json:"event_id"`
	EventType       string                `json:"event_type"`
	DeltaXP         int                   `json:"delta_xp"`
	CreatedAt       time.Time             `json:"created_at"`
	ScoreVersion    string                `json:"score_version,omitempty"`
	FormulaVersion  string                `json:"formula_version,omitempty"`
	PullRequestID   string                `json:"pull_request_id,omitempty"`
	AnalysisID      string                `json:"analysis_id,omitempty"`
	EvidenceState   string                `json:"evidence_state,omitempty"`
	EvidenceMissing []string              `json:"evidence_missing,omitempty"`
	PullRequest     *PullRequestReference `json:"pull_request,omitempty"`
	Explanation     []string              `json:"explanation,omitempty"`
}

type QuestEvidenceReference struct {
	EventID    string    `json:"event_id"`
	Kind       string    `json:"kind"`
	Repository string    `json:"repository,omitempty"`
	Number     int       `json:"number,omitempty"`
	Title      string    `json:"title,omitempty"`
	OccurredAt time.Time `json:"occurred_at"`
}

type QuestView struct {
	ID                    string                   `json:"id"`
	Title                 string                   `json:"title"`
	Description           string                   `json:"description"`
	Status                string                   `json:"status"`
	Cadence               string                   `json:"cadence"`
	RewardXP              int                      `json:"reward_xp"`
	RewardBadgeKey        string                   `json:"reward_badge_key,omitempty"`
	Progress              int                      `json:"progress"`
	Goal                  int                      `json:"goal"`
	WeakAreaTarget        string                   `json:"weak_area_target,omitempty"`
	WhyRecommended        string                   `json:"why_recommended"`
	EvidenceSignals       []string                 `json:"evidence_signals,omitempty"`
	LinkedContributionIDs []string                 `json:"linked_contribution_ids,omitempty"`
	EvidenceReferences    []QuestEvidenceReference `json:"evidence_references,omitempty"`
	ExpiresAt             *time.Time               `json:"expires_at,omitempty"`
}

type UserQuestsResponse struct {
	Quests      []QuestView      `json:"quests"`
	GeneratedAt time.Time        `json:"generated_at"`
	Staleness   ProfileStaleness `json:"staleness"`
}

type PRReportContribution struct {
	ID                 string    `json:"id"`
	Owner              string    `json:"owner"`
	Repo               string    `json:"repo"`
	Number             int       `json:"number"`
	Title              string    `json:"title"`
	Status             string    `json:"status"`
	Category           string    `json:"category"`
	DifficultyScore    int       `json:"difficulty_score"`
	ImpactScore        int       `json:"impact_score"`
	ReviewDepthScore   int       `json:"review_depth_score"`
	TestSignalScore    int       `json:"test_signal_score"`
	RepoWeight         float64   `json:"repo_weight"`
	AntiSpamMultiplier float64   `json:"anti_spam_multiplier"`
	XPEarned           int       `json:"xp_earned"`
	Additions          int       `json:"additions"`
	Deletions          int       `json:"deletions"`
	ChangedFilesCount  int       `json:"changed_files_count"`
	MergedAt           time.Time `json:"merged_at"`
	MaintainerReviewed bool      `json:"maintainer_reviewed"`
	LinkedIssue        bool      `json:"linked_issue"`
	CIPassed           bool      `json:"ci_passed"`
	AISummary          string    `json:"ai_summary"`
	EvidenceSignals    []string  `json:"evidence_signals,omitempty"`
}

type PRReportScoreBreakdown struct {
	Label   string `json:"label"`
	DeltaXP int    `json:"delta_xp"`
	Type    string `json:"type"`
	Reason  string `json:"reason"`
}

type PRReportScoreComponent struct {
	Key          string  `json:"key"`
	Label        string  `json:"label"`
	Value        float64 `json:"value"`
	DisplayValue string  `json:"display_value"`
	Source       string  `json:"source"`
	Reason       string  `json:"reason"`
}

type PRReportBadgeUnlock struct {
	Key             string    `json:"key"`
	Name            string    `json:"name"`
	Description     string    `json:"description,omitempty"`
	AwardedAt       time.Time `json:"awarded_at"`
	Rule            string    `json:"rule,omitempty"`
	RuleVersion     string    `json:"rule_version,omitempty"`
	EvidenceSignals []string  `json:"evidence_signals,omitempty"`
	EvidencePRIDs   []string  `json:"evidence_pr_ids,omitempty"`
}

type PRReportSuggestedQuest struct {
	ID              string   `json:"id"`
	Title           string   `json:"title"`
	Description     string   `json:"description"`
	Status          string   `json:"status"`
	WeakAreaTarget  string   `json:"weak_area_target,omitempty"`
	WhyRecommended  string   `json:"why_recommended"`
	EvidenceSignals []string `json:"evidence_signals,omitempty"`
}

type PRReportEvidenceState struct {
	Status             string   `json:"status"`
	Reasons            []string `json:"reasons,omitempty"`
	MissingEvidence    []string `json:"missing_evidence,omitempty"`
	AnalysisSource     string   `json:"analysis_source,omitempty"`
	AnalysisConfidence float64  `json:"analysis_confidence,omitempty"`
	DeterministicOnly  bool     `json:"deterministic_only,omitempty"`
	AIFallback         bool     `json:"ai_fallback,omitempty"`
	RateLimited        bool     `json:"rate_limited,omitempty"`
	Stale              bool     `json:"stale,omitempty"`
}

type PullRequestReportResponse struct {
	Contribution     PRReportContribution     `json:"contribution"`
	BaseValue        int                      `json:"base_value"`
	MergedBonus      int                      `json:"merged_bonus"`
	ReviewBonus      int                      `json:"review_bonus"`
	TestBonus        int                      `json:"test_bonus"`
	RepoBonus        int                      `json:"repo_bonus"`
	AIConfidence     float64                  `json:"ai_confidence"`
	Penalties        []PRReportScoreBreakdown `json:"penalties,omitempty"`
	ScoreComponents  []PRReportScoreComponent `json:"score_components,omitempty"`
	BadgeUnlocks     []PRReportBadgeUnlock    `json:"badge_unlocks,omitempty"`
	SuggestedQuestID string                   `json:"suggested_quest_id"`
	SuggestedQuest   *PRReportSuggestedQuest  `json:"suggested_quest,omitempty"`
	EvidenceState    PRReportEvidenceState    `json:"evidence_state"`
	ScoreVersion     string                   `json:"score_version,omitempty"`
	AnalysisVersion  string                   `json:"analysis_version,omitempty"`
	SourceUpdatedAt  time.Time                `json:"source_updated_at"`
	GeneratedAt      time.Time                `json:"generated_at"`
	IsStale          bool                     `json:"is_stale"`
}

type PullRequestReportMaterializationResponse struct {
	Status           string    `json:"status"`
	Repository       string    `json:"repository"`
	Number           int       `json:"number"`
	PullRequestID    string    `json:"pull_request_id"`
	ReportSnapshotID string    `json:"report_snapshot_id"`
	ReportVersion    string    `json:"report_version"`
	ScoreEventID     string    `json:"score_event_id,omitempty"`
	AnalysisID       string    `json:"analysis_id,omitempty"`
	ScoreVersion     string    `json:"score_version,omitempty"`
	AnalysisVersion  string    `json:"analysis_version,omitempty"`
	EvidenceStatus   string    `json:"evidence_status,omitempty"`
	MissingEvidence  []string  `json:"missing_evidence,omitempty"`
	IsStale          bool      `json:"is_stale"`
	SourceUpdatedAt  time.Time `json:"source_updated_at"`
	GeneratedAt      time.Time `json:"generated_at"`
}

type LeaderboardEntryView struct {
	Rank                   int       `json:"rank"`
	Handle                 string    `json:"handle"`
	DisplayName            string    `json:"display_name"`
	AvatarURL              string    `json:"avatar_url,omitempty"`
	LevelLabel             string    `json:"level_label"`
	RankTier               string    `json:"rank_tier"`
	TotalXP                int       `json:"total_xp"`
	WeeklyXP               int       `json:"weekly_xp"`
	Movement               int       `json:"movement"`
	Focus                  string    `json:"focus,omitempty"`
	ProfileSnapshotID      string    `json:"profile_snapshot_id,omitempty"`
	ProfileSnapshotVersion string    `json:"profile_snapshot_version,omitempty"`
	SeasonKey              string    `json:"season_key,omitempty"`
	SeasonSnapshotID       string    `json:"season_snapshot_id,omitempty"`
	RankMovementEventID    string    `json:"rank_movement_event_id,omitempty"`
	ScoreVersion           string    `json:"score_version,omitempty"`
	SourceWatermark        time.Time `json:"source_watermark"`
	RankEvidenceState      string    `json:"rank_evidence_state,omitempty"`
	RankEvidenceMissing    []string  `json:"rank_evidence_missing,omitempty"`
	RefreshedAt            time.Time `json:"refreshed_at"`
	IsStale                bool      `json:"is_stale"`
}

type LeaderboardResponse struct {
	Entries               []LeaderboardEntryView `json:"entries"`
	Window                ProfileTimeWindow      `json:"window"`
	GeneratedAt           time.Time              `json:"generated_at"`
	SeasonKey             string                 `json:"season_key,omitempty"`
	SeasonSnapshotVersion string                 `json:"season_snapshot_version,omitempty"`
	ScoringVersion        string                 `json:"scoring_version,omitempty"`
}

type LeaderboardMaterializationResponse struct {
	Status                string            `json:"status"`
	SeasonKey             string            `json:"season_key"`
	SeasonSnapshotVersion string            `json:"season_snapshot_version"`
	ScoringVersion        string            `json:"scoring_version,omitempty"`
	EntryCount            int               `json:"entry_count"`
	Window                ProfileTimeWindow `json:"window"`
	SourceWatermark       time.Time         `json:"source_watermark"`
	GeneratedAt           time.Time         `json:"generated_at"`
}

type ProfilePrivacySettings struct {
	PublicProfileEnabled         bool `json:"public_profile_enabled"`
	ShowExactPRs                 bool `json:"show_exact_prs"`
	ShowAISummaries              bool `json:"show_ai_summaries"`
	ShowLeaderboardParticipation bool `json:"show_leaderboard_participation"`
	ReducedGamification          bool `json:"reduced_gamification"`
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

type ProfileRefreshResponse struct {
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
	Summary              PublicProfileSummary        `json:"summary"`
	TopSkillAreas        []SkillAreaView             `json:"top_skill_areas,omitempty"`
	TopRepositories      []TopRepositoryView         `json:"top_repositories,omitempty"`
	Level                ProfileLevelView            `json:"level"`
	Badges               []BadgeView                 `json:"badges,omitempty"`
	Timeline             ProfileTimeline             `json:"timeline"`
	ScoreHistory         []ScoreHistoryEntry         `json:"score_history,omitempty"`
	RecentPRReports      []PullRequestReportResponse `json:"recent_pr_reports,omitempty"`
	Privacy              ProfilePrivacySettings      `json:"privacy"`
	RepositoryVisibility []RepositoryVisibilityView  `json:"repository_visibility,omitempty"`
	ShareCard            ShareableProfileCard        `json:"share_card"`
	Staleness            ProfileStaleness            `json:"staleness"`
}

type AccountExportUser struct {
	UserID            string    `json:"user_id"`
	PublicHandle      string    `json:"public_handle"`
	DisplayName       string    `json:"display_name"`
	AvatarURL         string    `json:"avatar_url,omitempty"`
	Bio               string    `json:"bio,omitempty"`
	Status            string    `json:"status"`
	ProfileVisibility string    `json:"profile_visibility"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type AccountExportGitHubAccount struct {
	GitHubAccountID   string     `json:"github_account_id"`
	GitHubUserID      int64      `json:"github_user_id"`
	Login             string     `json:"login"`
	DisplayName       string     `json:"display_name,omitempty"`
	Email             string     `json:"email,omitempty"`
	AvatarURL         string     `json:"avatar_url,omitempty"`
	UserType          string     `json:"user_type,omitempty"`
	AccessMode        string     `json:"access_mode"`
	OAuthScopes       []string   `json:"oauth_scopes,omitempty"`
	InstallationCount int        `json:"installation_count"`
	LinkStatus        string     `json:"link_status"`
	LinkedAt          time.Time  `json:"linked_at"`
	UnlinkedAt        *time.Time `json:"unlinked_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type AccountExportSession struct {
	SessionID                 string     `json:"session_id"`
	GitHubAccountID           string     `json:"github_account_id"`
	Roles                     []string   `json:"roles,omitempty"`
	RequestIP                 string     `json:"request_ip,omitempty"`
	UserAgent                 string     `json:"user_agent,omitempty"`
	GitHubAuthorizationStatus string     `json:"github_authorization_status"`
	CreatedAt                 time.Time  `json:"created_at"`
	LastSeenAt                time.Time  `json:"last_seen_at"`
	LastRefreshedAt           time.Time  `json:"last_refreshed_at"`
	RotatedAt                 time.Time  `json:"rotated_at"`
	ExpiresAt                 time.Time  `json:"expires_at"`
	IdleExpiresAt             time.Time  `json:"idle_expires_at"`
	InvalidatedAt             *time.Time `json:"invalidated_at,omitempty"`
	InvalidatedReason         string     `json:"invalidated_reason,omitempty"`
}

type AccountExportAuditEvent struct {
	ID         string         `json:"id"`
	ActorType  string         `json:"actor_type"`
	ActorID    string         `json:"actor_id,omitempty"`
	Action     string         `json:"action"`
	TargetType string         `json:"target_type"`
	TargetID   string         `json:"target_id,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
}

type AccountDataExportResponse struct {
	ExportVersion  string                       `json:"export_version"`
	GeneratedAt    time.Time                    `json:"generated_at"`
	User           AccountExportUser            `json:"user"`
	GitHubAccounts []AccountExportGitHubAccount `json:"github_accounts,omitempty"`
	Profile        PrivateProfileResponse       `json:"profile"`
	Sessions       []AccountExportSession       `json:"sessions,omitempty"`
	AuditEvents    []AccountExportAuditEvent    `json:"audit_events,omitempty"`
	Redactions     []string                     `json:"redactions,omitempty"`
}

type UpdateProfilePrivacyRequest struct {
	PublicProfileEnabled         *bool `json:"public_profile_enabled,omitempty"`
	ShowExactPRs                 *bool `json:"show_exact_prs,omitempty"`
	ShowAISummaries              *bool `json:"show_ai_summaries,omitempty"`
	ShowLeaderboardParticipation *bool `json:"show_leaderboard_participation,omitempty"`
	ReducedGamification          *bool `json:"reduced_gamification,omitempty"`
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
