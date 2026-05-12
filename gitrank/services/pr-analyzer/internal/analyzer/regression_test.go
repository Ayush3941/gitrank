package analyzer

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/gitrank/gitrank/packages/contracts"
)

type regressionCase struct {
	Name                string                               `json:"name"`
	RiskType            string                               `json:"risk_type"`
	Note                string                               `json:"note"`
	Request             contracts.PullRequestAnalysisRequest `json:"request"`
	WantCategory        string                               `json:"want_category"`
	WantLanguages       []string                             `json:"want_languages"`
	WantIssueReferences []string                             `json:"want_issue_references"`
	WantCriticalityTags []string                             `json:"want_criticality_tags"`
	WantReviewCycles    int                                  `json:"want_review_cycles"`
	WantFlags           []string                             `json:"want_flags"`
}

func TestRegressionDataset(t *testing.T) {
	cases := loadRegressionCases(t)
	service := New()

	if len(cases) < 6 {
		t.Fatalf("regression dataset size = %d, want at least 6 representative cases", len(cases))
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			if tc.RiskType != "false_positive" && tc.RiskType != "false_negative" {
				t.Fatalf("risk_type = %q, want false_positive or false_negative", tc.RiskType)
			}
			if tc.Note == "" {
				t.Fatal("note is required for regression cases")
			}

			resp, err := service.Analyze(tc.Request)
			if err != nil {
				t.Fatalf("Analyze() error = %v", err)
			}
			if resp.Category != tc.WantCategory {
				t.Fatalf("Category = %q, want %q", resp.Category, tc.WantCategory)
			}
			if resp.ReviewCycles != tc.WantReviewCycles {
				t.Fatalf("ReviewCycles = %d, want %d", resp.ReviewCycles, tc.WantReviewCycles)
			}
			for _, language := range tc.WantLanguages {
				if !slices.Contains(resp.DetectedLanguages, language) {
					t.Fatalf("DetectedLanguages = %v, missing %q", resp.DetectedLanguages, language)
				}
			}
			for _, reference := range tc.WantIssueReferences {
				if !slices.Contains(resp.IssueReferences, reference) {
					t.Fatalf("IssueReferences = %v, missing %q", resp.IssueReferences, reference)
				}
			}
			for _, tag := range tc.WantCriticalityTags {
				if !slices.Contains(resp.CriticalityTags, tag) {
					t.Fatalf("CriticalityTags = %v, missing %q", resp.CriticalityTags, tag)
				}
			}
			for _, flag := range tc.WantFlags {
				if !slices.Contains(resp.Flags, flag) {
					t.Fatalf("Flags = %v, missing %q", resp.Flags, flag)
				}
			}
		})
	}
}

func loadRegressionCases(t *testing.T) []regressionCase {
	t.Helper()

	path := filepath.Join("testdata", "regression_cases.json")
	payload, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("os.ReadFile(%q) error = %v", path, err)
	}

	var cases []regressionCase
	if err := json.Unmarshal(payload, &cases); err != nil {
		t.Fatalf("json.Unmarshal(%q) error = %v", path, err)
	}
	return cases
}
