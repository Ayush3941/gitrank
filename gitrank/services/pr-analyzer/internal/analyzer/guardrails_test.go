package analyzer

import (
	"strings"
	"testing"

	"github.com/gitrank/gitrank/packages/contracts"
)

func TestHallucinationGuardrailsRejectUnsupportedLanguageClaims(t *testing.T) {
	req := contracts.PullRequestAnalysisRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo", PrimaryLanguage: "Go"},
		PullRequest: contracts.PullRequestContext{
			Title:        "fix: tighten token parsing",
			ChangedFiles: 1,
			Files: []contracts.ChangedFile{
				{Path: "internal/auth/token.go"},
			},
		},
	}
	breakdown := classifyFiles(req.PullRequest.Files)
	features := deriveFeatures(req, breakdown)

	resp := contracts.PullRequestAnalysisResponse{
		Category:                "bug_fix",
		Summary:                 "bug fix PR touching 1 files; 1 source; primary language Go",
		DetectedLanguages:       []string{"Go", "Python"},
		PrimaryDetectedLanguage: "Go",
		CriticalityTags:         []string{"auth_identity"},
		Skills:                  []string{"debugging", "backend"},
		Flags:                   []string{"critical_path_change"},
	}

	err := applyHallucinationGuardrails(req, breakdown, features, resp)
	if err == nil || !strings.Contains(err.Error(), `detected_languages entry "Python"`) {
		t.Fatalf("applyHallucinationGuardrails() error = %v, want unsupported language rejection", err)
	}
}

func TestHallucinationGuardrailsRejectUnsupportedIssueReferences(t *testing.T) {
	req := contracts.PullRequestAnalysisRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo"},
		PullRequest: contracts.PullRequestContext{
			Title:        "fix: close #41",
			Body:         "follow up for auth cleanup",
			ChangedFiles: 1,
			Files: []contracts.ChangedFile{
				{Path: "internal/auth/token.go"},
			},
		},
	}
	breakdown := classifyFiles(req.PullRequest.Files)
	features := deriveFeatures(req, breakdown)

	resp := contracts.PullRequestAnalysisResponse{
		Category:          "bug_fix",
		Summary:           "bug fix PR touching 1 files; 1 source; linked issues 1",
		DetectedLanguages: []string{"Go"},
		IssueReferences:   []string{"#41", "octo/repo#999"},
		CriticalityTags:   []string{"auth_identity"},
		Skills:            []string{"debugging", "backend"},
		Flags:             []string{"critical_path_change"},
	}

	err := applyHallucinationGuardrails(req, breakdown, features, resp)
	if err == nil || !strings.Contains(err.Error(), `issue_references entry "octo/repo#999"`) {
		t.Fatalf("applyHallucinationGuardrails() error = %v, want unsupported issue reference rejection", err)
	}
}

func TestHallucinationGuardrailsRejectOverconfidentSummaryPhrases(t *testing.T) {
	req := contracts.PullRequestAnalysisRequest{
		Repository: contracts.RepositoryContext{FullName: "octo/repo"},
		PullRequest: contracts.PullRequestContext{
			Title:        "security: rotate OAuth token validation",
			ChangedFiles: 1,
			Files: []contracts.ChangedFile{
				{Path: "internal/auth/token.go"},
			},
		},
	}
	breakdown := classifyFiles(req.PullRequest.Files)
	features := deriveFeatures(req, breakdown)

	resp := contracts.PullRequestAnalysisResponse{
		Category:          "security",
		Summary:           "Expert security PR with guaranteed ownership of auth architecture.",
		DetectedLanguages: []string{"Go"},
		CriticalityTags:   []string{"auth_identity"},
		Skills:            []string{"security", "backend"},
		Flags:             []string{"critical_path_change"},
	}

	err := applyHallucinationGuardrails(req, breakdown, features, resp)
	if err == nil || !strings.Contains(err.Error(), `summary contains unsupported certainty phrase "expert"`) {
		t.Fatalf("applyHallucinationGuardrails() error = %v, want certainty phrase rejection", err)
	}
}
