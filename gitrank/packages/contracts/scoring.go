package contracts

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
