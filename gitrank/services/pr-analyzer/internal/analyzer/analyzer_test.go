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
	if len(resp.DetectedLanguages) != 1 || resp.DetectedLanguages[0] != "Markdown" {
		t.Fatalf("DetectedLanguages = %v, want [Markdown]", resp.DetectedLanguages)
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
	if resp.ReviewCycles != 0 {
		t.Fatalf("ReviewCycles = %d, want 0", resp.ReviewCycles)
	}
}

func TestAnalyzeDerivesIssueReferencesAndReviewCycles(t *testing.T) {
	service := New()

	resp, err := service.Analyze(contracts.PullRequestAnalysisRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo", PrimaryLanguage: "Go"},
		PullRequest: contracts.PullRequestContext{
			Title:        "fix: close #41 and harden token flow",
			Body:         "Resolves octo/repo#42 after review feedback.",
			ChangedFiles: 2,
			Files: []contracts.ChangedFile{
				{Path: "internal/auth/token.go"},
				{Path: "internal/auth/token_test.go"},
			},
			Reviews: []contracts.ReviewSignal{
				{State: "CHANGES_REQUESTED", AuthorAssociation: "MEMBER"},
				{State: "APPROVED", AuthorAssociation: "MEMBER"},
			},
		},
	})
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}

	if resp.ReviewCycles != 1 {
		t.Fatalf("ReviewCycles = %d, want 1", resp.ReviewCycles)
	}
	if len(resp.IssueReferences) != 2 || resp.IssueReferences[0] != "#41" || resp.IssueReferences[1] != "octo/repo#42" {
		t.Fatalf("IssueReferences = %v, want [#41 octo/repo#42]", resp.IssueReferences)
	}
	if len(resp.CriticalityTags) == 0 || resp.CriticalityTags[0] != "auth_identity" {
		t.Fatalf("CriticalityTags = %v, want auth_identity tag", resp.CriticalityTags)
	}
}
