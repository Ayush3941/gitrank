package analyzer

import (
	"encoding/json"
	"slices"
	"strings"
)

type AnalyzerPolicy struct {
	SecurityKeywords         []string            `json:"security_keywords"`
	PerformanceKeywords      []string            `json:"performance_keywords"`
	RefactorKeywords         []string            `json:"refactor_keywords"`
	BugFixKeywords           []string            `json:"bug_fix_keywords"`
	MaintainerDesignKeywords []string            `json:"maintainer_design_keywords"`
	GuardedSummaryPhrases    []string            `json:"guarded_summary_phrases"`
	CategorySkills           map[string][]string `json:"category_skills"`

	ConfidenceBase                float64 `json:"confidence_base"`
	ConfidenceDocsOnlyBonus       float64 `json:"confidence_docs_only_bonus"`
	ConfidenceSourceBonus         float64 `json:"confidence_source_bonus"`
	ConfidenceLabelsBonus         float64 `json:"confidence_labels_bonus"`
	ConfidenceIssueReferenceBonus float64 `json:"confidence_issue_reference_bonus"`
	ConfidenceCriticalityBonus    float64 `json:"confidence_criticality_bonus"`
	ConfidenceMax                 float64 `json:"confidence_max"`

	DepthBase              float64 `json:"depth_base"`
	DepthChangedFilesCap   int     `json:"depth_changed_files_cap"`
	DepthChangedFilesBonus float64 `json:"depth_changed_files_bonus"`
	DepthCommitsCap        int     `json:"depth_commits_cap"`
	DepthCommitsBonus      float64 `json:"depth_commits_bonus"`
	DepthDiffLinesCap      int     `json:"depth_diff_lines_cap"`
	DepthDiffLinesDivisor  float64 `json:"depth_diff_lines_divisor"`
	DepthSourceFilesBonus  float64 `json:"depth_source_files_bonus"`
	DepthTestFilesBonus    float64 `json:"depth_test_files_bonus"`
	DepthInfraSourceBonus  float64 `json:"depth_infra_source_bonus"`
	DepthCriticalityCap    int     `json:"depth_criticality_cap"`
	DepthCriticalityBonus  float64 `json:"depth_criticality_bonus"`
	DepthPolyglotBonus     float64 `json:"depth_polyglot_bonus"`
	DepthDraftPenalty      float64 `json:"depth_draft_penalty"`
	DepthMin               float64 `json:"depth_min"`
	DepthMax               float64 `json:"depth_max"`

	ReviewBase                     float64 `json:"review_base"`
	ReviewApprovedBonus            float64 `json:"review_approved_bonus"`
	ReviewChangesRequestedBonus    float64 `json:"review_changes_requested_bonus"`
	ReviewCommentedBonus           float64 `json:"review_commented_bonus"`
	ReviewMaintainerAssociationAdd float64 `json:"review_maintainer_association_bonus"`
	ReviewCyclesCap                int     `json:"review_cycles_cap"`
	ReviewCyclesBonus              float64 `json:"review_cycles_bonus"`
	ReviewMax                      float64 `json:"review_max"`

	ReviewMeaningfulThreshold float64 `json:"review_meaningful_threshold"`
	SmallChangeMaxFiles       int     `json:"small_change_max_files"`
	SmallChangeMaxDiffLines   int     `json:"small_change_max_diff_lines"`
}

func defaultAnalyzerPolicy() AnalyzerPolicy {
	return AnalyzerPolicy{
		SecurityKeywords:         []string{"security", "cve", "auth", "token", "oauth", "permission", "secret"},
		PerformanceKeywords:      []string{"performance", "latency", "optimiz", "throughput", "cache"},
		RefactorKeywords:         []string{"refactor", "cleanup", "rename", "simplify"},
		BugFixKeywords:           []string{"bug", "fix", "regression", "rollback", "repair", "correct"},
		MaintainerDesignKeywords: []string{"design", "architecture", "maintainer"},
		GuardedSummaryPhrases: []string{
			"expert",
			"world-class",
			"best-in-class",
			"perfect",
			"guaranteed",
			"proves",
			"proven",
			"mastered",
			"ownership",
			"authoritative",
			"definitive",
			"unambiguous",
			"certainly",
		},
		CategorySkills: map[string][]string{
			"documentation":     {"documentation"},
			"tests":             {"testing"},
			"bug_fix":           {"debugging", "backend"},
			"feature":           {"backend", "api_design"},
			"refactor":          {"systems", "tooling"},
			"performance":       {"performance", "backend"},
			"infrastructure":    {"tooling", "systems"},
			"security":          {"security", "backend"},
			"maintainer_design": {"systems", "api_design"},
		},

		ConfidenceBase:                0.6,
		ConfidenceDocsOnlyBonus:       0.25,
		ConfidenceSourceBonus:         0.1,
		ConfidenceLabelsBonus:         0.05,
		ConfidenceIssueReferenceBonus: 0.03,
		ConfidenceCriticalityBonus:    0.02,
		ConfidenceMax:                 0.95,

		DepthBase:              0.75,
		DepthChangedFilesCap:   12,
		DepthChangedFilesBonus: 0.04,
		DepthCommitsCap:        8,
		DepthCommitsBonus:      0.03,
		DepthDiffLinesCap:      800,
		DepthDiffLinesDivisor:  1000,
		DepthSourceFilesBonus:  0.08,
		DepthTestFilesBonus:    0.05,
		DepthInfraSourceBonus:  0.15,
		DepthCriticalityCap:    3,
		DepthCriticalityBonus:  0.05,
		DepthPolyglotBonus:     0.08,
		DepthDraftPenalty:      0.2,
		DepthMin:               0.5,
		DepthMax:               2.25,

		ReviewBase:                     0.85,
		ReviewApprovedBonus:            0.12,
		ReviewChangesRequestedBonus:    0.08,
		ReviewCommentedBonus:           0.03,
		ReviewMaintainerAssociationAdd: 0.05,
		ReviewCyclesCap:                3,
		ReviewCyclesBonus:              0.05,
		ReviewMax:                      1.5,

		ReviewMeaningfulThreshold: 1.1,
		SmallChangeMaxFiles:       2,
		SmallChangeMaxDiffLines:   14,
	}
}

func loadAnalyzerPolicy(rawJSON string) AnalyzerPolicy {
	policy := defaultAnalyzerPolicy()
	rawJSON = strings.TrimSpace(rawJSON)
	if rawJSON == "" {
		return policy
	}

	decoder := json.NewDecoder(strings.NewReader(rawJSON))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&policy); err != nil {
		return defaultAnalyzerPolicy()
	}
	return normalizeAnalyzerPolicy(policy)
}

func normalizeAnalyzerPolicy(policy AnalyzerPolicy) AnalyzerPolicy {
	defaults := defaultAnalyzerPolicy()

	policy.SecurityKeywords = normalizeTokenList(policy.SecurityKeywords, defaults.SecurityKeywords)
	policy.PerformanceKeywords = normalizeTokenList(policy.PerformanceKeywords, defaults.PerformanceKeywords)
	policy.RefactorKeywords = normalizeTokenList(policy.RefactorKeywords, defaults.RefactorKeywords)
	policy.BugFixKeywords = normalizeTokenList(policy.BugFixKeywords, defaults.BugFixKeywords)
	policy.MaintainerDesignKeywords = normalizeTokenList(policy.MaintainerDesignKeywords, defaults.MaintainerDesignKeywords)
	policy.GuardedSummaryPhrases = normalizeTokenList(policy.GuardedSummaryPhrases, defaults.GuardedSummaryPhrases)
	policy.CategorySkills = normalizeSkillMap(policy.CategorySkills, defaults.CategorySkills)

	policy.ConfidenceBase = pickFloat(policy.ConfidenceBase, defaults.ConfidenceBase)
	policy.ConfidenceDocsOnlyBonus = pickFloat(policy.ConfidenceDocsOnlyBonus, defaults.ConfidenceDocsOnlyBonus)
	policy.ConfidenceSourceBonus = pickFloat(policy.ConfidenceSourceBonus, defaults.ConfidenceSourceBonus)
	policy.ConfidenceLabelsBonus = pickFloat(policy.ConfidenceLabelsBonus, defaults.ConfidenceLabelsBonus)
	policy.ConfidenceIssueReferenceBonus = pickFloat(policy.ConfidenceIssueReferenceBonus, defaults.ConfidenceIssueReferenceBonus)
	policy.ConfidenceCriticalityBonus = pickFloat(policy.ConfidenceCriticalityBonus, defaults.ConfidenceCriticalityBonus)
	policy.ConfidenceMax = pickFloat(policy.ConfidenceMax, defaults.ConfidenceMax)

	policy.DepthBase = pickFloat(policy.DepthBase, defaults.DepthBase)
	policy.DepthChangedFilesCap = pickInt(policy.DepthChangedFilesCap, defaults.DepthChangedFilesCap)
	policy.DepthChangedFilesBonus = pickFloat(policy.DepthChangedFilesBonus, defaults.DepthChangedFilesBonus)
	policy.DepthCommitsCap = pickInt(policy.DepthCommitsCap, defaults.DepthCommitsCap)
	policy.DepthCommitsBonus = pickFloat(policy.DepthCommitsBonus, defaults.DepthCommitsBonus)
	policy.DepthDiffLinesCap = pickInt(policy.DepthDiffLinesCap, defaults.DepthDiffLinesCap)
	policy.DepthDiffLinesDivisor = pickFloat(policy.DepthDiffLinesDivisor, defaults.DepthDiffLinesDivisor)
	policy.DepthSourceFilesBonus = pickFloat(policy.DepthSourceFilesBonus, defaults.DepthSourceFilesBonus)
	policy.DepthTestFilesBonus = pickFloat(policy.DepthTestFilesBonus, defaults.DepthTestFilesBonus)
	policy.DepthInfraSourceBonus = pickFloat(policy.DepthInfraSourceBonus, defaults.DepthInfraSourceBonus)
	policy.DepthCriticalityCap = pickInt(policy.DepthCriticalityCap, defaults.DepthCriticalityCap)
	policy.DepthCriticalityBonus = pickFloat(policy.DepthCriticalityBonus, defaults.DepthCriticalityBonus)
	policy.DepthPolyglotBonus = pickFloat(policy.DepthPolyglotBonus, defaults.DepthPolyglotBonus)
	policy.DepthDraftPenalty = pickFloat(policy.DepthDraftPenalty, defaults.DepthDraftPenalty)
	policy.DepthMin = pickFloat(policy.DepthMin, defaults.DepthMin)
	policy.DepthMax = pickFloat(policy.DepthMax, defaults.DepthMax)
	if policy.DepthMax < policy.DepthMin {
		policy.DepthMax = policy.DepthMin
	}

	policy.ReviewBase = pickFloat(policy.ReviewBase, defaults.ReviewBase)
	policy.ReviewApprovedBonus = pickFloat(policy.ReviewApprovedBonus, defaults.ReviewApprovedBonus)
	policy.ReviewChangesRequestedBonus = pickFloat(policy.ReviewChangesRequestedBonus, defaults.ReviewChangesRequestedBonus)
	policy.ReviewCommentedBonus = pickFloat(policy.ReviewCommentedBonus, defaults.ReviewCommentedBonus)
	policy.ReviewMaintainerAssociationAdd = pickFloat(policy.ReviewMaintainerAssociationAdd, defaults.ReviewMaintainerAssociationAdd)
	policy.ReviewCyclesCap = pickInt(policy.ReviewCyclesCap, defaults.ReviewCyclesCap)
	policy.ReviewCyclesBonus = pickFloat(policy.ReviewCyclesBonus, defaults.ReviewCyclesBonus)
	policy.ReviewMax = pickFloat(policy.ReviewMax, defaults.ReviewMax)

	policy.ReviewMeaningfulThreshold = pickFloat(policy.ReviewMeaningfulThreshold, defaults.ReviewMeaningfulThreshold)
	policy.SmallChangeMaxFiles = pickInt(policy.SmallChangeMaxFiles, defaults.SmallChangeMaxFiles)
	policy.SmallChangeMaxDiffLines = pickInt(policy.SmallChangeMaxDiffLines, defaults.SmallChangeMaxDiffLines)

	return policy
}

func normalizeTokenList(raw []string, fallback []string) []string {
	normalized := make([]string, 0, len(raw))
	for _, item := range raw {
		item = strings.ToLower(strings.TrimSpace(item))
		if item == "" {
			continue
		}
		normalized = append(normalized, item)
	}
	normalized = slices.Compact(normalized)
	if len(normalized) == 0 {
		return slices.Clone(fallback)
	}
	return normalized
}

func normalizeSkillMap(raw map[string][]string, fallback map[string][]string) map[string][]string {
	if len(raw) == 0 {
		return cloneSkillMap(fallback)
	}
	normalized := make(map[string][]string, len(raw))
	for category, skills := range raw {
		category = strings.TrimSpace(category)
		if category == "" {
			continue
		}
		skillSet := make([]string, 0, len(skills))
		for _, skill := range skills {
			skill = strings.TrimSpace(skill)
			if skill == "" {
				continue
			}
			skillSet = append(skillSet, skill)
		}
		skillSet = slices.Compact(skillSet)
		if len(skillSet) == 0 {
			continue
		}
		normalized[category] = skillSet
	}
	if len(normalized) == 0 {
		return cloneSkillMap(fallback)
	}
	return normalized
}

func cloneSkillMap(source map[string][]string) map[string][]string {
	cloned := make(map[string][]string, len(source))
	for key, values := range source {
		cloned[key] = slices.Clone(values)
	}
	return cloned
}

func hasAnyKeyword(text string, keywords []string) bool {
	for _, keyword := range keywords {
		if strings.Contains(text, keyword) {
			return true
		}
	}
	return false
}

func pickFloat(value, fallback float64) float64 {
	if value <= 0 {
		return fallback
	}
	return value
}

func pickInt(value, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}
