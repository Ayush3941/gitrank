package service

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
)

const (
	profileStaleTTL = 15 * time.Minute
	levelStepXP     = 300
)

func buildSnapshot(user userRecord, scoreRows []scoreRow, badges []badgeRecord, now time.Time) snapshotRecord {
	totalXP := 0
	mergedPRs := make(map[string]struct{})
	for _, row := range scoreRows {
		totalXP += row.DeltaXP
		if row.Repository != "" && row.PRNumber > 0 && row.PRMerged {
			mergedPRs[fmt.Sprintf("%s#%d", row.Repository, row.PRNumber)] = struct{}{}
		}
	}

	sourceWatermark := latestWatermark(scoreRows, badges, now)
	level := levelViewForXP(totalXP)
	skills := buildSkillAreas(scoreRows, "fresh")
	timeline := buildTimeline(scoreRows, sourceWatermark)
	repositories := buildTopRepositories(scoreRows)
	badgeViews := buildBadgeViews(badges)
	history := buildScoreHistory(scoreRows)

	handle := strings.TrimSpace(user.Handle)
	if handle == "" {
		handle = strings.TrimSpace(user.GitHubLogin)
	}

	displayName := strings.TrimSpace(user.DisplayName)
	if displayName == "" {
		displayName = handle
	}

	topSkillKeys := topSkillKeys(skills, 3)
	summary := contracts.PublicProfileSummary{
		Handle:             handle,
		DisplayName:        displayName,
		AvatarURL:          strings.TrimSpace(user.AvatarURL),
		Bio:                strings.TrimSpace(user.Bio),
		TotalXP:            totalXP,
		StrengthSummary:    buildStrengthSummary(skills),
		TopSkills:          topSkillKeys,
		BadgesEarned:       len(badgeViews),
		MergedPullRequests: len(mergedPRs),
		UpdatedAt:          now.UTC(),
	}

	shareCard := contracts.ShareableProfileCard{
		Handle:      handle,
		DisplayName: displayName,
		AvatarURL:   strings.TrimSpace(user.AvatarURL),
		Headline:    summary.StrengthSummary,
		Level:       level,
		TotalXP:     totalXP,
		TopSkills:   topSkillKeys,
		BadgeKeys:   topBadgeKeys(badgeViews, 3),
		RefreshedAt: now.UTC(),
	}

	return snapshotRecord{
		SnapshotVersion: profileSnapshotVersion,
		TotalXP:         totalXP,
		LevelLabel:      level.Label,
		Summary:         summary,
		TopSkills:       skills,
		Badges:          badgeViews,
		Timeline:        timeline,
		Repositories:    repositories,
		ScoreHistory:    history,
		ShareCard:       shareCard,
		RefreshedAt:     now.UTC(),
		StaleAfter:      now.UTC().Add(profileStaleTTL),
		SourceWatermark: sourceWatermark.UTC(),
	}
}

func latestWatermark(scoreRows []scoreRow, badges []badgeRecord, fallback time.Time) time.Time {
	latest := fallback.UTC()
	for _, row := range scoreRows {
		if row.CreatedAt.After(latest) {
			latest = row.CreatedAt.UTC()
		}
	}
	for _, badge := range badges {
		if badge.AwardedAt.After(latest) {
			latest = badge.AwardedAt.UTC()
		}
	}
	return latest
}

func buildSkillAreas(scoreRows []scoreRow, evidenceState string) []contracts.SkillAreaView {
	type aggregate struct {
		totalXP            int
		sources            map[string]struct{}
		confidenceWeighted float64
		confidenceWeight   int
	}

	skillTotals := make(map[string]*aggregate)
	for _, row := range scoreRows {
		source := normalizeSkillEvidenceSource(row.AnalysisSource)
		for key, value := range row.Skills {
			key = strings.TrimSpace(key)
			if key == "" || value <= 0 {
				continue
			}
			current, ok := skillTotals[key]
			if !ok {
				current = &aggregate{sources: map[string]struct{}{}}
				skillTotals[key] = current
			}
			current.totalXP += value
			current.sources[source] = struct{}{}
			if row.AnalysisConfidence > 0 {
				current.confidenceWeighted += row.AnalysisConfidence * float64(value)
				current.confidenceWeight += value
			}
		}
	}

	total := 0
	for _, value := range skillTotals {
		total += value.totalXP
	}

	out := make([]contracts.SkillAreaView, 0, len(skillTotals))
	for key, value := range skillTotals {
		percentage := 0.0
		if total > 0 {
			percentage = float64(value.totalXP) * 100 / float64(total)
		}
		confidence := 0.0
		if value.confidenceWeight > 0 {
			confidence = value.confidenceWeighted / float64(value.confidenceWeight)
		}
		out = append(out, contracts.SkillAreaView{
			Key:            key,
			TotalXP:        value.totalXP,
			Percentage:     percentage,
			Summary:        skillSummary(key),
			EvidenceSource: skillEvidenceSource(value.sources),
			Confidence:     confidence,
			EvidenceState:  normalizeSkillEvidenceState(evidenceState),
		})
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].TotalXP == out[j].TotalXP {
			return out[i].Key < out[j].Key
		}
		return out[i].TotalXP > out[j].TotalXP
	})
	return out
}

func normalizeSkillEvidenceSource(source string) string {
	switch strings.ToLower(strings.TrimSpace(source)) {
	case "ai", "ai_assisted", "llm":
		return "ai_assisted"
	case "deterministic", "rules":
		return "deterministic"
	case "":
		return "unknown"
	default:
		return strings.ToLower(strings.TrimSpace(source))
	}
}

func skillEvidenceSource(sources map[string]struct{}) string {
	if len(sources) == 0 {
		return "unknown"
	}
	if len(sources) > 1 {
		return "mixed"
	}
	for source := range sources {
		return source
	}
	return "unknown"
}

func normalizeSkillEvidenceState(state string) string {
	switch strings.ToLower(strings.TrimSpace(state)) {
	case "fresh", "stale", "partial":
		return strings.ToLower(strings.TrimSpace(state))
	default:
		return "fresh"
	}
}

func skillSummary(key string) string {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case "backend":
		return "Appears strongest in backend-oriented contribution evidence."
	case "testing":
		return "Recent scoring evidence shows a test-heavy contribution pattern."
	case "documentation":
		return "Documentation work shows repeated high-context contribution signals."
	case "security":
		return "Security evidence exists, but it remains a smaller part of the profile."
	case "architecture":
		return "Cross-service and design-oriented work appears repeatedly in scored evidence."
	case "review":
		return "Review-driven signals are present but should be interpreted conservatively."
	default:
		return "Strength area derived from scored contribution evidence."
	}
}

func buildTopRepositories(scoreRows []scoreRow) []contracts.TopRepositoryView {
	type aggregate struct {
		contracts.TopRepositoryView
		merged map[int]struct{}
		skills map[string]int
	}

	byRepo := make(map[string]*aggregate)
	for _, row := range scoreRows {
		if strings.TrimSpace(row.Repository) == "" {
			continue
		}

		current, ok := byRepo[row.Repository]
		if !ok {
			current = &aggregate{
				TopRepositoryView: contracts.TopRepositoryView{
					FullName: row.Repository,
					Owner:    row.Owner,
					Name:     row.Name,
				},
				merged: make(map[int]struct{}),
				skills: make(map[string]int),
			}
			byRepo[row.Repository] = current
		}

		current.TotalXP += row.DeltaXP
		current.ContributionCount++
		if row.PRMerged && row.PRNumber > 0 {
			current.merged[row.PRNumber] = struct{}{}
		}
		if row.CreatedAt.After(current.LastContributionAt) {
			current.LastContributionAt = row.CreatedAt.UTC()
		}
		for key, value := range row.Skills {
			current.skills[key] += value
		}
	}

	out := make([]contracts.TopRepositoryView, 0, len(byRepo))
	for _, aggregate := range byRepo {
		aggregate.MergedPullRequests = len(aggregate.merged)
		aggregate.PrimarySkill = dominantSkill(aggregate.skills)
		aggregate.Visibility = "public"
		out = append(out, aggregate.TopRepositoryView)
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].TotalXP == out[j].TotalXP {
			return out[i].FullName < out[j].FullName
		}
		return out[i].TotalXP > out[j].TotalXP
	})
	return out
}

func dominantSkill(skillTotals map[string]int) string {
	bestKey := ""
	bestValue := -1
	for key, value := range skillTotals {
		if value > bestValue || (value == bestValue && key < bestKey) {
			bestKey = key
			bestValue = value
		}
	}
	return bestKey
}

func buildBadgeViews(badges []badgeRecord) []contracts.BadgeView {
	out := make([]contracts.BadgeView, 0, len(badges))
	for _, badge := range badges {
		out = append(out, contracts.BadgeView{
			Key:         badge.Key,
			Name:        humanizeBadgeKey(badge.Key),
			Description: badgeDescription(badge.Key),
			AwardedAt:   badge.AwardedAt.UTC(),
			Evidence:    badge.Evidence,
		})
	}
	return out
}

func buildScoreHistory(scoreRows []scoreRow) []contracts.ScoreHistoryEntry {
	limit := 25
	if len(scoreRows) < limit {
		limit = len(scoreRows)
	}

	out := make([]contracts.ScoreHistoryEntry, 0, limit)
	for i := 0; i < limit; i++ {
		row := scoreRows[i]
		evidenceState, evidenceMissing := scoreHistoryEvidenceState(row)
		entry := contracts.ScoreHistoryEntry{
			EventID:         row.EventID,
			EventType:       row.EventType,
			DeltaXP:         row.DeltaXP,
			CreatedAt:       row.CreatedAt.UTC(),
			ScoreVersion:    row.ScoreVersion,
			FormulaVersion:  row.FormulaVersion,
			PullRequestID:   row.PullRequestID,
			AnalysisID:      row.AnalysisID,
			EvidenceState:   evidenceState,
			EvidenceMissing: evidenceMissing,
			Explanation:     row.Explanation,
		}
		if row.Repository != "" && row.PRNumber > 0 {
			entry.PullRequest = &contracts.PullRequestReference{
				Repository: row.Repository,
				Number:     row.PRNumber,
				Title:      row.PRTitle,
			}
		}
		out = append(out, entry)
	}
	return out
}

func scoreHistoryEvidenceState(row scoreRow) (string, []string) {
	missing := make([]string, 0, 4)
	if strings.TrimSpace(row.ScoreVersion) == "" {
		missing = append(missing, "score_version")
	}
	if strings.TrimSpace(row.FormulaVersion) == "" {
		missing = append(missing, "formula_version")
	}
	if strings.TrimSpace(row.PullRequestID) == "" || strings.TrimSpace(row.Repository) == "" || row.PRNumber <= 0 {
		missing = append(missing, "pull_request_evidence")
	}
	if strings.TrimSpace(row.AnalysisID) == "" {
		missing = append(missing, "analysis_artifact")
	}
	if len(missing) > 0 {
		return "partial", missing
	}
	return "complete", nil
}

func buildTimeline(scoreRows []scoreRow, sourceWatermark time.Time) contracts.ProfileTimeline {
	points := make([]contracts.ProfileTimelinePoint, 0, 6)
	endWeek := startOfWeek(sourceWatermark.UTC())
	startWeek := endWeek.AddDate(0, 0, -35)
	weekDelta := make(map[time.Time]int)
	cumulativeBeforeStart := 0

	ascending := make([]scoreRow, len(scoreRows))
	copy(ascending, scoreRows)
	sort.Slice(ascending, func(i, j int) bool {
		return ascending[i].CreatedAt.Before(ascending[j].CreatedAt)
	})

	for _, row := range ascending {
		bucket := startOfWeek(row.CreatedAt.UTC())
		if bucket.Before(startWeek) {
			cumulativeBeforeStart += row.DeltaXP
			continue
		}
		if bucket.After(endWeek) {
			continue
		}
		weekDelta[bucket] += row.DeltaXP
	}

	running := cumulativeBeforeStart
	for bucket := startWeek; !bucket.After(endWeek); bucket = bucket.AddDate(0, 0, 7) {
		running += weekDelta[bucket]
		points = append(points, contracts.ProfileTimelinePoint{
			BucketStart: bucket,
			BucketEnd:   bucket.AddDate(0, 0, 7),
			DeltaXP:     weekDelta[bucket],
			TotalXP:     running,
		})
	}

	return contracts.ProfileTimeline{
		Window: contracts.ProfileTimeWindow{
			Label:   "last_6_weeks",
			Bucket:  "week",
			StartAt: startWeek,
			EndAt:   endWeek.AddDate(0, 0, 7),
		},
		Points:    points,
		UpdatedAt: sourceWatermark.UTC(),
	}
}

func leaderboardEntryFromSnapshot(snapshot snapshotRecord, rank int, now time.Time) contracts.LeaderboardEntryView {
	handle := strings.TrimSpace(snapshot.Summary.Handle)
	if handle == "" {
		handle = strings.TrimSpace(snapshot.ShareCard.Handle)
	}
	displayName := strings.TrimSpace(snapshot.Summary.DisplayName)
	if displayName == "" {
		displayName = strings.TrimSpace(snapshot.ShareCard.DisplayName)
	}
	if displayName == "" {
		displayName = handle
	}

	level := snapshot.ShareCard.Level
	if level.Label == "" {
		level = levelViewForXP(snapshot.TotalXP)
	}

	focus := ""
	if len(snapshot.Summary.TopSkills) > 0 {
		focus = snapshot.Summary.TopSkills[0]
	} else if len(snapshot.TopSkills) > 0 {
		focus = snapshot.TopSkills[0].Key
	}

	weeklyXP := 0
	if points := snapshot.Timeline.Points; len(points) > 0 {
		weeklyXP = points[len(points)-1].DeltaXP
	}
	scoreVersion := scoreVersionFromSnapshot(snapshot)
	rankEvidence := leaderboardRankEvidenceFromSnapshot(snapshot)
	rankEvidenceState, rankEvidenceMissing := leaderboardRankEvidenceState(snapshot, scoreVersion)

	return contracts.LeaderboardEntryView{
		Rank:                   rank,
		Handle:                 handle,
		DisplayName:            displayName,
		AvatarURL:              strings.TrimSpace(snapshot.Summary.AvatarURL),
		LevelLabel:             level.Label,
		RankTier:               level.RankTier,
		TotalXP:                snapshot.TotalXP,
		WeeklyXP:               weeklyXP,
		Movement:               0,
		Focus:                  focus,
		ProfileSnapshotID:      snapshot.ID,
		ProfileSnapshotVersion: snapshot.SnapshotVersion,
		ScoreVersion:           scoreVersion,
		RankScoreEventID:       rankEvidence.ScoreEventID,
		RankFormulaVersion:     rankEvidence.FormulaVersion,
		RankPullRequestID:      rankEvidence.PullRequestID,
		RankAnalysisID:         rankEvidence.AnalysisID,
		SourceWatermark:        snapshot.SourceWatermark.UTC(),
		RankEvidenceState:      rankEvidenceState,
		RankEvidenceMissing:    rankEvidenceMissing,
		RefreshedAt:            snapshot.RefreshedAt.UTC(),
		IsStale:                now.UTC().After(snapshot.StaleAfter.UTC()),
	}
}

type leaderboardRankEvidence struct {
	ScoreEventID   string
	FormulaVersion string
	PullRequestID  string
	AnalysisID     string
}

func leaderboardRankEvidenceFromSnapshot(snapshot snapshotRecord) leaderboardRankEvidence {
	best := leaderboardRankEvidence{}
	bestCompleteness := -1
	for _, entry := range snapshot.ScoreHistory {
		evidence := leaderboardRankEvidence{
			ScoreEventID:   strings.TrimSpace(entry.EventID),
			FormulaVersion: strings.TrimSpace(entry.FormulaVersion),
			PullRequestID:  strings.TrimSpace(entry.PullRequestID),
			AnalysisID:     strings.TrimSpace(entry.AnalysisID),
		}
		if evidence.ScoreEventID == "" {
			continue
		}
		completeness := 1
		if evidence.FormulaVersion != "" {
			completeness++
		}
		if evidence.PullRequestID != "" {
			completeness++
		}
		if evidence.AnalysisID != "" {
			completeness++
		}
		if completeness == 4 {
			return evidence
		}
		if completeness > bestCompleteness {
			best = evidence
			bestCompleteness = completeness
		}
	}
	return best
}

func scoreVersionFromSnapshot(snapshot snapshotRecord) string {
	for _, entry := range snapshot.ScoreHistory {
		if version := strings.TrimSpace(entry.ScoreVersion); version != "" {
			return version
		}
	}
	return ""
}

func leaderboardRankEvidenceState(snapshot snapshotRecord, scoreVersion string) (string, []string) {
	missing := []string{"season_snapshot", "rank_movement_event"}
	if strings.TrimSpace(snapshot.ID) == "" {
		missing = append(missing, "profile_snapshot")
	}
	if strings.TrimSpace(scoreVersion) == "" {
		missing = append(missing, "score_version")
	}
	if snapshot.SourceWatermark.IsZero() {
		missing = append(missing, "source_watermark")
	}
	if len(missing) > 0 {
		return "partial", missing
	}
	return "complete", nil
}

func startOfWeek(value time.Time) time.Time {
	value = value.UTC()
	offset := (int(value.Weekday()) + 6) % 7
	start := value.AddDate(0, 0, -offset)
	return time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
}

func levelViewForXP(totalXP int) contracts.ProfileLevelView {
	if totalXP < 0 {
		totalXP = 0
	}
	currentLevel := totalXP/levelStepXP + 1
	return contracts.ProfileLevelView{
		Label:        levelLabelForLevel(currentLevel),
		CurrentLevel: currentLevel,
		CurrentXP:    totalXP,
		NextLevelXP:  currentLevel * levelStepXP,
		RankTier:     rankTierForXP(totalXP),
	}
}

func levelLabelForLevel(level int) string {
	switch {
	case level >= 41:
		return "Architect"
	case level >= 31:
		return "Maintainer"
	case level >= 21:
		return "Specialist"
	case level >= 11:
		return "Builder"
	case level >= 6:
		return "Contributor"
	default:
		return "Explorer"
	}
}

func rankTierForXP(totalXP int) string {
	switch {
	case totalXP >= 15000:
		return "Diamond"
	case totalXP >= 9000:
		return "Platinum I"
	case totalXP >= 4000:
		return "Gold III"
	case totalXP >= 1500:
		return "Silver II"
	default:
		return "Bronze I"
	}
}

func buildStrengthSummary(skills []contracts.SkillAreaView) string {
	if len(skills) == 0 {
		return "Not enough scored public contribution evidence is available yet."
	}
	if len(skills) == 1 {
		return fmt.Sprintf("Appears strongest in %s contributions based on public pull request evidence.", strings.ToLower(skills[0].Key))
	}
	return fmt.Sprintf(
		"Appears strongest in %s and %s contributions based on public pull request evidence.",
		strings.ToLower(skills[0].Key),
		strings.ToLower(skills[1].Key),
	)
}

func topSkillKeys(skills []contracts.SkillAreaView, limit int) []string {
	if limit > len(skills) {
		limit = len(skills)
	}
	out := make([]string, 0, limit)
	for i := 0; i < limit; i++ {
		out = append(out, skills[i].Key)
	}
	return out
}

func topBadgeKeys(badges []contracts.BadgeView, limit int) []string {
	if limit > len(badges) {
		limit = len(badges)
	}
	out := make([]string, 0, limit)
	for i := 0; i < limit; i++ {
		out = append(out, badges[i].Key)
	}
	return out
}

func humanizeBadgeKey(key string) string {
	key = strings.TrimSpace(strings.ReplaceAll(key, "-", " "))
	key = strings.ReplaceAll(key, "_", " ")
	parts := strings.Fields(strings.ToLower(key))
	for i := range parts {
		if parts[i] != "" {
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, " ")
}

func badgeDescription(key string) string {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case "docs_architect", "docs-architect":
		return "Earned through repeated high-context documentation work."
	case "test_builder", "test-builder":
		return "Signals repeated regression-oriented testing contributions."
	case "backend_signal_1", "backend-signal-1":
		return "Evidence-backed backend contribution milestone."
	default:
		return "Evidence-backed achievement derived from scored contribution history."
	}
}
