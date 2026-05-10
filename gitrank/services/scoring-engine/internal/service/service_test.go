package service

import (
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
	"github.com/Ayush3941/gitrank/services/scoring-engine/internal/scoring"
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
