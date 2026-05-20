package service

import (
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
)

func TestPullRequestReportFromRecordUsesPersistedScoreAndAnalysisEvidence(t *testing.T) {
	now := time.Date(2026, 5, 10, 14, 0, 0, 0, time.UTC)
	report := pullRequestReportFromRecord(pullRequestReportRecord{
		PullRequestID:   "pr-db-1",
		Owner:           "octo",
		Repo:            "repo",
		FullName:        "octo/repo",
		Stars:           2500,
		Number:          42,
		Title:           "test: cover gateway replay",
		Body:            "Fixes #12",
		State:           "closed",
		Merged:          true,
		Additions:       120,
		Deletions:       12,
		ChangedFiles:    4,
		OccurredAt:      now.Add(-time.Hour),
		UpdatedAt:       now.Add(-30 * time.Minute),
		AnalysisID:      "analysis-1",
		AnalysisVersion: "deterministic/v1",
		AnalysisSource:  "deterministic",
		Category:        "Testing",
		AIConfidence:    0.91,
		Summary:         "Added replay regression coverage.",
		AnalysisSignals: []string{"Regression coverage", "CI passed"},
		ScoreEventID:    "score-1",
		ScoreVersion:    "v1alpha1",
		XP:              420,
		ScoreMetadata: map[string]any{
			"total_xp":                     420,
			"category_weight":              1.1,
			"technical_depth":              0.72,
			"review_strength":              0.5,
			"repository_weight":            1.1,
			"outcome_weight":               1.4,
			"consistency_modifier":         1.04,
			"diminishing_returns_modifier": 0.97,
			"spam_penalty":                 0.05,
		},
		BadgeUnlocks: []badgeUnlockRecord{{
			Key:       "test_builder",
			AwardedAt: now.Add(-20 * time.Minute),
			Evidence: map[string]any{
				"rule":            "test_builder",
				"rule_version":    "badges/v1",
				"testing_xp":      120,
				"evidence_pr_ids": []any{"pr-db-1"},
			},
		}},
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
	if report.SuggestedQuest == nil || report.SuggestedQuest.ID == "" || report.SuggestedQuest.WhyRecommended == "" {
		t.Fatalf("SuggestedQuest = %+v, want materialized suggested quest", report.SuggestedQuest)
	}
	if !containsScoreComponent(report.ScoreComponents, "category_weight", "1.10x") {
		t.Fatalf("ScoreComponents = %+v, want persisted category weight", report.ScoreComponents)
	}
	if !containsScoreComponent(report.ScoreComponents, "technical_depth", "72%") {
		t.Fatalf("ScoreComponents = %+v, want persisted technical depth", report.ScoreComponents)
	}
	if !containsScoreComponent(report.ScoreComponents, "spam_penalty", "-5%") {
		t.Fatalf("ScoreComponents = %+v, want persisted spam penalty", report.ScoreComponents)
	}
	if len(report.BadgeUnlocks) != 1 || report.BadgeUnlocks[0].Key != "test_builder" {
		t.Fatalf("BadgeUnlocks = %+v, want linked test_builder badge", report.BadgeUnlocks)
	}
	if !containsString(report.BadgeUnlocks[0].EvidenceSignals, "testing_xp=120") {
		t.Fatalf("BadgeUnlocks[0].EvidenceSignals = %+v, want testing XP signal", report.BadgeUnlocks[0].EvidenceSignals)
	}
	if report.IsStale {
		t.Fatal("IsStale = true, want false with analysis and score event")
	}
	if report.EvidenceState.Status != "deterministic_only" || !report.EvidenceState.DeterministicOnly {
		t.Fatalf("EvidenceState = %+v, want deterministic_only", report.EvidenceState)
	}
	if report.EvidenceState.AnalysisSource != "deterministic" || report.EvidenceState.AnalysisConfidence != 0.91 {
		t.Fatalf("EvidenceState analysis = %q/%.2f, want deterministic/0.91", report.EvidenceState.AnalysisSource, report.EvidenceState.AnalysisConfidence)
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
	if report.EvidenceState.Status != "stale" || !containsString(report.EvidenceState.MissingEvidence, "analysis") || !containsString(report.EvidenceState.MissingEvidence, "score_event") {
		t.Fatalf("EvidenceState = %+v, want stale with missing analysis and score_event", report.EvidenceState)
	}
	if len(report.Penalties) == 0 || report.Penalties[0].Label != "No persisted score event" {
		t.Fatalf("penalties = %+v, want no persisted score event", report.Penalties)
	}
	if report.SuggestedQuest == nil || report.SuggestedQuest.ID != "quest-sync-first-evidence" {
		t.Fatalf("SuggestedQuest = %+v, want sync-first-evidence for stale report", report.SuggestedQuest)
	}
}

func TestPullRequestReportFromRecordInfersDeterministicSourceFromScoreMetadata(t *testing.T) {
	now := time.Date(2026, 5, 10, 14, 0, 0, 0, time.UTC)
	report := pullRequestReportFromRecord(pullRequestReportRecord{
		PullRequestID: "pr-db-2",
		Owner:         "octo",
		Repo:          "repo",
		Number:        77,
		Title:         "fix: harden retry path",
		State:         "closed",
		Merged:        true,
		OccurredAt:    now.Add(-2 * time.Hour),
		UpdatedAt:     now.Add(-90 * time.Minute),
		ScoreEventID:  "score-2",
		ScoreVersion:  "v1alpha1",
		ScoreMetadata: map[string]any{
			"technical_depth":      1.08,
			"review_strength":      0.75,
			"diminishing_returns":  0.84,
			"consistency_modifier": 1.12,
			"total_xp":             130,
		},
	}, now)

	if report.EvidenceState.AnalysisSource != "deterministic" {
		t.Fatalf("EvidenceState.AnalysisSource = %q, want deterministic", report.EvidenceState.AnalysisSource)
	}
	if !containsString(report.EvidenceState.Reasons, "deterministic scoring evidence is available while analysis snapshot persistence is pending") {
		t.Fatalf("EvidenceState.Reasons = %+v, want deterministic snapshot pending reason", report.EvidenceState.Reasons)
	}
}

func TestPullRequestReportFromRecordInfersDeterministicSourceFromScorePayloadWithoutAnalysis(t *testing.T) {
	now := time.Date(2026, 5, 10, 14, 0, 0, 0, time.UTC)
	report := pullRequestReportFromRecord(pullRequestReportRecord{
		PullRequestID:    "pr-db-3",
		Owner:            "octo",
		Repo:             "repo",
		Number:           91,
		Title:            "chore: harden retry metrics",
		State:            "closed",
		Merged:           true,
		OccurredAt:       now.Add(-3 * time.Hour),
		UpdatedAt:        now.Add(-2 * time.Hour),
		ScoreVersion:     "v1alpha1",
		XP:               95,
		ScoreExplanation: []string{"score version v1alpha1"},
	}, now)

	if report.EvidenceState.AnalysisSource != "deterministic" {
		t.Fatalf("EvidenceState.AnalysisSource = %q, want deterministic", report.EvidenceState.AnalysisSource)
	}
	if !report.EvidenceState.DeterministicOnly {
		t.Fatalf("EvidenceState.DeterministicOnly = false, want true with deterministic score payload")
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

func containsScoreComponent(values []contracts.PRReportScoreComponent, key, display string) bool {
	for _, value := range values {
		if value.Key == key && value.DisplayValue == display && value.Source != "" {
			return true
		}
	}
	return false
}
