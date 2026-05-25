package scoring

import (
	"math"
	"strconv"
	"strings"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/contracts"
)

const DefaultScoreVersion = "v1alpha1"

type Engine struct {
	policy config.Scoring
}

func New() Engine {
	return Engine{policy: defaultPolicy()}
}

func NewWithPolicy(policy config.Scoring) Engine {
	return Engine{policy: policy}
}

func (e Engine) Score(req contracts.ScoreContributionRequest) contracts.ScoreContributionResponse {
	policy := e.policy
	categoryWeight := categoryWeight(policy, req.Analysis.Category)
	repositoryWeight := repositoryWeight(policy, req.Repository)
	outcomeWeight := outcomeWeight(policy, req.PullRequest)
	consistencyModifier := consistencyModifier(policy, req.Contributor)
	diminishingReturnsModifier := diminishingReturnsModifier(policy, req.Contributor)
	spamPenalty := spamPenalty(policy, req)
	multiplier := categoryWeight *
		req.Analysis.TechnicalDepth *
		req.Analysis.ReviewStrength *
		repositoryWeight *
		outcomeWeight *
		consistencyModifier *
		diminishingReturnsModifier *
		max(policy.SpamMultiplierFloor, 1.0-spamPenalty)

	totalXP := int(math.Round(policy.BaseXP * multiplier))
	if totalXP < policy.MinXP {
		totalXP = policy.MinXP
	}

	skillXP := distributeSkillXP(req.Analysis.Skills, totalXP)

	return contracts.ScoreContributionResponse{
		ScoreVersion:               policy.ScoreVersion,
		TotalXP:                    totalXP,
		Level:                      levelForXP(policy, totalXP),
		CategoryWeight:             categoryWeight,
		TechnicalDepth:             req.Analysis.TechnicalDepth,
		ReviewStrength:             req.Analysis.ReviewStrength,
		RepositoryWeight:           repositoryWeight,
		OutcomeWeight:              outcomeWeight,
		ConsistencyModifier:        consistencyModifier,
		DiminishingReturnsModifier: diminishingReturnsModifier,
		SpamPenalty:                spamPenalty,
		SkillXP:                    skillXP,
		Explanation:                buildExplanation(policy, req, totalXP, spamPenalty, diminishingReturnsModifier),
		SuspiciousActivity:         spamPenalty >= policy.SuspiciousPenaltyThreshold,
	}
}

func (e Engine) LevelForXP(xp int) string {
	return levelForXP(e.policy, xp)
}

func categoryWeight(policy config.Scoring, category string) float64 {
	switch category {
	case "documentation":
		return policy.CategoryWeightDocumentation
	case "tests":
		return policy.CategoryWeightTests
	case "bug_fix":
		return policy.CategoryWeightBugFix
	case "feature":
		return policy.CategoryWeightFeature
	case "refactor":
		return policy.CategoryWeightRefactor
	case "performance":
		return policy.CategoryWeightPerformance
	case "infrastructure":
		return policy.CategoryWeightInfrastructure
	case "security":
		return policy.CategoryWeightSecurity
	case "maintainer_design":
		return policy.CategoryWeightMaintainerDesign
	default:
		return policy.CategoryWeightDefault
	}
}

func repositoryWeight(policy config.Scoring, repo contracts.RepositoryContext) float64 {
	weight := 1.0
	if repo.Maintainers >= policy.RepositoryMaintainersThreshold {
		weight += policy.RepositoryMaintainersBonus
	}
	if repo.Stars >= policy.RepositoryStarsTierOneThreshold {
		weight += policy.RepositoryStarsTierOneBonus
	}
	if repo.Stars >= policy.RepositoryStarsTierTwoThreshold {
		weight += policy.RepositoryStarsTierTwoBonus
	}
	if repo.Archived {
		weight -= policy.RepositoryArchivedPenalty
	}
	if weight < policy.RepositoryWeightMin {
		return policy.RepositoryWeightMin
	}
	if weight > policy.RepositoryWeightMax {
		return policy.RepositoryWeightMax
	}
	return weight
}

func outcomeWeight(policy config.Scoring, pr contracts.PullRequestContext) float64 {
	switch {
	case pr.Merged:
		return policy.OutcomeWeightMerged
	case pr.Draft:
		return policy.OutcomeWeightDraft
	case strings.EqualFold(pr.State, "closed"):
		return policy.OutcomeWeightClosed
	default:
		return policy.OutcomeWeightOpen
	}
}

func consistencyModifier(policy config.Scoring, contributor contracts.ContributorContext) float64 {
	modifier := 1.0
	modifier += float64(min(contributor.ConsecutiveActiveWeeks, policy.ConsistencyActiveWeeksCap)) * policy.ConsistencyActiveWeekBonus
	modifier += clamp(contributor.MeaningfulContributionRatio, 0, 1) * policy.ConsistencyMeaningfulRatioBonus
	if contributor.RecentMergedPullRequests >= policy.ConsistencyRecentMergedThreshold {
		modifier += policy.ConsistencyRecentMergedBonus
	}
	if modifier > policy.ConsistencyModifierMax {
		return policy.ConsistencyModifierMax
	}
	return modifier
}

func diminishingReturnsModifier(policy config.Scoring, contributor contracts.ContributorContext) float64 {
	modifier := 1.0
	modifier -= float64(min(contributor.RecentSimilarPullRequests, policy.DiminishingSimilarCap)) * policy.DiminishingSimilarStep
	modifier -= float64(min(contributor.RecentCategoryPullRequests, policy.DiminishingCategoryCap)) * policy.DiminishingCategoryStep
	if contributor.RecentRepositoryPullRequests >= policy.DiminishingRepositoryThreshold {
		modifier -= policy.DiminishingRepositoryPenalty
	}
	if modifier < policy.DiminishingModifierMin {
		return policy.DiminishingModifierMin
	}
	return modifier
}

func spamPenalty(policy config.Scoring, req contracts.ScoreContributionRequest) float64 {
	penalty := 0.0
	if req.Analysis.Category == "documentation" && req.PullRequest.Additions+req.PullRequest.Deletions < policy.SpamDocsSmallChangeSizeLimit {
		penalty += policy.SpamDocsSmallChangePenalty
	}
	if req.PullRequest.ChangedFiles <= policy.SpamTinyChangedFilesLimit && req.PullRequest.Additions+req.PullRequest.Deletions < policy.SpamTinyChangeSizeLimit {
		penalty += policy.SpamTinyChangePenalty
	}
	if req.Analysis.FileBreakdown.Source == 0 && req.Analysis.FileBreakdown.Tests == 0 && req.Analysis.FileBreakdown.Docs > 0 {
		penalty += policy.SpamDocsOnlyPenalty
	}
	if penalty > policy.SpamPenaltyMax {
		return policy.SpamPenaltyMax
	}
	return penalty
}

func distributeSkillXP(skills []string, totalXP int) map[string]int {
	if len(skills) == 0 {
		return map[string]int{}
	}

	base := totalXP / len(skills)
	remaining := totalXP % len(skills)
	result := make(map[string]int, len(skills))
	for _, skill := range skills {
		result[skill] = base
		if remaining > 0 {
			result[skill]++
			remaining--
		}
	}
	return result
}

func buildExplanation(policy config.Scoring, req contracts.ScoreContributionRequest, totalXP int, spamPenalty, diminishingReturns float64) []string {
	explanation := []string{
		"score version " + policy.ScoreVersion,
		"strict PR XP award strategy executed before AI summaries",
		"category " + strings.ReplaceAll(req.Analysis.Category, "_", " "),
		"technical depth and review strength were applied deterministically",
	}
	if req.PullRequest.Merged {
		explanation = append(explanation, "merged outcome increased the result")
	}
	if diminishingReturns < 1 {
		explanation = append(explanation, "recent similar contribution patterns triggered diminishing returns")
	}
	if spamPenalty > 0 {
		explanation = append(explanation, "small-change or docs-heavy penalties reduced the result")
	}
	explanation = append(explanation, "final XP "+itoa(totalXP))
	return explanation
}

func levelForXP(policy config.Scoring, xp int) string {
	switch {
	case xp >= policy.LevelArchitectMinXP:
		return "Architect"
	case xp >= policy.LevelMaintainerMinXP:
		return "Maintainer"
	case xp >= policy.LevelSpecialistMinXP:
		return "Specialist"
	case xp >= policy.LevelBuilderMinXP:
		return "Builder"
	case xp >= policy.LevelContributorMinXP:
		return "Contributor"
	default:
		return "Explorer"
	}
}

func clamp(value, lower, upper float64) float64 {
	if value < lower {
		return lower
	}
	if value > upper {
		return upper
	}
	return value
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func itoa(value int) string {
	return strconv.Itoa(value)
}

func defaultPolicy() config.Scoring {
	return config.Scoring{
		ScoreVersion: DefaultScoreVersion,
		BaseXP:       100,
		MinXP:        10,

		CategoryWeightDefault:          1.0,
		CategoryWeightDocumentation:    0.8,
		CategoryWeightTests:            1.1,
		CategoryWeightBugFix:           1.3,
		CategoryWeightFeature:          1.5,
		CategoryWeightRefactor:         1.2,
		CategoryWeightPerformance:      1.6,
		CategoryWeightInfrastructure:   1.2,
		CategoryWeightSecurity:         1.7,
		CategoryWeightMaintainerDesign: 1.8,

		RepositoryMaintainersThreshold:  3,
		RepositoryMaintainersBonus:      0.1,
		RepositoryStarsTierOneThreshold: 100,
		RepositoryStarsTierOneBonus:     0.05,
		RepositoryStarsTierTwoThreshold: 1000,
		RepositoryStarsTierTwoBonus:     0.05,
		RepositoryArchivedPenalty:       0.2,
		RepositoryWeightMin:             0.75,
		RepositoryWeightMax:             1.35,

		OutcomeWeightMerged: 1.4,
		OutcomeWeightDraft:  0.35,
		OutcomeWeightClosed: 0.5,
		OutcomeWeightOpen:   0.9,

		ConsistencyActiveWeeksCap:        12,
		ConsistencyActiveWeekBonus:       0.02,
		ConsistencyMeaningfulRatioBonus:  0.1,
		ConsistencyRecentMergedThreshold: 5,
		ConsistencyRecentMergedBonus:     0.05,
		ConsistencyModifierMax:           1.4,

		DiminishingSimilarCap:          5,
		DiminishingSimilarStep:         0.08,
		DiminishingCategoryCap:         8,
		DiminishingCategoryStep:        0.025,
		DiminishingRepositoryThreshold: 6,
		DiminishingRepositoryPenalty:   0.1,
		DiminishingModifierMin:         0.6,

		SpamDocsSmallChangeSizeLimit: 20,
		SpamDocsSmallChangePenalty:   0.2,
		SpamTinyChangedFilesLimit:    2,
		SpamTinyChangeSizeLimit:      15,
		SpamTinyChangePenalty:        0.1,
		SpamDocsOnlyPenalty:          0.05,
		SpamPenaltyMax:               0.35,
		SpamMultiplierFloor:          0.35,
		SuspiciousPenaltyThreshold:   0.2,

		LevelContributorMinXP: 60,
		LevelBuilderMinXP:     100,
		LevelSpecialistMinXP:  140,
		LevelMaintainerMinXP:  180,
		LevelArchitectMinXP:   250,
	}
}
