package config

import (
	"fmt"
	"os"
	"sort"
	"strings"
)

const DefaultScoreVersion = "v1alpha1"

type Scoring struct {
	ScoreVersion                    string
	BaseXP                          float64
	MinXP                           int
	LevelStepXP                     int
	ProfileScoreHistoryLimit        int
	RankTierBronzeLabel             string
	RankTierSilverLabel             string
	RankTierGoldLabel               string
	RankTierPlatinumLabel           string
	RankTierDiamondLabel            string
	RankTierSilverMinXP             int
	RankTierGoldMinXP               int
	RankTierPlatinumMinXP           int
	RankTierDiamondMinXP            int
	LeaderboardPromotionRule        string
	LeaderboardResetRule            string
	LeaderboardPromotionCutoffRank  int
	LeaderboardSafetyCutoffRank     int
	LeaderboardDefaultLimit         int
	LeaderboardMaxLimit             int
	LeaderboardBackfillDefaultWeeks int
	LeaderboardBackfillMaxWeeks     int
	HighXPThreshold                 int

	CategoryWeightDefault            float64
	CategoryWeightDocumentation      float64
	CategoryWeightTests              float64
	CategoryWeightBugFix             float64
	CategoryWeightFeature            float64
	CategoryWeightRefactor           float64
	CategoryWeightPerformance        float64
	CategoryWeightInfrastructure     float64
	CategoryWeightSecurity           float64
	CategoryWeightMaintainerDesign   float64
	RepositoryMaintainersThreshold   int
	RepositoryMaintainersBonus       float64
	RepositoryStarsTierOneThreshold  int
	RepositoryStarsTierOneBonus      float64
	RepositoryStarsTierTwoThreshold  int
	RepositoryStarsTierTwoBonus      float64
	RepositoryArchivedPenalty        float64
	RepositoryWeightMin              float64
	RepositoryWeightMax              float64
	OutcomeWeightMerged              float64
	OutcomeWeightDraft               float64
	OutcomeWeightClosed              float64
	OutcomeWeightOpen                float64
	ConsistencyActiveWeeksCap        int
	ConsistencyActiveWeekBonus       float64
	ConsistencyMeaningfulRatioBonus  float64
	ConsistencyRecentMergedThreshold int
	ConsistencyRecentMergedBonus     float64
	ConsistencyModifierMax           float64
	ReviewStrengthBase               float64
	ReviewStrengthCommentedBonus     float64
	ReviewStrengthApprovedBonus      float64
	ReviewStrengthApprovedCap        int
	ReviewStrengthChangesBonus       float64
	ReviewStrengthChangesCap         int
	ReviewStrengthDenseThreshold     int
	ReviewStrengthDenseBonus         float64
	ReviewStrengthMax                float64
	TechnicalDepthBase               float64
	TechnicalDepthSourceBonus        float64
	TechnicalDepthTestsBonus         float64
	TechnicalDepthInfraConfigBonus   float64
	TechnicalDepthCrossSurfaceBonus  float64
	TechnicalDepthChangedFilesMin    int
	TechnicalDepthChangedFilesBonus  float64
	TechnicalDepthChangeVolumeMin    int
	TechnicalDepthChangeVolumeBonus  float64
	TechnicalDepthCriticalityCap     int
	TechnicalDepthCriticalityBonus   float64
	TechnicalDepthMax                float64
	BadgeMultiRepoRepositoryMin      int
	BadgeSecurityXPMin               int
	BadgeTestingXPMin                int
	BadgeConsistencyWeeksMin         int
	BadgeEvidencePRLimit             int
	DiminishingSimilarCap            int
	DiminishingSimilarStep           float64
	DiminishingCategoryCap           int
	DiminishingCategoryStep          float64
	DiminishingRepositoryThreshold   int
	DiminishingRepositoryPenalty     float64
	DiminishingModifierMin           float64
	SpamDocsSmallChangeSizeLimit     int
	SpamDocsSmallChangePenalty       float64
	SpamTinyChangedFilesLimit        int
	SpamTinyChangeSizeLimit          int
	SpamTinyChangePenalty            float64
	SpamDocsOnlyPenalty              float64
	SpamPenaltyMax                   float64
	SpamMultiplierFloor              float64
	SuspiciousPenaltyThreshold       float64
	LevelContributorMinXP            int
	LevelBuilderMinXP                int
	LevelSpecialistMinXP             int
	LevelMaintainerMinXP             int
	LevelArchitectMinXP              int
}

// DefaultScoringPolicy returns the complete v1alpha1 policy. Formula changes must
// update this policy's version and the replay regression expectations together.
func DefaultScoringPolicy() Scoring {
	return Scoring{
		ScoreVersion:                    DefaultScoreVersion,
		BaseXP:                          100,
		MinXP:                           10,
		LevelStepXP:                     300,
		ProfileScoreHistoryLimit:        100,
		RankTierBronzeLabel:             "Bronze I",
		RankTierSilverLabel:             "Silver II",
		RankTierGoldLabel:               "Gold III",
		RankTierPlatinumLabel:           "Platinum I",
		RankTierDiamondLabel:            "Diamond",
		RankTierSilverMinXP:             1500,
		RankTierGoldMinXP:               4000,
		RankTierPlatinumMinXP:           9000,
		RankTierDiamondMinXP:            15000,
		LeaderboardPromotionRule:        "Top 25 move toward the next rank tier when the season locks.",
		LeaderboardResetRule:            "Weekly XP resets after the window; total XP and score evidence are retained.",
		LeaderboardPromotionCutoffRank:  25,
		LeaderboardSafetyCutoffRank:     75,
		LeaderboardDefaultLimit:         50,
		LeaderboardMaxLimit:             100,
		LeaderboardBackfillDefaultWeeks: 26,
		LeaderboardBackfillMaxWeeks:     156,
		HighXPThreshold:                 200,

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
		ReviewStrengthBase:               0.8,
		ReviewStrengthCommentedBonus:     0.05,
		ReviewStrengthApprovedBonus:      0.12,
		ReviewStrengthApprovedCap:        3,
		ReviewStrengthChangesBonus:       0.18,
		ReviewStrengthChangesCap:         2,
		ReviewStrengthDenseThreshold:     4,
		ReviewStrengthDenseBonus:         0.1,
		ReviewStrengthMax:                2.1,
		TechnicalDepthBase:               0.75,
		TechnicalDepthSourceBonus:        0.2,
		TechnicalDepthTestsBonus:         0.12,
		TechnicalDepthInfraConfigBonus:   0.08,
		TechnicalDepthCrossSurfaceBonus:  0.12,
		TechnicalDepthChangedFilesMin:    5,
		TechnicalDepthChangedFilesBonus:  0.12,
		TechnicalDepthChangeVolumeMin:    200,
		TechnicalDepthChangeVolumeBonus:  0.15,
		TechnicalDepthCriticalityCap:     3,
		TechnicalDepthCriticalityBonus:   0.08,
		TechnicalDepthMax:                2.4,
		BadgeMultiRepoRepositoryMin:      3,
		BadgeSecurityXPMin:               120,
		BadgeTestingXPMin:                100,
		BadgeConsistencyWeeksMin:         4,
		BadgeEvidencePRLimit:             5,

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

func loadScoringPolicy() Scoring {
	policy := DefaultScoringPolicy()
	policy.ProfileScoreHistoryLimit = getInt("SCORING_PROFILE_SCORE_HISTORY_LIMIT", policy.ProfileScoreHistoryLimit)
	policy.LeaderboardDefaultLimit = getInt("SCORING_LEADERBOARD_DEFAULT_LIMIT", policy.LeaderboardDefaultLimit)
	policy.LeaderboardMaxLimit = getInt("SCORING_LEADERBOARD_MAX_LIMIT", policy.LeaderboardMaxLimit)
	policy.LeaderboardBackfillDefaultWeeks = getInt("SCORING_LEADERBOARD_BACKFILL_DEFAULT_WEEKS", policy.LeaderboardBackfillDefaultWeeks)
	policy.LeaderboardBackfillMaxWeeks = getInt("SCORING_LEADERBOARD_BACKFILL_MAX_WEEKS", policy.LeaderboardBackfillMaxWeeks)
	return policy
}

func validateScoringEnvironment() error {
	var removed []string
	for _, entry := range os.Environ() {
		key, value, _ := strings.Cut(entry, "=")
		if !strings.HasPrefix(key, "SCORING_") || strings.TrimSpace(value) == "" {
			continue
		}
		switch key {
		case "SCORING_ENGINE_ADDR", "SCORING_ENGINE_BASE_URL",
			"SCORING_PROFILE_SCORE_HISTORY_LIMIT", "SCORING_LEADERBOARD_DEFAULT_LIMIT",
			"SCORING_LEADERBOARD_MAX_LIMIT", "SCORING_LEADERBOARD_BACKFILL_DEFAULT_WEEKS",
			"SCORING_LEADERBOARD_BACKFILL_MAX_WEEKS":
			continue
		}
		removed = append(removed, key)
	}
	if len(removed) == 0 {
		return nil
	}
	sort.Strings(removed)
	return fmt.Errorf("scoring rules are compiled in policy %s; remove environment overrides: %s", DefaultScoreVersion, strings.Join(removed, ", "))
}
