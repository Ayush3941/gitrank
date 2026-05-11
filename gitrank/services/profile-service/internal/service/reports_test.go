package service

import (
	"testing"
	"time"
)

func TestPullRequestReportFromRecordUsesPersistedScoreAndAnalysisEvidence(t *testing.T) {
	now := time.Date(2026, 5, 10, 14, 0, 0, 0, time.UTC)
	report := pullRequestReportFromRecord(pullRequestReportRecord{
		PullRequestID:      "pr-db-1",
		Owner:              "octo",
		Repo:               "repo",
		FullName:           "octo/repo",
		Stars:              2500,
		Number:             42,
		Title:              "test: cover gateway replay",
		Body:               "Fixes #12",
		State:              "closed",
		Merged:             true,
		Additions:          120,
		Deletions:          12,
		ChangedFiles:       4,
		OccurredAt:         now.Add(-time.Hour),
		UpdatedAt:          now.Add(-30 * time.Minute),
		AnalysisID:         "analysis-1",
		AnalysisVersion:    "deterministic/v1",
		Category:           "Testing",
		AIConfidence:       0.91,
		Summary:            "Added replay regression coverage.",
		AnalysisSignals:    []string{"Regression coverage", "CI passed"},
		ScoreEventID:       "score-1",
		ScoreVersion:       "v1alpha1",
		XP:                 420,
		ScoreMetadata:      map[string]any{"technical_depth": 0.72, "review_strength": 0.5, "diminishing_returns": 0.97},
		FileCount:          4,
		FeatureCount:       4,
		TestFiles:          2,
		ReviewCount:        1,
		ApprovalCount:      1,
		ReviewCommentCount: 2,
	}, now)

	if report.Contribution.ID != "score-1" {
		t.Fatalf("Contribution.ID = %q, want score-1", report.Contribution.ID)
	}
	if report.Contribution.Category != "Testing" {
		t.Fatalf("Category = %q, want Testing", report.Contribution.Category)
	}
	if report.Contribution.XPEarned != 420 {
		t.Fatalf("XPEarned = %d, want 420", report.Contribution.XPEarned)
	}
	if report.Contribution.DifficultyScore != 72 {
		t.Fatalf("DifficultyScore = %d, want 72", report.Contribution.DifficultyScore)
	}
	if !report.Contribution.MaintainerReviewed || !report.Contribution.LinkedIssue || !report.Contribution.CIPassed {
		t.Fatalf("expected maintainer review, linked issue, and CI evidence: %+v", report.Contribution)
	}
	if !containsString(report.Contribution.EvidenceSignals, "4 changed-file feature records persisted") {
		t.Fatalf("EvidenceSignals = %+v, want persisted feature signal", report.Contribution.EvidenceSignals)
	}
	if report.IsStale {
		t.Fatal("IsStale = true, want false with analysis and score event")
	}
}

func TestPullRequestReportFromRecordMarksUnscoredReportStale(t *testing.T) {
	now := time.Date(2026, 5, 10, 14, 0, 0, 0, time.UTC)
	report := pullRequestReportFromRecord(pullRequestReportRecord{
		PullRequestID: "pr-db-1",
		Owner:         "octo",
		Repo:          "repo",
		Number:        42,
		Title:         "feat: add API",
		State:         "open",
		OccurredAt:    now.Add(-time.Hour),
		UpdatedAt:     now.Add(-time.Hour),
	}, now)

	if !report.IsStale {
		t.Fatal("IsStale = false, want true without analysis and score event")
	}
	if len(report.Penalties) == 0 || report.Penalties[0].Label != "No persisted score event" {
		t.Fatalf("penalties = %+v, want no persisted score event", report.Penalties)
	}
}

func containsString(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}
