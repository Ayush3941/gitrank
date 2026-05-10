package service

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
)

type questTemplate struct {
	idPrefix       string
	title          string
	description    string
	cadence        string
	rewardXP       int
	rewardBadgeKey string
	goal           int
	skill          string
	keywords       []string
}

var liveQuestTemplates = []questTemplate{
	{
		idPrefix:    "quest-maintainer-review",
		title:       "Land maintainer-reviewed work",
		description: "Earn review-backed evidence on a contribution that needed maintainer judgement.",
		cadence:     "Weekly",
		rewardXP:    320,
		goal:        3,
		skill:       "review",
		keywords:    []string{"review", "maintainer", "requested changes", "approved"},
	},
	{
		idPrefix:       "quest-regression-tests",
		title:          "Add regression tests to scored work",
		description:    "Turn one fix or feature into durable evidence by adding test coverage.",
		cadence:        "Weekly",
		rewardXP:       240,
		rewardBadgeKey: "test-builder",
		goal:           2,
		skill:          "testing",
		keywords:       []string{"test", "testing", "regression", "coverage", "ci"},
	},
	{
		idPrefix:    "quest-consistency",
		title:       "Keep a steady contribution window",
		description: "Accumulate scored work across active weekly buckets instead of burst-only activity.",
		cadence:     "Long-term",
		rewardXP:    420,
		goal:        4,
		keywords:    nil,
	},
	{
		idPrefix:    "quest-performance-benchmark",
		title:       "Ship benchmark-backed performance work",
		description: "Add measurable performance evidence before claiming optimization strength.",
		cadence:     "Skill-based",
		rewardXP:    540,
		goal:        1,
		skill:       "performance",
		keywords:    []string{"performance", "benchmark", "latency", "throughput", "optimize"},
	},
}

func (s *Service) PrivateQuests(ctx context.Context, sessionToken string, now time.Time) (contracts.UserQuestsResponse, error) {
	principal, err := s.authenticate(ctx, sessionToken, now.UTC())
	if err != nil {
		return contracts.UserQuestsResponse{}, err
	}

	user, err := s.store.LoadUserByID(ctx, principal.UserID)
	if err != nil {
		return contracts.UserQuestsResponse{}, err
	}
	snapshot, err := s.ensureSnapshot(ctx, user, now.UTC())
	if err != nil {
		return contracts.UserQuestsResponse{}, err
	}

	cacheKey := fmt.Sprintf("profile:quests:v1:%s:%s", user.ID, snapshot.ID)
	var cached contracts.UserQuestsResponse
	if hit, err := s.cache.GetJSON(ctx, cacheKey, &cached); err == nil && hit {
		return cached, nil
	} else if err != nil {
		s.log.Warn("quest cache read failed", "error", err, "cache_key", cacheKey)
	}

	response := contracts.UserQuestsResponse{
		Quests:      buildQuestsFromSnapshot(snapshot, now.UTC()),
		GeneratedAt: now.UTC(),
		Staleness:   snapshotStaleness(snapshot, now.UTC()),
	}
	if err := s.cache.SetJSON(ctx, cacheKey, response, s.privateCacheTTL); err != nil {
		s.log.Warn("quest cache write failed", "error", err, "cache_key", cacheKey)
	}
	return response, nil
}

func buildQuestsFromSnapshot(snapshot snapshotRecord, now time.Time) []contracts.QuestView {
	if len(snapshot.ScoreHistory) == 0 && len(snapshot.TopSkills) == 0 {
		return []contracts.QuestView{syncUnlockQuest(snapshot, now)}
	}

	quests := []contracts.QuestView{weakLaneQuest(snapshot, now)}
	for _, template := range liveQuestTemplates {
		quests = append(quests, questFromTemplate(snapshot, template, now))
	}
	sortQuests(quests)
	return quests
}

func syncUnlockQuest(snapshot snapshotRecord, now time.Time) contracts.QuestView {
	return contracts.QuestView{
		ID:             "quest-sync-first-evidence",
		Title:          "Sync GitHub evidence",
		Description:    "Run a GitHub sync so GitRank can generate quests from scored contribution evidence.",
		Status:         "Active",
		Cadence:        "Skill-based",
		RewardXP:       0,
		Progress:       0,
		Goal:           1,
		WhyRecommended: "No score history is available yet, so the quest board cannot recommend skill work responsibly.",
		EvidenceSignals: []string{
			"No profile score events are present in the latest snapshot.",
			fmt.Sprintf("Profile refreshed at %s.", snapshot.RefreshedAt.UTC().Format(time.RFC3339)),
		},
		ExpiresAt: nextWeeklyExpiry(now),
	}
}

func weakLaneQuest(snapshot snapshotRecord, now time.Time) contracts.QuestView {
	skillXP := questSkillTotals(snapshot.TopSkills)
	weakSkill := weakestQuestSkill(skillXP)
	progress, refs := matchingEvidence(snapshot.ScoreHistory, questSkillKeywords(weakSkill), 4)
	if progress > 1 {
		progress = 1
	}

	strongest := "No dominant skill lane"
	if len(snapshot.TopSkills) > 0 {
		strongest = fmt.Sprintf("%s is currently the strongest lane", humanizeSkill(snapshot.TopSkills[0].Key))
	}

	return contracts.QuestView{
		ID:                    fmt.Sprintf("quest-weak-lane-%s", weakSkill),
		Title:                 fmt.Sprintf("Add one %s contribution", strings.ToLower(humanizeSkill(weakSkill))),
		Description:           "Target the lowest-evidence skill lane with a contribution that can be scored from public PR evidence.",
		Status:                questStatus(progress, 1, false),
		Cadence:               "Skill-based",
		RewardXP:              360,
		Progress:              progress,
		Goal:                  1,
		WeakAreaTarget:        weakSkill,
		WhyRecommended:        fmt.Sprintf("%s has the least XP in the latest profile snapshot, so GitRank treats it as the safest next growth target.", humanizeSkill(weakSkill)),
		EvidenceSignals:       []string{fmt.Sprintf("%s lane has %d XP.", humanizeSkill(weakSkill), skillXP[weakSkill]), strongest},
		LinkedContributionIDs: linkedContributionIDs(refs),
		EvidenceReferences:    refs,
		ExpiresAt:             nextWeeklyExpiry(now),
	}
}

func questFromTemplate(snapshot snapshotRecord, template questTemplate, now time.Time) contracts.QuestView {
	progress, refs := matchingEvidence(snapshot.ScoreHistory, template.keywords, 5)
	if template.idPrefix == "quest-consistency" {
		progress, refs = consistencyEvidence(snapshot)
	}
	if progress > template.goal {
		progress = template.goal
	}

	locked := false
	if template.idPrefix == "quest-performance-benchmark" {
		locked = progress == 0 && questSkillTotals(snapshot.TopSkills)["performance"] == 0
	}

	quest := contracts.QuestView{
		ID:                    template.idPrefix,
		Title:                 template.title,
		Description:           template.description,
		Status:                questStatus(progress, template.goal, locked),
		Cadence:               template.cadence,
		RewardXP:              template.rewardXP,
		RewardBadgeKey:        template.rewardBadgeKey,
		Progress:              progress,
		Goal:                  template.goal,
		WeakAreaTarget:        template.skill,
		WhyRecommended:        whyQuestRecommended(snapshot, template, progress),
		EvidenceSignals:       questEvidenceSignals(snapshot, template, progress, now),
		LinkedContributionIDs: linkedContributionIDs(refs),
		EvidenceReferences:    refs,
		ExpiresAt:             nextWeeklyExpiry(now),
	}
	if template.idPrefix == "quest-consistency" {
		quest.WeakAreaTarget = ""
	}
	return quest
}

func questSkillTotals(skills []contracts.SkillAreaView) map[string]int {
	out := map[string]int{
		"architecture":  0,
		"backend":       0,
		"devops":        0,
		"documentation": 0,
		"frontend":      0,
		"performance":   0,
		"review":        0,
		"security":      0,
		"testing":       0,
	}
	for _, skill := range skills {
		key := normalizeQuestSkill(skill.Key)
		if _, ok := out[key]; ok {
			out[key] += skill.TotalXP
		}
	}
	return out
}

func weakestQuestSkill(skillXP map[string]int) string {
	priority := []string{"security", "testing", "review", "performance", "devops", "architecture", "documentation", "frontend", "backend"}
	best := priority[0]
	for _, skill := range priority[1:] {
		if skillXP[skill] < skillXP[best] {
			best = skill
		}
	}
	return best
}

func questSkillKeywords(skill string) []string {
	switch normalizeQuestSkill(skill) {
	case "architecture":
		return []string{"architecture", "design", "cross-service", "schema", "migration"}
	case "backend":
		return []string{"backend", "service", "api", "database", "queue"}
	case "documentation":
		return []string{"doc", "docs", "documentation", "guide", "runbook"}
	case "devops":
		return []string{"devops", "infra", "infrastructure", "ci", "deploy", "kubernetes"}
	case "frontend":
		return []string{"frontend", "ui", "react", "next", "component"}
	case "performance":
		return []string{"performance", "benchmark", "latency", "throughput", "optimize"}
	case "review":
		return []string{"review", "maintainer", "requested changes", "approved"}
	case "security":
		return []string{"security", "auth", "csrf", "token", "secret", "permission"}
	case "testing":
		return []string{"test", "testing", "regression", "coverage", "ci"}
	default:
		return []string{skill}
	}
}

func normalizeQuestSkill(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	switch normalized {
	case "docs":
		return "documentation"
	case "devops", "infrastructure", "infra":
		return "devops"
	case "bugfix", "bug_fix":
		return "backend"
	case "tests":
		return "testing"
	default:
		return normalized
	}
}

func matchingEvidence(history []contracts.ScoreHistoryEntry, keywords []string, limit int) (int, []contracts.QuestEvidenceReference) {
	if len(keywords) == 0 {
		return 0, nil
	}
	refs := make([]contracts.QuestEvidenceReference, 0, limit)
	matches := 0
	for _, entry := range history {
		if !scoreEntryMatches(entry, keywords) {
			continue
		}
		matches++
		if len(refs) < limit {
			refs = append(refs, questEvidenceReference(entry))
		}
	}
	return matches, refs
}

func scoreEntryMatches(entry contracts.ScoreHistoryEntry, keywords []string) bool {
	text := strings.ToLower(entry.EventType + " " + strings.Join(entry.Explanation, " "))
	if entry.PullRequest != nil {
		text += " " + strings.ToLower(entry.PullRequest.Title+" "+entry.PullRequest.Repository)
	}
	for _, keyword := range keywords {
		if strings.Contains(text, strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}

func questEvidenceReference(entry contracts.ScoreHistoryEntry) contracts.QuestEvidenceReference {
	ref := contracts.QuestEvidenceReference{
		EventID:    entry.EventID,
		Kind:       "score_event",
		OccurredAt: entry.CreatedAt.UTC(),
	}
	if entry.PullRequest != nil {
		ref.Repository = entry.PullRequest.Repository
		ref.Number = entry.PullRequest.Number
		ref.Title = entry.PullRequest.Title
	}
	return ref
}

func consistencyEvidence(snapshot snapshotRecord) (int, []contracts.QuestEvidenceReference) {
	activeBuckets := 0
	for _, point := range snapshot.Timeline.Points {
		if point.DeltaXP > 0 {
			activeBuckets++
		}
	}
	refs := make([]contracts.QuestEvidenceReference, 0, 4)
	for _, entry := range snapshot.ScoreHistory {
		if len(refs) >= 4 {
			break
		}
		refs = append(refs, questEvidenceReference(entry))
	}
	return activeBuckets, refs
}

func linkedContributionIDs(refs []contracts.QuestEvidenceReference) []string {
	ids := make([]string, 0, len(refs))
	seen := map[string]struct{}{}
	for _, ref := range refs {
		id := strings.TrimSpace(ref.EventID)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		ids = append(ids, id)
		seen[id] = struct{}{}
	}
	return ids
}

func questStatus(progress, goal int, locked bool) string {
	if goal > 0 && progress >= goal {
		return "Completed"
	}
	if locked {
		return "Locked"
	}
	return "Active"
}

func whyQuestRecommended(snapshot snapshotRecord, template questTemplate, progress int) string {
	switch template.idPrefix {
	case "quest-maintainer-review":
		return fmt.Sprintf("Review evidence appears in %d scored contributions; the current tier needs repeated maintainer-trust signals.", progress)
	case "quest-regression-tests":
		return fmt.Sprintf("Testing evidence appears in %d scored contributions; more regression proof makes future scores easier to explain.", progress)
	case "quest-consistency":
		return fmt.Sprintf("%d weekly buckets contain scored XP in the current trend window.", progress)
	case "quest-performance-benchmark":
		xp := questSkillTotals(snapshot.TopSkills)["performance"]
		if xp == 0 {
			return "No benchmark-backed performance signal is visible yet, so this remains locked until adjacent evidence exists."
		}
		return fmt.Sprintf("Performance has %d XP; one benchmark-backed contribution can turn that signal into a stronger lane.", xp)
	default:
		return "Recommended from the latest score history and profile snapshot."
	}
}

func questEvidenceSignals(snapshot snapshotRecord, template questTemplate, progress int, now time.Time) []string {
	signals := []string{fmt.Sprintf("%d / %d current progress.", progress, template.goal)}
	if template.skill != "" {
		xp := questSkillTotals(snapshot.TopSkills)[template.skill]
		signals = append(signals, fmt.Sprintf("%s lane has %d XP.", humanizeSkill(template.skill), xp))
	}
	if snapshot.StaleAfter.Before(now.UTC()) {
		signals = append(signals, "Profile snapshot is stale; re-sync can change this recommendation.")
	}
	return signals
}

func humanizeSkill(value string) string {
	value = normalizeQuestSkill(value)
	switch value {
	case "documentation":
		return "Documentation"
	default:
		parts := strings.Split(value, "_")
		for i, part := range parts {
			if part == "" {
				continue
			}
			parts[i] = strings.ToUpper(part[:1]) + part[1:]
		}
		return strings.Join(parts, " ")
	}
}

func nextWeeklyExpiry(now time.Time) *time.Time {
	expiry := startOfWeek(now.UTC()).AddDate(0, 0, 7)
	return &expiry
}

func sortQuests(quests []contracts.QuestView) {
	order := map[string]int{"Active": 0, "Completed": 1, "Locked": 2}
	sort.SliceStable(quests, func(i, j int) bool {
		if order[quests[i].Status] == order[quests[j].Status] {
			return quests[i].ID < quests[j].ID
		}
		return order[quests[i].Status] < order[quests[j].Status]
	})
}
