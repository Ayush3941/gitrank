package analyzer

import (
	"testing"

	"github.com/Ayush3941/gitrank/packages/contracts"
)

func TestAnalyzeDocsOnlyPullRequest(t *testing.T) {
	service := New()

	resp, err := service.Analyze(contracts.PullRequestAnalysisRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo"},
		PullRequest: contracts.PullRequestContext{
			Title:        "docs: clarify installation",
			ChangedFiles: 2,
			Files: []contracts.ChangedFile{
				{Path: "README.md"},
				{Path: "docs/setup.md"},
			},
		},
	})
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}

	if resp.Category != "documentation" {
		t.Fatalf("Category = %q, want documentation", resp.Category)
	}
	if resp.FileBreakdown.Docs != 2 {
		t.Fatalf("Docs = %d, want 2", resp.FileBreakdown.Docs)
	}
	if resp.SchemaVersion != contracts.PullRequestAnalysisSchemaVersion {
		t.Fatalf("SchemaVersion = %q, want %q", resp.SchemaVersion, contracts.PullRequestAnalysisSchemaVersion)
	}
	if resp.AnalysisSource != contracts.AnalysisSourceDeterministic {
		t.Fatalf("AnalysisSource = %q, want %q", resp.AnalysisSource, contracts.AnalysisSourceDeterministic)
	}
}

func TestAnalyzeSecurityChange(t *testing.T) {
	service := New()

	resp, err := service.Analyze(contracts.PullRequestAnalysisRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo", PrimaryLanguage: "Go"},
		PullRequest: contracts.PullRequestContext{
			Title:        "security: rotate token validation logic",
			ChangedFiles: 3,
			Files: []contracts.ChangedFile{
				{Path: "internal/auth/validator.go"},
				{Path: "internal/auth/validator_test.go"},
				{Path: "docs/security.md"},
			},
			Reviews: []contracts.ReviewSignal{
				{State: "APPROVED", AuthorAssociation: "MEMBER"},
			},
		},
	})
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}

	if resp.Category != "security" {
		t.Fatalf("Category = %q, want security", resp.Category)
	}
	if resp.ReviewStrength <= 1.0 {
		t.Fatalf("ReviewStrength = %.2f, want > 1.0", resp.ReviewStrength)
	}
	if resp.ValidationStatus != contracts.AnalysisValidationValidated {
		t.Fatalf("ValidationStatus = %q, want %q", resp.ValidationStatus, contracts.AnalysisValidationValidated)
	}
}
