package service

import (
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/services/scoring-engine/internal/scoring"
)

func TestBuildReplayMonitorsAndExcludesSelfMergedPullRequests(t *testing.T) {
	svc := &Service{engine: scoring.New()}
	now := time.Date(2026, time.May, 10, 12, 0, 0, 0, time.UTC)

	events, snapshot, badges, _, _ := svc.buildReplay("user-1", "replay", []replayCandidate{{
		PullRequestID:     "pr-1",
		AnalysisID:        "analysis-1",
		OccurredAt:        now.Add(-time.Hour),
		AnalysisCreatedAt: now,
		Repository: contracts.RepositoryContext{
			FullName:        "octo/repo",
			PrimaryLanguage: "Go",
			Stars:           100,
		},
		PullRequest: contracts.PullRequestContext{
			Number:       17,
			Title:        "Self-merged change",
			State:        "closed",
			Merged:       true,
			ChangedFiles: 3,
			Additions:    80,
			Deletions:    10,
			Commits:      1,
			Files: []contracts.ChangedFile{{
				Path:      "internal/service/service.go",
				Additions: 80,
				Deletions: 10,
				Status:    "modified",
			}},
			Reviews: []contracts.ReviewSignal{{
				State:             "APPROVED",
				AuthorAssociation: "OWNER",
			}},
		},
		AnalyzerVersion: "deterministic.v1",
		AnalysisSource:  contracts.AnalysisSourceDeterministic,
		Classification:  "feature",
		Confidence:      0.9,
		SignalHints:     []string{"languages=Go"},
		AuthorLogin:     "octocat",
		MergedByLogin:   "octocat",
	}}, now)

	if len(events) != 1 {
		t.Fatalf("events len = %d, want 1", len(events))
	}
	if events[0].DeltaXP != 0 {
		t.Fatalf("DeltaXP = %d, want self-merged PR excluded from XP", events[0].DeltaXP)
	}
	if !events[0].Suspicious {
		t.Fatal("Suspicious = false, want self-merge monitoring flag")
	}
	if selfMerged, _ := events[0].Metadata["self_merged"].(bool); !selfMerged {
		t.Fatalf("metadata self_merged = %v, want true", events[0].Metadata["self_merged"])
	}
	if version, _ := events[0].Metadata["score_formula_inputs_version"].(string); version != "score-components/v1" {
		t.Fatalf("score_formula_inputs_version = %q, want score-components/v1", version)
	}
	if totalXP, _ := events[0].Metadata["total_xp"].(int); totalXP != 0 {
		t.Fatalf("metadata total_xp = %v, want 0 after self-merge exclusion", events[0].Metadata["total_xp"])
	}
	if rawXP, _ := events[0].Metadata["raw_formula_total_xp"].(int); rawXP <= 0 {
		t.Fatalf("metadata raw_formula_total_xp = %v, want positive raw scorer value", events[0].Metadata["raw_formula_total_xp"])
	}
	if _, ok := events[0].Metadata["category_weight"].(float64); !ok {
		t.Fatalf("metadata category_weight = %T, want float64", events[0].Metadata["category_weight"])
	}
	if snapshot.TotalXP != 0 {
		t.Fatalf("snapshot TotalXP = %d, want 0", snapshot.TotalXP)
	}
	if snapshot.SuspiciousEvents != 1 {
		t.Fatalf("snapshot SuspiciousEvents = %d, want 1", snapshot.SuspiciousEvents)
	}
	if len(badges) != 0 {
		t.Fatalf("badges = %+v, want no first-merged badge for self-merged PR", badges)
	}
}

func TestIssueBadgesLinksPersistedPREvidence(t *testing.T) {
	now := time.Date(2026, time.May, 10, 12, 0, 0, 0, time.UTC)
	badges := issueBadges([]scoreEventRecord{
		{
			EventKey:      "pr:pr-1:analysis:a-1:score:v1alpha1",
			PullRequestID: "pr-1",
			DeltaXP:       180,
			SkillXP:       map[string]int{"testing": 120},
			Metadata:      map[string]any{"merged": true},
			CreatedAt:     now,
			Repository:    "octo/repo",
			PRNumber:      7,
			PRTitle:       "test: add replay coverage",
		},
	}, map[string]int{"testing": 120})

	if len(badges) != 2 {
		t.Fatalf("badges len = %d, want first merge and test builder", len(badges))
	}
	first := badges[0]
	if first.Key != "first_merged_pr" {
		t.Fatalf("first badge = %q, want first_merged_pr", first.Key)
	}
	if version, _ := first.Evidence["rule_version"].(string); version != "badges/v1" {
		t.Fatalf("rule_version = %q, want badges/v1", version)
	}
	ids, ok := first.Evidence["evidence_pr_ids"].([]string)
	if !ok || len(ids) != 1 || ids[0] != "pr-1" {
		t.Fatalf("evidence_pr_ids = %#v, want pr-1", first.Evidence["evidence_pr_ids"])
	}
	prs, ok := first.Evidence["evidence_prs"].([]map[string]any)
	if !ok || len(prs) != 1 || prs[0]["repository"] != "octo/repo" {
		t.Fatalf("evidence_prs = %#v, want linked PR evidence", first.Evidence["evidence_prs"])
	}
}
