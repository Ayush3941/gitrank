package contracts

import (
	"errors"
	"strings"
)

type ScoreContributionRequest struct {
	Repository  RepositoryContext           `json:"repository"`
	PullRequest PullRequestContext          `json:"pull_request"`
	Analysis    PullRequestAnalysisResponse `json:"analysis"`
	Contributor ContributorContext          `json:"contributor"`
}

type ContributorContext struct {
	RecentMergedPullRequests    int     `json:"recent_merged_pull_requests,omitempty"`
	ConsecutiveActiveWeeks      int     `json:"consecutive_active_weeks,omitempty"`
	MeaningfulContributionRatio float64 `json:"meaningful_contribution_ratio,omitempty"`
}

type ScoreContributionResponse struct {
	ScoreVersion        string         `json:"score_version"`
	TotalXP             int            `json:"total_xp"`
	Level               string         `json:"level"`
	CategoryWeight      float64        `json:"category_weight"`
	TechnicalDepth      float64        `json:"technical_depth"`
	ReviewStrength      float64        `json:"review_strength"`
	RepositoryWeight    float64        `json:"repository_weight"`
	OutcomeWeight       float64        `json:"outcome_weight"`
	ConsistencyModifier float64        `json:"consistency_modifier"`
	SpamPenalty         float64        `json:"spam_penalty"`
	SkillXP             map[string]int `json:"skill_xp,omitempty"`
	Explanation         []string       `json:"explanation,omitempty"`
	SuspiciousActivity  bool           `json:"suspicious_activity,omitempty"`
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
	if req.Contributor.MeaningfulContributionRatio < 0 || req.Contributor.MeaningfulContributionRatio > 1 {
		return errors.New("contributor.meaningful_contribution_ratio must be between 0 and 1")
	}
	return req.Analysis.ValidateForScoring()
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
