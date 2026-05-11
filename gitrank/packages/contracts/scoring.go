package contracts

import (
	"errors"
	"strings"
	"time"
)

type ScoreContributionRequest struct {
	Repository  RepositoryContext           `json:"repository"`
	PullRequest PullRequestContext          `json:"pull_request"`
	Analysis    PullRequestAnalysisResponse `json:"analysis"`
	Contributor ContributorContext          `json:"contributor"`
}

type ContributorContext struct {
	RecentMergedPullRequests     int     `json:"recent_merged_pull_requests,omitempty"`
	ConsecutiveActiveWeeks       int     `json:"consecutive_active_weeks,omitempty"`
	MeaningfulContributionRatio  float64 `json:"meaningful_contribution_ratio,omitempty"`
	RecentRepositoryPullRequests int     `json:"recent_repository_pull_requests,omitempty"`
	RecentCategoryPullRequests   int     `json:"recent_category_pull_requests,omitempty"`
	RecentSimilarPullRequests    int     `json:"recent_similar_pull_requests,omitempty"`
}

type ScoreContributionResponse struct {
	ScoreVersion               string         `json:"score_version"`
	TotalXP                    int            `json:"total_xp"`
	Level                      string         `json:"level"`
	CategoryWeight             float64        `json:"category_weight"`
	TechnicalDepth             float64        `json:"technical_depth"`
	ReviewStrength             float64        `json:"review_strength"`
	RepositoryWeight           float64        `json:"repository_weight"`
	OutcomeWeight              float64        `json:"outcome_weight"`
	ConsistencyModifier        float64        `json:"consistency_modifier"`
	DiminishingReturnsModifier float64        `json:"diminishing_returns_modifier"`
	SpamPenalty                float64        `json:"spam_penalty"`
	SkillXP                    map[string]int `json:"skill_xp,omitempty"`
	Explanation                []string       `json:"explanation,omitempty"`
	SuspiciousActivity         bool           `json:"suspicious_activity,omitempty"`
}

type ReplayUserScoresRequest struct {
	TriggerType string `json:"trigger_type,omitempty"`
}

type VerifyScoreReplayRequest struct {
	Repository   string    `json:"repository,omitempty"`
	From         time.Time `json:"from,omitempty"`
	To           time.Time `json:"to,omitempty"`
	ScoreVersion string    `json:"score_version,omitempty"`
}

type UserScoreSnapshotResponse struct {
	ReplayRunID       string          `json:"replay_run_id"`
	UserID            string          `json:"user_id"`
	ScoreVersion      string          `json:"score_version"`
	TriggerType       string          `json:"trigger_type"`
	TotalXP           int             `json:"total_xp"`
	Level             string          `json:"level"`
	RankTier          string          `json:"rank_tier"`
	TopSkills         []SkillAreaView `json:"top_skills,omitempty"`
	BadgeKeys         []string        `json:"badge_keys,omitempty"`
	ContributionCount int             `json:"contribution_count"`
	SuspiciousEvents  int             `json:"suspicious_events"`
	SourceWatermark   time.Time       `json:"source_watermark"`
	ComputedAt        time.Time       `json:"computed_at"`
}

type ReplayUserScoresResponse struct {
	Snapshot UserScoreSnapshotResponse `json:"snapshot"`
	Badges   []BadgeView               `json:"badges,omitempty"`
	Events   int                       `json:"events"`
}

type ScoreReplayVerificationResponse struct {
	UserID            string           `json:"user_id"`
	ScoreVersion      string           `json:"score_version"`
	Repository        string           `json:"repository,omitempty"`
	From              *time.Time       `json:"from,omitempty"`
	To                *time.Time       `json:"to,omitempty"`
	TotalXP           int              `json:"total_xp"`
	Level             string           `json:"level"`
	RankTier          string           `json:"rank_tier"`
	TopSkills         []SkillAreaView  `json:"top_skills,omitempty"`
	Badges            []BadgeView      `json:"badges,omitempty"`
	Events            []ScoreEventView `json:"events,omitempty"`
	ContributionCount int              `json:"contribution_count"`
	SuspiciousEvents  int              `json:"suspicious_events"`
	SourceWatermark   time.Time        `json:"source_watermark"`
	GeneratedAt       time.Time        `json:"generated_at"`
	Persisted         bool             `json:"persisted"`
}

type ScoreEventView struct {
	EventID      string                `json:"event_id"`
	EventKey     string                `json:"event_key"`
	ReplayRunID  string                `json:"replay_run_id"`
	ScoreVersion string                `json:"score_version"`
	EventType    string                `json:"event_type"`
	DeltaXP      int                   `json:"delta_xp"`
	SkillXP      map[string]int        `json:"skill_xp,omitempty"`
	Explanation  []string              `json:"explanation,omitempty"`
	Suspicious   bool                  `json:"suspicious,omitempty"`
	PullRequest  *PullRequestReference `json:"pull_request,omitempty"`
	CreatedAt    time.Time             `json:"created_at"`
}

type UserScoreEventsResponse struct {
	ReplayRunID  string           `json:"replay_run_id"`
	UserID       string           `json:"user_id"`
	ScoreVersion string           `json:"score_version"`
	Events       []ScoreEventView `json:"events,omitempty"`
}

func (req ScoreContributionRequest) Validate() error {
	if strings.TrimSpace(req.Repository.FullName) == "" {
		return errors.New("repository.full_name is required")
	}
	if req.Repository.Stars < 0 || req.Repository.Maintainers < 0 {
		return errors.New("repository numeric fields must be non-negative")
	}
	if err := validateScorePullRequestContext(req.PullRequest); err != nil {
		return err
	}
	if req.Contributor.RecentMergedPullRequests < 0 || req.Contributor.ConsecutiveActiveWeeks < 0 {
		return errors.New("contributor numeric fields must be non-negative")
	}
	if req.Contributor.RecentRepositoryPullRequests < 0 || req.Contributor.RecentCategoryPullRequests < 0 || req.Contributor.RecentSimilarPullRequests < 0 {
		return errors.New("contributor replay counters must be non-negative")
	}
	if req.Contributor.MeaningfulContributionRatio < 0 || req.Contributor.MeaningfulContributionRatio > 1 {
		return errors.New("contributor.meaningful_contribution_ratio must be between 0 and 1")
	}
	return req.Analysis.ValidateForScoring()
}

func (req ReplayUserScoresRequest) Validate() error {
	switch strings.ToLower(strings.TrimSpace(req.TriggerType)) {
	case "", "replay", "backfill", "live":
		return nil
	default:
		return errors.New("trigger_type must be replay, backfill, or live")
	}
}

func (req VerifyScoreReplayRequest) Validate() error {
	if !req.From.IsZero() && !req.To.IsZero() && req.From.After(req.To) {
		return errors.New("from must be before to")
	}
	if strings.TrimSpace(req.Repository) != "" {
		if _, err := NormalizeGitHubRepository(req.Repository); err != nil {
			return err
		}
	}
	return nil
}

func validateScorePullRequestContext(pr PullRequestContext) error {
	if pr.Number < 0 {
		return errors.New("pull_request.number must be non-negative")
	}
	if pr.Additions < 0 || pr.Deletions < 0 || pr.ChangedFiles < 0 || pr.Commits < 0 {
		return errors.New("pull_request numeric fields must be non-negative")
	}
	for _, file := range pr.Files {
		if strings.TrimSpace(file.Path) == "" {
			return errors.New("pull_request.files[].path is required")
		}
		if file.Additions < 0 || file.Deletions < 0 {
			return errors.New("pull_request.files[] additions and deletions must be non-negative")
		}
	}
	for _, review := range pr.Reviews {
		if strings.TrimSpace(review.State) == "" {
			return errors.New("pull_request.reviews[].state is required")
		}
	}
	return nil
}
