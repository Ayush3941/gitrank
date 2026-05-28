package service

import (
	"testing"
	"time"
)

func TestSnapshotStalenessMarksPartialOnlyWhenScoreEvidenceMissing(t *testing.T) {
	now := time.Date(2026, 5, 27, 12, 0, 0, 0, time.UTC)

	partialSnapshot := snapshotRecord{
		ID:          "snap-partial",
		RefreshedAt: now,
		StaleAfter:  now.Add(15 * time.Minute),
	}
	partial := snapshotStaleness(partialSnapshot, now)
	if !partial.PartialProfileAvailable {
		t.Fatalf("PartialProfileAvailable = %t, want true for snapshot with no score evidence", partial.PartialProfileAvailable)
	}
	if got := skillEvidenceStateFromStaleness(partial); got != "partial" {
		t.Fatalf("skillEvidenceStateFromStaleness(partial) = %q, want partial", got)
	}

	evidenceSnapshot := snapshotRecord{
		ID:          "snap-evidence",
		RefreshedAt: now,
		StaleAfter:  now.Add(15 * time.Minute),
		TotalXP:     120,
	}
	evidence := snapshotStaleness(evidenceSnapshot, now)
	if evidence.PartialProfileAvailable {
		t.Fatalf("PartialProfileAvailable = %t, want false when score evidence exists", evidence.PartialProfileAvailable)
	}
	if got := skillEvidenceStateFromStaleness(evidence); got != "fresh" {
		t.Fatalf("skillEvidenceStateFromStaleness(evidence) = %q, want fresh", got)
	}
}

func TestSkillEvidenceStateFromStalenessPrefersStale(t *testing.T) {
	now := time.Date(2026, 5, 27, 12, 0, 0, 0, time.UTC)
	staleSnapshot := snapshotRecord{
		ID:          "snap-stale",
		RefreshedAt: now,
		StaleAfter:  now.Add(-time.Minute),
	}
	staleness := snapshotStaleness(staleSnapshot, now)
	if !staleness.IsStale {
		t.Fatalf("IsStale = %t, want true", staleness.IsStale)
	}
	if got := skillEvidenceStateFromStaleness(staleness); got != "stale" {
		t.Fatalf("skillEvidenceStateFromStaleness(stale) = %q, want stale", got)
	}
}
