package analyzer

import "strings"

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

func hasAnyKeyword(text string, keywords []string) bool {
	for _, keyword := range keywords {
		if strings.Contains(text, keyword) {
			return true
		}
	}
	return false
}
