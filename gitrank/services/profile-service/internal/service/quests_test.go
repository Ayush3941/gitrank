package service

import (
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
)

func TestBuildQuestsFromSnapshotDerivesFromScoreEvidence(t *testing.T) {
	now := time.Date(2026, 5, 10, 14, 0, 0, 0, time.UTC)
	snapshot := snapshotRecord{
		TopSkills: []contracts.SkillAreaView{
			{Key: "backend", TotalXP: 900},
			{Key: "testing", TotalXP: 120},
		},
		Timeline: contracts.ProfileTimeline{
			Points: []contracts.ProfileTimelinePoint{
				{DeltaXP: 100},
				{DeltaXP: 0},
				{DeltaXP: 80},
				{DeltaXP: 60},
				{DeltaXP: 30},
			},
		},
		ScoreHistory: []contracts.ScoreHistoryEntry{
			scoreHistoryFixture("evt-review-3", "Maintainer approved API change", now.Add(-1*time.Hour)),
			scoreHistoryFixture("evt-review-2", "Addressed requested changes in review", now.Add(-2*time.Hour)),
			scoreHistoryFixture("evt-review-1", "Maintainer review clarified schema", now.Add(-3*time.Hour)),
			scoreHistoryFixture("evt-test-1", "Added regression test coverage", now.Add(-4*time.Hour)),
		},
		RefreshedAt: now,
		StaleAfter:  now.Add(time.Hour),
	}

	quests := buildQuestsFromSnapshot(snapshot, now)
	if len(quests) == 0 {
		t.Fatal("expected generated quests")
	}

	reviewQuest := questByID(quests, "quest-maintainer-review")
	if reviewQuest == nil {
		t.Fatal("quest-maintainer-review missing")
	}
	if reviewQuest.Status != "Completed" {
		t.Fatalf("review status = %q, want Completed", reviewQuest.Status)
	}
	if reviewQuest.Progress != 3 || reviewQuest.Goal != 3 {
		t.Fatalf("review progress = %d/%d, want 3/3", reviewQuest.Progress, reviewQuest.Goal)
	}
	if len(reviewQuest.EvidenceReferences) != 3 {
		t.Fatalf("review evidence refs = %d, want 3", len(reviewQuest.EvidenceReferences))
	}

	weakQuest := questByID(quests, "quest-weak-lane-security")
	if weakQuest == nil {
		t.Fatal("security weak-lane quest missing")
	}
	if weakQuest.WeakAreaTarget != "security" {
		t.Fatalf("weak target = %q, want security", weakQuest.WeakAreaTarget)
	}
	if weakQuest.Progress != 0 {
		t.Fatalf("weak progress = %d, want 0 without security evidence", weakQuest.Progress)
	}
}

func TestBuildQuestsFromSnapshotUsesSyncUnlockWhenNoEvidenceExists(t *testing.T) {
	now := time.Date(2026, 5, 10, 14, 0, 0, 0, time.UTC)
	quests := buildQuestsFromSnapshot(snapshotRecord{RefreshedAt: now, StaleAfter: now.Add(time.Hour)}, now)

	if len(quests) != 1 {
		t.Fatalf("len(quests) = %d, want 1", len(quests))
	}
	if quests[0].ID != "quest-sync-first-evidence" {
		t.Fatalf("quest id = %q, want quest-sync-first-evidence", quests[0].ID)
	}
	if quests[0].Status != "Active" {
		t.Fatalf("quest status = %q, want Active", quests[0].Status)
	}
}

func scoreHistoryFixture(eventID, explanation string, createdAt time.Time) contracts.ScoreHistoryEntry {
	return contracts.ScoreHistoryEntry{
		EventID:     eventID,
		EventType:   "score.computed",
		DeltaXP:     120,
		CreatedAt:   createdAt,
		Explanation: []string{explanation},
		PullRequest: &contracts.PullRequestReference{
			Repository: "octo/repo",
			Number:     42,
			Title:      explanation,
		},
	}
}

func questByID(quests []contracts.QuestView, id string) *contracts.QuestView {
	for i := range quests {
		if quests[i].ID == id {
			return &quests[i]
		}
	}
	return nil
}
