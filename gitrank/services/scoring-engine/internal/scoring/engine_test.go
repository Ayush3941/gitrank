package scoring

import (
	"testing"

	"github.com/Ayush3941/gitrank/packages/contracts"
)

func TestScoreMergedSecurityContribution(t *testing.T) {
	engine := New()

	resp := engine.Score(contracts.ScoreContributionRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo", Maintainers: 4, Stars: 1200},
		PullRequest: contracts.PullRequestContext{
			Merged:       true,
			ChangedFiles: 4,
			Additions:    160,
			Deletions:    40,
		},
		Analysis: contracts.PullRequestAnalysisResponse{
			Category:       "security",
			TechnicalDepth: 1.7,
			ReviewStrength: 1.2,
			Skills:         []string{"security", "backend"},
		},
		Contributor: contracts.ContributorContext{
			ConsecutiveActiveWeeks:      6,
			MeaningfulContributionRatio: 0.8,
			RecentMergedPullRequests:    7,
		},
	})

	if resp.TotalXP < 200 {
		t.Fatalf("TotalXP = %d, want >= 200", resp.TotalXP)
	}
	if resp.Level == "Explorer" {
		t.Fatalf("Level = %q, want stronger level", resp.Level)
	}
}

func TestScoreSmallDocsChangeGetsPenalty(t *testing.T) {
	engine := New()

	resp := engine.Score(contracts.ScoreContributionRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo"},
		PullRequest: contracts.PullRequestContext{
			State:        "open",
			ChangedFiles: 1,
			Additions:    4,
			Deletions:    2,
		},
		Analysis: contracts.PullRequestAnalysisResponse{
			Category:       "documentation",
			TechnicalDepth: 0.8,
			ReviewStrength: 0.9,
			Skills:         []string{"documentation"},
			FileBreakdown:  contracts.FileBreakdown{Docs: 1},
		},
	})

	if resp.SpamPenalty <= 0 {
		t.Fatalf("SpamPenalty = %.2f, want > 0", resp.SpamPenalty)
	}
}

func TestScoreRepeatedSimilarContributionGetsDiminishingReturns(t *testing.T) {
	engine := New()

	baseline := engine.Score(contracts.ScoreContributionRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo"},
		PullRequest: contracts.PullRequestContext{
			Merged:       true,
			ChangedFiles: 3,
			Additions:    80,
			Deletions:    20,
		},
		Analysis: contracts.PullRequestAnalysisResponse{
			Category:       "feature",
			TechnicalDepth: 1.2,
			ReviewStrength: 1.1,
			Skills:         []string{"backend"},
		},
	})

	repeated := engine.Score(contracts.ScoreContributionRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo"},
		PullRequest: contracts.PullRequestContext{
			Merged:       true,
			ChangedFiles: 3,
			Additions:    80,
			Deletions:    20,
		},
		Analysis: contracts.PullRequestAnalysisResponse{
			Category:       "feature",
			TechnicalDepth: 1.2,
			ReviewStrength: 1.1,
			Skills:         []string{"backend"},
		},
		Contributor: contracts.ContributorContext{
			RecentRepositoryPullRequests: 6,
			RecentCategoryPullRequests:   5,
			RecentSimilarPullRequests:    3,
		},
	})

	if repeated.DiminishingReturnsModifier >= 1 {
		t.Fatalf("DiminishingReturnsModifier = %.2f, want < 1", repeated.DiminishingReturnsModifier)
	}
	if repeated.TotalXP >= baseline.TotalXP {
		t.Fatalf("repeated TotalXP = %d, want < baseline %d", repeated.TotalXP, baseline.TotalXP)
	}
}
