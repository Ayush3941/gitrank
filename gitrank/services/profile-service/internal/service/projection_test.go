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

func TestBuildSkillAreasIncludesEvidenceProvenance(t *testing.T) {
	rows := []scoreRow{
		{
			Skills:             map[string]int{"backend": 80},
			AnalysisSource:     "deterministic",
			AnalysisConfidence: 0.7,
		},
		{
			Skills:             map[string]int{"backend": 20, "testing": 40},
			AnalysisSource:     "ai_assisted",
			AnalysisConfidence: 0.9,
		},
	}

	skills := buildSkillAreas(rows, "fresh")
	if len(skills) != 2 {
		t.Fatalf("len(skills) = %d, want 2", len(skills))
	}
	backend := skills[0]
	if backend.Key != "backend" {
		t.Fatalf("top skill = %q, want backend", backend.Key)
	}
	if backend.EvidenceSource != "mixed" {
		t.Fatalf("EvidenceSource = %q, want mixed", backend.EvidenceSource)
	}
	if backend.Confidence < 0.73 || backend.Confidence > 0.75 {
		t.Fatalf("Confidence = %.4f, want weighted average around 0.74", backend.Confidence)
	}
	if backend.EvidenceState != "fresh" {
		t.Fatalf("EvidenceState = %q, want fresh", backend.EvidenceState)
	}
}

func TestPublicResponseMarksSkillEvidenceStale(t *testing.T) {
	now := time.Date(2026, 5, 5, 13, 0, 0, 0, time.UTC)
	snapshot := snapshotRecord{
		ID:        "snap-1",
		Summary:   structSummary("Ayush3941", now),
		ShareCard: shareCard("Ayush3941", now),
		Timeline:  emptyTimeline(now),
		TopSkills: []contracts.SkillAreaView{
			{
				Key:            "backend",
				TotalXP:        120,
				Percentage:     100,
				EvidenceSource: "deterministic",
				Confidence:     0.82,
				EvidenceState:  "fresh",
			},
		},
		StaleAfter:      now.Add(-time.Minute),
		RefreshedAt:     now.Add(-time.Hour),
		SourceWatermark: now.Add(-time.Hour),
	}

	response := publicResponseFromSnapshot(snapshot, contractsDefaults(), nil, now)
	if !response.Staleness.IsStale {
		t.Fatal("Staleness.IsStale = false, want true")
	}
	if got := response.TopSkillAreas[0].EvidenceState; got != "stale" {
		t.Fatalf("EvidenceState = %q, want stale", got)
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

func TestPrivateResponseIncludesRecentPullRequestReports(t *testing.T) {
	now := time.Date(2026, 5, 5, 13, 0, 0, 0, time.UTC)
	snapshot := snapshotRecord{
		ID:              "snap-1",
		Summary:         structSummary("Ayush3941", now),
		ShareCard:       shareCard("Ayush3941", now),
		Timeline:        emptyTimeline(now),
		StaleAfter:      now.Add(time.Hour),
		RefreshedAt:     now,
		SourceWatermark: now,
	}
	reports := []contracts.PullRequestReportResponse{
		{
			Contribution: contracts.PRReportContribution{
				ID:     "score-1",
				Owner:  "Ayush3941",
				Repo:   "gitrank",
				Number: 42,
				Title:  "Persist recent PR report",
			},
			ScoreVersion:    "v1alpha1",
			SourceUpdatedAt: now,
			GeneratedAt:     now,
		},
	}

	response := privateResponseFromSnapshot(snapshot, contractsDefaults(), nil, reports, now)

	if len(response.RecentPRReports) != 1 {
		t.Fatalf("len(RecentPRReports) = %d, want 1", len(response.RecentPRReports))
	}
	if response.RecentPRReports[0].Contribution.ID != "score-1" {
		t.Fatalf("recent report ID = %q, want score-1", response.RecentPRReports[0].Contribution.ID)
	}
}

func TestLeaderboardEntryFromSnapshotUsesProfileSnapshotEvidence(t *testing.T) {
	now := time.Date(2026, 5, 5, 13, 0, 0, 0, time.UTC)
	snapshot := snapshotRecord{
		TotalXP: 4200,
		Summary: contracts.PublicProfileSummary{
			Handle:      "octocat",
			DisplayName: "Octo Cat",
			AvatarURL:   "https://avatars.githubusercontent.com/u/1?v=4",
			TopSkills:   []string{"backend"},
		},
		ShareCard: contracts.ShareableProfileCard{
			Level: levelViewForXP(4200),
		},
		Timeline: contracts.ProfileTimeline{
			Points: []contracts.ProfileTimelinePoint{
				{DeltaXP: 120, TotalXP: 4080},
				{DeltaXP: 220, TotalXP: 4200},
			},
		},
		RefreshedAt: now.Add(-time.Hour),
		StaleAfter:  now.Add(time.Hour),
	}

	entry := leaderboardEntryFromSnapshot(snapshot, 3, now)
	if entry.Rank != 3 {
		t.Fatalf("Rank = %d, want 3", entry.Rank)
	}
	if entry.Handle != "octocat" || entry.DisplayName != "Octo Cat" {
		t.Fatalf("identity = %q/%q, want octocat/Octo Cat", entry.Handle, entry.DisplayName)
	}
	if entry.TotalXP != 4200 || entry.WeeklyXP != 220 {
		t.Fatalf("xp = total %d weekly %d, want total 4200 weekly 220", entry.TotalXP, entry.WeeklyXP)
	}
	if entry.Focus != "backend" {
		t.Fatalf("Focus = %q, want backend", entry.Focus)
	}
	if entry.IsStale {
		t.Fatal("IsStale = true, want false")
	}
}

func BenchmarkPublicProfileResponseFromSnapshot(b *testing.B) {
	now := time.Date(2026, 5, 5, 13, 0, 0, 0, time.UTC)
	snapshot := snapshotRecord{
		ID:        "snap-1",
		Summary:   structSummary("Ayush3941", now),
		ShareCard: shareCard("Ayush3941", now),
		Timeline:  emptyTimeline(now),
		TopSkills: skillAreaFixtures{
			{Key: "Backend", TotalXP: 4200},
			{Key: "Testing", TotalXP: 1700},
			{Key: "Security", TotalXP: 900},
		}.toViews(),
		Repositories: topRepositoryFixtures{
			{FullName: "Ayush3941/gitrank", Visibility: "public"},
			{FullName: "Ayush3941/profile-service", Visibility: "public"},
			{FullName: "Ayush3941/private-lab", Visibility: "public"},
		}.toViews(),
		Badges: []contracts.BadgeView{
			{Key: "backend-builder", Name: "Backend Builder", AwardedAt: now.AddDate(0, 0, -14)},
			{Key: "test-builder", Name: "Test Builder", AwardedAt: now.AddDate(0, 0, -7)},
		},
		ScoreHistory: []contracts.ScoreHistoryEntry{
			{EventID: "score-1", EventType: "contribution", DeltaXP: 1200, CreatedAt: now.AddDate(0, 0, -21)},
			{EventID: "score-2", EventType: "contribution", DeltaXP: 1400, CreatedAt: now.AddDate(0, 0, -14)},
			{EventID: "score-3", EventType: "contribution", DeltaXP: 1600, CreatedAt: now.AddDate(0, 0, -7)},
		},
		StaleAfter:      now.Add(time.Hour),
		RefreshedAt:     now,
		SourceWatermark: now,
	}
	settings := contractsDefaults()
	visibility := []repositoryVisibilityRecord{
		{FullName: "Ayush3941/private-lab", Visibility: "hidden"},
	}

	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = publicResponseFromSnapshot(snapshot, settings, visibility, now)
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
