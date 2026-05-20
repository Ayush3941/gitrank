package scoring

import (
	"math"
	"strconv"
	"strings"

	"github.com/gitrank/gitrank/packages/contracts"
)

const ScoreVersion = "v1alpha1"

type Engine struct{}

func New() Engine {
	return Engine{}
}

func (Engine) Score(req contracts.ScoreContributionRequest) contracts.ScoreContributionResponse {
	categoryWeight := categoryWeight(req.Analysis.Category)
	repositoryWeight := repositoryWeight(req.Repository)
	outcomeWeight := outcomeWeight(req.PullRequest)
	consistencyModifier := consistencyModifier(req.Contributor)
	diminishingReturnsModifier := diminishingReturnsModifier(req.Contributor)
	spamPenalty := spamPenalty(req)
	multiplier := categoryWeight *
		req.Analysis.TechnicalDepth *
		req.Analysis.ReviewStrength *
		repositoryWeight *
		outcomeWeight *
		consistencyModifier *
		diminishingReturnsModifier *
		max(0.35, 1.0-spamPenalty)

	totalXP := int(math.Round(100 * multiplier))
	if totalXP < 10 {
		totalXP = 10
	}

	skillXP := distributeSkillXP(req.Analysis.Skills, totalXP)

	return contracts.ScoreContributionResponse{
		ScoreVersion:               ScoreVersion,
		TotalXP:                    totalXP,
		Level:                      LevelForXP(totalXP),
		CategoryWeight:             categoryWeight,
		TechnicalDepth:             req.Analysis.TechnicalDepth,
		ReviewStrength:             req.Analysis.ReviewStrength,
		RepositoryWeight:           repositoryWeight,
		OutcomeWeight:              outcomeWeight,
		ConsistencyModifier:        consistencyModifier,
		DiminishingReturnsModifier: diminishingReturnsModifier,
		SpamPenalty:                spamPenalty,
		SkillXP:                    skillXP,
		Explanation:                buildExplanation(req, totalXP, spamPenalty, diminishingReturnsModifier),
		SuspiciousActivity:         spamPenalty >= 0.2,
	}
}

func categoryWeight(category string) float64 {
	switch category {
	case "documentation":
		return 0.8
	case "tests":
		return 1.1
	case "bug_fix":
		return 1.3
	case "feature":
		return 1.5
	case "refactor":
		return 1.2
	case "performance":
		return 1.6
	case "infrastructure":
		return 1.2
	case "security":
		return 1.7
	case "maintainer_design":
		return 1.8
	default:
		return 1.0
	}
}

func repositoryWeight(repo contracts.RepositoryContext) float64 {
	weight := 1.0
	if repo.Maintainers >= 3 {
		weight += 0.1
	}
	if repo.Stars >= 100 {
		weight += 0.05
	}
	if repo.Stars >= 1000 {
		weight += 0.05
	}
	if repo.Archived {
		weight -= 0.2
	}
	if weight < 0.75 {
		return 0.75
	}
	if weight > 1.35 {
		return 1.35
	}
	return weight
}

func outcomeWeight(pr contracts.PullRequestContext) float64 {
	switch {
	case pr.Merged:
		return 1.4
	case pr.Draft:
		return 0.35
	case strings.EqualFold(pr.State, "closed"):
		return 0.5
	default:
		return 0.9
	}
}

func consistencyModifier(contributor contracts.ContributorContext) float64 {
	modifier := 1.0
	modifier += float64(min(contributor.ConsecutiveActiveWeeks, 12)) * 0.02
	modifier += clamp(contributor.MeaningfulContributionRatio, 0, 1) * 0.1
	if contributor.RecentMergedPullRequests >= 5 {
		modifier += 0.05
	}
	if modifier > 1.4 {
		return 1.4
	}
	return modifier
}

func diminishingReturnsModifier(contributor contracts.ContributorContext) float64 {
	modifier := 1.0
	modifier -= float64(min(contributor.RecentSimilarPullRequests, 5)) * 0.08
	modifier -= float64(min(contributor.RecentCategoryPullRequests, 8)) * 0.025
	if contributor.RecentRepositoryPullRequests >= 6 {
		modifier -= 0.1
	}
	if modifier < 0.6 {
		return 0.6
	}
	return modifier
}

func spamPenalty(req contracts.ScoreContributionRequest) float64 {
	penalty := 0.0
	if req.Analysis.Category == "documentation" && req.PullRequest.Additions+req.PullRequest.Deletions < 20 {
		penalty += 0.2
	}
	if req.PullRequest.ChangedFiles <= 2 && req.PullRequest.Additions+req.PullRequest.Deletions < 15 {
		penalty += 0.1
	}
	if req.Analysis.FileBreakdown.Source == 0 && req.Analysis.FileBreakdown.Tests == 0 && req.Analysis.FileBreakdown.Docs > 0 {
		penalty += 0.05
	}
	if penalty > 0.35 {
		return 0.35
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

func buildExplanation(req contracts.ScoreContributionRequest, totalXP int, spamPenalty, diminishingReturns float64) []string {
	explanation := []string{
		"score version " + ScoreVersion,
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

func LevelForXP(xp int) string {
	switch {
	case xp >= 250:
		return "Architect"
	case xp >= 180:
		return "Maintainer"
	case xp >= 140:
		return "Specialist"
	case xp >= 100:
		return "Builder"
	case xp >= 60:
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
