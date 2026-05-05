package contracts

import "testing"

func TestPullRequestAnalysisResponseValidateRejectsScoreOverrideSignal(t *testing.T) {
	resp := PullRequestAnalysisResponse{
		SchemaVersion:    PullRequestAnalysisSchemaVersion,
		AnalyzerVersion:  "deterministic.v1",
		AnalysisSource:   AnalysisSourceDeterministic,
		ValidationStatus: AnalysisValidationValidated,
		FallbackReason:   "ai_not_enabled",
		Category:         "feature",
		Summary:          "feature PR touching 3 files",
		Confidence:       0.8,
		TechnicalDepth:   1.1,
		ReviewStrength:   1.0,
		Signals:          []string{"score_override=999"},
	}

	if err := resp.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want score override rejection")
	}
}

func TestPullRequestAnalysisResponseValidateForScoringRequiresPromptVersionForAI(t *testing.T) {
	resp := PullRequestAnalysisResponse{
		SchemaVersion:  PullRequestAnalysisSchemaVersion,
		AnalysisSource: AnalysisSourceAIAssisted,
		Category:       "security",
		TechnicalDepth: 1.2,
		ReviewStrength: 1.1,
		FileBreakdown:  FileBreakdown{Source: 2},
		Confidence:     0.74,
	}

	if err := resp.ValidateForScoring(); err == nil {
		t.Fatal("ValidateForScoring() error = nil, want missing prompt_version rejection")
	}
}

func TestScoreContributionRequestValidateAcceptsMinimalLegacyAnalysisForScoring(t *testing.T) {
	req := ScoreContributionRequest{
		Repository: RepositoryContext{FullName: "octo/repo"},
		PullRequest: PullRequestContext{
			ChangedFiles: 1,
			Additions:    3,
			Deletions:    1,
		},
		Analysis: PullRequestAnalysisResponse{
			Category:       "documentation",
			TechnicalDepth: 0.8,
			ReviewStrength: 0.9,
			FileBreakdown:  FileBreakdown{Docs: 1},
		},
	}

	if err := req.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
}
