package service

import (
	"strings"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
)

func TestLevelViewForXP(t *testing.T) {
	level := levelViewForXP(7840)
	if level.CurrentLevel != 27 {
		t.Fatalf("CurrentLevel = %d, want 27", level.CurrentLevel)
	}
	if level.RankTier != "Gold III" {
		t.Fatalf("RankTier = %q, want Gold III", level.RankTier)
	}
	if level.Label != "Specialist" {
		t.Fatalf("Label = %q, want Specialist", level.Label)
	}
}

func TestBuildStrengthSummaryUsesUncertaintyLanguage(t *testing.T) {
	summary := buildStrengthSummary(skillAreaFixtures{
		{Key: "Backend", TotalXP: 420},
		{Key: "Testing", TotalXP: 210},
	}.toViews())

	if !strings.Contains(summary, "Appears strongest") {
		t.Fatalf("summary = %q, want uncertainty language", summary)
	}
	if strings.Contains(strings.ToLower(summary), "expert") {
		t.Fatalf("summary = %q, should not overstate certainty", summary)
	}
}

func TestBuildTimelineProducesSixWeeklyBuckets(t *testing.T) {
	source := time.Date(2026, 5, 5, 13, 0, 0, 0, time.UTC)
	rows := []scoreRow{
		{DeltaXP: 100, CreatedAt: source.AddDate(0, 0, -2)},
		{DeltaXP: 80, CreatedAt: source.AddDate(0, 0, -10)},
		{DeltaXP: 40, CreatedAt: source.AddDate(0, 0, -16)},
	}

	timeline := buildTimeline(rows, source)
	if timeline.Window.Label != "last_6_weeks" {
		t.Fatalf("Window.Label = %q, want last_6_weeks", timeline.Window.Label)
	}
	if len(timeline.Points) != 6 {
		t.Fatalf("len(Points) = %d, want 6", len(timeline.Points))
	}
	if got := timeline.Points[len(timeline.Points)-1].TotalXP; got != 220 {
		t.Fatalf("last bucket TotalXP = %d, want 220", got)
	}
}

func TestPublicResponseFiltersHiddenRepositories(t *testing.T) {
	now := time.Date(2026, 5, 5, 13, 0, 0, 0, time.UTC)
	snapshot := snapshotRecord{
		ID:        "snap-1",
		Summary:   structSummary("Ayush3941", now),
		ShareCard: shareCard("Ayush3941", now),
		Timeline:  emptyTimeline(now),
		Repositories: topRepositoryFixtures{
			{FullName: "Ayush3941/gitrank", Visibility: "public"},
			{FullName: "Ayush3941/private-lab", Visibility: "public"},
		}.toViews(),
		StaleAfter:      now.Add(time.Hour),
		RefreshedAt:     now,
		SourceWatermark: now,
	}

	response := publicResponseFromSnapshot(snapshot, contractsDefaults(), []repositoryVisibilityRecord{
		{FullName: "Ayush3941/private-lab", Visibility: "hidden"},
	}, now)

	if len(response.TopRepositories) != 1 {
		t.Fatalf("len(TopRepositories) = %d, want 1", len(response.TopRepositories))
	}
	if response.TopRepositories[0].FullName != "Ayush3941/gitrank" {
		t.Fatalf("TopRepositories[0].FullName = %q, want Ayush3941/gitrank", response.TopRepositories[0].FullName)
	}
}

type skillAreaFixture struct {
	Key     string
	TotalXP int
}

type skillAreaFixtures []skillAreaFixture

func (f skillAreaFixtures) toViews() []contracts.SkillAreaView {
	out := make([]contracts.SkillAreaView, 0, len(f))
	for _, item := range f {
		out = append(out, contracts.SkillAreaView{Key: item.Key, TotalXP: item.TotalXP})
	}
	return out
}

type topRepositoryFixture struct {
	FullName   string
	Visibility string
}

type topRepositoryFixtures []topRepositoryFixture

func (f topRepositoryFixtures) toViews() []contracts.TopRepositoryView {
	out := make([]contracts.TopRepositoryView, 0, len(f))
	for _, item := range f {
		out = append(out, contracts.TopRepositoryView{FullName: item.FullName, Visibility: item.Visibility})
	}
	return out
}

func structSummary(handle string, now time.Time) contracts.PublicProfileSummary {
	return contracts.PublicProfileSummary{
		Handle:          handle,
		DisplayName:     handle,
		StrengthSummary: "Appears strongest in backend contributions based on public pull request evidence.",
		UpdatedAt:       now,
	}
}

func shareCard(handle string, now time.Time) contracts.ShareableProfileCard {
	return contracts.ShareableProfileCard{
		Handle:      handle,
		DisplayName: handle,
		Headline:    "Appears strongest in backend contributions based on public pull request evidence.",
		Level:       levelViewForXP(7840),
		RefreshedAt: now,
	}
}

func emptyTimeline(now time.Time) contracts.ProfileTimeline {
	return contracts.ProfileTimeline{
		Window: contracts.ProfileTimeWindow{
			Label:   "last_6_weeks",
			Bucket:  "week",
			StartAt: now.AddDate(0, 0, -35),
			EndAt:   now,
		},
	}
}

func contractsDefaults() contracts.ProfilePrivacySettings {
	return contracts.ProfilePrivacySettings{
		PublicProfileEnabled:         true,
		ShowExactPRs:                 true,
		ShowAISummaries:              true,
		ShowLeaderboardParticipation: true,
	}
}
