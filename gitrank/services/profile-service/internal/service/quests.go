package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/jackc/pgx/v5"
)

const questRewardVersion = "quest-rewards/v1"

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

	quests, err := s.store.MaterializeQuestBoard(ctx, user.ID, snapshot, buildQuestsFromSnapshot(snapshot, now.UTC()), now.UTC())
	if err != nil {
		return contracts.UserQuestsResponse{}, err
	}

	response := contracts.UserQuestsResponse{
		Quests:      quests,
		GeneratedAt: now.UTC(),
		Staleness:   snapshotStaleness(snapshot, now.UTC()),
	}
	if err := s.cache.SetJSON(ctx, cacheKey, response, s.privateCacheTTL); err != nil {
		s.log.Warn("quest cache write failed", "error", err, "cache_key", cacheKey)
	}
	return response, nil
}

func (s *Store) MaterializeQuestBoard(ctx context.Context, userID string, snapshot snapshotRecord, quests []contracts.QuestView, now time.Time) ([]contracts.QuestView, error) {
	userID, err := contracts.NormalizeUUID(userID, "user_id")
	if err != nil {
		return nil, ErrInvalidRequest
	}
	now = now.UTC()
	if now.IsZero() {
		now = time.Now().UTC()
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	materialized := make([]contracts.QuestView, 0, len(quests))
	for _, quest := range quests {
		quest.ID = strings.TrimSpace(quest.ID)
		if quest.ID == "" {
			continue
		}
		definitionID, err := upsertQuestDefinition(ctx, tx, quest, now)
		if err != nil {
			return nil, err
		}
		assignmentID, status, progress, err := upsertQuestAssignment(ctx, tx, userID, definitionID, snapshot, quest, now)
		if err != nil {
			return nil, err
		}
		quest.Status = questStatusFromStore(status)
		quest.Progress = progress
		if quest.Goal <= 0 {
			quest.Goal = 1
		}
		if err := insertQuestAuditEvent(ctx, tx, "quest.assignment_materialized", userID, definitionID, assignmentID, questAssignmentAuditKey(assignmentID, "assignment"), map[string]any{
			"quest_id":            quest.ID,
			"profile_snapshot_id": snapshot.ID,
			"status":              status,
			"progress":            progress,
			"goal":                quest.Goal,
		}, now); err != nil {
			return nil, err
		}

		for index, ref := range quest.EvidenceReferences {
			if err := upsertQuestProgressEvent(ctx, tx, userID, definitionID, assignmentID, ref, index+1, quest.Progress, now); err != nil {
				return nil, err
			}
		}

		if strings.EqualFold(quest.Status, "Completed") {
			completionID, err := upsertQuestCompletion(ctx, tx, userID, definitionID, assignmentID, quest, now)
			if err != nil {
				return nil, err
			}
			if err := insertQuestAuditEvent(ctx, tx, "quest.completed", userID, definitionID, assignmentID, questAssignmentAuditKey(assignmentID, "completed"), map[string]any{
				"quest_id":            quest.ID,
				"completion_event_id": completionID,
				"reward_xp":           quest.RewardXP,
				"reward_badge_key":    quest.RewardBadgeKey,
			}, now); err != nil {
				return nil, err
			}
			if quest.RewardXP > 0 {
				if err := upsertQuestXPReward(ctx, tx, userID, definitionID, assignmentID, completionID, snapshot, quest, now); err != nil {
					return nil, err
				}
			}
			if strings.TrimSpace(quest.RewardBadgeKey) != "" {
				if err := upsertQuestBadgeReward(ctx, tx, userID, definitionID, assignmentID, completionID, quest, now); err != nil {
					return nil, err
				}
			}
		}
		materialized = append(materialized, quest)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	sortQuests(materialized)
	return materialized, nil
}

func upsertQuestDefinition(ctx context.Context, tx pgx.Tx, quest contracts.QuestView, now time.Time) (string, error) {
	rules, err := json.Marshal(map[string]any{
		"weak_area_target": quest.WeakAreaTarget,
		"evidence_signals": quest.EvidenceSignals,
		"reward_badge_key": quest.RewardBadgeKey,
	})
	if err != nil {
		return "", err
	}

	var definitionID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO quest_definitions (
			quest_key,
			title,
			description,
			status,
			cadence,
			goal,
			reward_xp,
			reward_badge_key,
			weak_area_target,
			rules_jsonb,
			updated_at
		)
		VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9::jsonb, $10)
		ON CONFLICT (quest_key) DO UPDATE
		SET
			title = EXCLUDED.title,
			description = EXCLUDED.description,
			status = EXCLUDED.status,
			cadence = EXCLUDED.cadence,
			goal = EXCLUDED.goal,
			reward_xp = EXCLUDED.reward_xp,
			reward_badge_key = EXCLUDED.reward_badge_key,
			weak_area_target = EXCLUDED.weak_area_target,
			rules_jsonb = EXCLUDED.rules_jsonb,
			updated_at = EXCLUDED.updated_at
		RETURNING id::text
	`, quest.ID,
		quest.Title,
		quest.Description,
		questCadenceForStore(quest.Cadence),
		maxInt(quest.Goal, 1),
		maxInt(quest.RewardXP, 0),
		strings.TrimSpace(quest.RewardBadgeKey),
		strings.TrimSpace(quest.WeakAreaTarget),
		string(rules),
		now,
	).Scan(&definitionID); err != nil {
		return "", err
	}
	return definitionID, nil
}

func upsertQuestAssignment(ctx context.Context, tx pgx.Tx, userID, definitionID string, snapshot snapshotRecord, quest contracts.QuestView, now time.Time) (string, string, int, error) {
	source, err := json.Marshal(map[string]any{
		"quest_id":                 quest.ID,
		"profile_snapshot_id":      snapshot.ID,
		"profile_snapshot_version": snapshot.SnapshotVersion,
		"why_recommended":          quest.WhyRecommended,
		"evidence_signals":         quest.EvidenceSignals,
		"linked_contribution_ids":  quest.LinkedContributionIDs,
		"evidence_references":      quest.EvidenceReferences,
	})
	if err != nil {
		return "", "", 0, err
	}

	status := questStatusForStore(quest.Status)
	progress := quest.Progress
	if progress < 0 {
		progress = 0
	}
	goal := maxInt(quest.Goal, 1)
	if progress > goal {
		progress = goal
	}

	var activatedAt any
	if status != "locked" {
		activatedAt = now
	}
	var completedAt any
	if status == "completed" {
		completedAt = now
	}

	var assignmentID string
	var storedStatus string
	var storedProgress int
	if err := tx.QueryRow(ctx, `
		INSERT INTO user_quest_assignments (
			assignment_key,
			user_id,
			quest_definition_id,
			source_snapshot_id,
			status,
			progress,
			goal,
			assigned_at,
			activated_at,
			completed_at,
			expires_at,
			source_jsonb,
			updated_at
		)
		VALUES ($1, $2::uuid, $3::uuid, NULLIF($4, '')::uuid, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $8)
		ON CONFLICT (assignment_key) DO UPDATE
		SET
			source_snapshot_id = EXCLUDED.source_snapshot_id,
			status = CASE
				WHEN user_quest_assignments.status = 'completed' THEN 'completed'
				ELSE EXCLUDED.status
			END,
			progress = GREATEST(user_quest_assignments.progress, EXCLUDED.progress),
			goal = EXCLUDED.goal,
			activated_at = COALESCE(user_quest_assignments.activated_at, EXCLUDED.activated_at),
			completed_at = CASE
				WHEN user_quest_assignments.completed_at IS NOT NULL THEN user_quest_assignments.completed_at
				WHEN EXCLUDED.status = 'completed' THEN EXCLUDED.completed_at
				ELSE NULL
			END,
			expires_at = EXCLUDED.expires_at,
			source_jsonb = EXCLUDED.source_jsonb,
			updated_at = EXCLUDED.updated_at
		RETURNING id::text, status, progress
	`, questAssignmentKey(userID, snapshot.ID, quest),
		userID,
		definitionID,
		strings.TrimSpace(snapshot.ID),
		status,
		progress,
		goal,
		now,
		activatedAt,
		completedAt,
		questExpiresAtValue(quest),
		string(source),
	).Scan(&assignmentID, &storedStatus, &storedProgress); err != nil {
		return "", "", 0, err
	}
	return assignmentID, storedStatus, storedProgress, nil
}

func upsertQuestProgressEvent(ctx context.Context, tx pgx.Tx, userID, definitionID, assignmentID string, ref contracts.QuestEvidenceReference, delta, progressAfter int, now time.Time) error {
	scoreEventID := normalizedQuestUUID(ref.EventID)
	evidenceType := "system"
	if scoreEventID != "" {
		evidenceType = "score_event"
	}
	evidence, err := json.Marshal(ref)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO user_quest_progress_events (
			event_key,
			assignment_id,
			user_id,
			quest_definition_id,
			pull_request_id,
			score_event_id,
			evidence_type,
			delta_progress,
			progress_after,
			evidence_jsonb,
			occurred_at
		)
		VALUES (
			$1,
			$2::uuid,
			$3::uuid,
			$4::uuid,
			(SELECT pull_request_id FROM score_events WHERE id = NULLIF($5, '')::uuid),
			NULLIF($5, '')::uuid,
			$6,
			$7,
			$8,
			$9::jsonb,
			$10
		)
		ON CONFLICT (event_key) DO UPDATE
		SET
			progress_after = GREATEST(user_quest_progress_events.progress_after, EXCLUDED.progress_after),
			evidence_jsonb = EXCLUDED.evidence_jsonb
	`, questProgressEventKey(assignmentID, ref.EventID),
		assignmentID,
		userID,
		definitionID,
		scoreEventID,
		evidenceType,
		maxInt(delta, 1),
		maxInt(progressAfter, 0),
		string(evidence),
		firstNonZeroTime(ref.OccurredAt, now),
	)
	return err
}

func upsertQuestCompletion(ctx context.Context, tx pgx.Tx, userID, definitionID, assignmentID string, quest contracts.QuestView, now time.Time) (string, error) {
	evidence, err := json.Marshal(map[string]any{
		"quest_id":                quest.ID,
		"linked_contribution_ids": quest.LinkedContributionIDs,
		"evidence_references":     quest.EvidenceReferences,
	})
	if err != nil {
		return "", err
	}

	var completionID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO user_quest_completion_events (
			event_key,
			assignment_id,
			user_id,
			quest_definition_id,
			completed_at,
			reward_xp,
			reward_badge_key,
			evidence_jsonb
		)
		VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8::jsonb)
		ON CONFLICT (event_key) DO UPDATE
		SET
			reward_xp = EXCLUDED.reward_xp,
			reward_badge_key = EXCLUDED.reward_badge_key,
			evidence_jsonb = EXCLUDED.evidence_jsonb
		RETURNING id::text
	`, questCompletionKey(assignmentID),
		assignmentID,
		userID,
		definitionID,
		now,
		maxInt(quest.RewardXP, 0),
		strings.TrimSpace(quest.RewardBadgeKey),
		string(evidence),
	).Scan(&completionID); err != nil {
		return "", err
	}
	return completionID, nil
}

func upsertQuestXPReward(ctx context.Context, tx pgx.Tx, userID, definitionID, assignmentID, completionID string, snapshot snapshotRecord, quest contracts.QuestView, now time.Time) error {
	grantKey := questRewardGrantKey(assignmentID, "xp")
	scoreVersion := firstNonEmpty(scoreVersionFromSnapshot(snapshot), questRewardVersion)
	skill := questRewardSkill(quest)
	deltaSkill := map[string]int{}
	if skill != "" {
		deltaSkill[skill] = quest.RewardXP
	}
	deltaSkillRaw, err := json.Marshal(deltaSkill)
	if err != nil {
		return err
	}
	explanationRaw, err := json.Marshal([]string{fmt.Sprintf("Quest completed: %s", quest.Title)})
	if err != nil {
		return err
	}
	metadataRaw, err := json.Marshal(map[string]any{
		"issuer":                       "profile-service",
		"score_formula_inputs_version": questRewardVersion,
		"formula_version":              questRewardVersion,
		"quest_id":                     quest.ID,
		"assignment_id":                assignmentID,
		"completion_event_id":          completionID,
		"profile_snapshot_id":          snapshot.ID,
		"evidence_score_event_ids":     questEvidenceScoreEventIDs(quest.EvidenceReferences),
	})
	if err != nil {
		return err
	}

	var scoreEventID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO score_events (
			user_id,
			score_version,
			event_type,
			delta_total_xp,
			delta_skill_jsonb,
			explanation_jsonb,
			metadata_jsonb,
			event_key,
			created_at
		)
		VALUES ($1::uuid, $2, 'quest.reward', $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
		ON CONFLICT (user_id, event_key) WHERE replay_run_id IS NULL AND event_key <> '' DO UPDATE
		SET
			delta_total_xp = EXCLUDED.delta_total_xp,
			delta_skill_jsonb = EXCLUDED.delta_skill_jsonb,
			explanation_jsonb = EXCLUDED.explanation_jsonb,
			metadata_jsonb = EXCLUDED.metadata_jsonb
		RETURNING id::text
	`, userID,
		scoreVersion,
		quest.RewardXP,
		string(deltaSkillRaw),
		string(explanationRaw),
		string(metadataRaw),
		grantKey,
		now,
	).Scan(&scoreEventID); err != nil {
		return err
	}

	metadata, err := json.Marshal(map[string]any{
		"quest_id":                 quest.ID,
		"assignment_id":            assignmentID,
		"completion_event_id":      completionID,
		"score_event_id":           scoreEventID,
		"evidence_score_event_ids": questEvidenceScoreEventIDs(quest.EvidenceReferences),
	})
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO user_quest_reward_grants (
			grant_key,
			completion_event_id,
			assignment_id,
			user_id,
			quest_definition_id,
			reward_type,
			xp_amount,
			score_event_id,
			metadata_jsonb,
			granted_at
		)
		VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'xp', $6, $7::uuid, $8::jsonb, $9)
		ON CONFLICT (grant_key) DO UPDATE
		SET
			score_event_id = COALESCE(user_quest_reward_grants.score_event_id, EXCLUDED.score_event_id),
			status = 'applied',
			metadata_jsonb = EXCLUDED.metadata_jsonb
	`, grantKey,
		completionID,
		assignmentID,
		userID,
		definitionID,
		quest.RewardXP,
		scoreEventID,
		string(metadata),
		now,
	); err != nil {
		return err
	}
	return insertQuestAuditEvent(ctx, tx, "quest.reward_granted", userID, definitionID, assignmentID, questAssignmentAuditKey(assignmentID, "reward_xp"), map[string]any{
		"quest_id":       quest.ID,
		"reward_type":    "xp",
		"xp_amount":      quest.RewardXP,
		"score_event_id": scoreEventID,
	}, now)
}

func upsertQuestBadgeReward(ctx context.Context, tx pgx.Tx, userID, definitionID, assignmentID, completionID string, quest contracts.QuestView, now time.Time) error {
	badgeKey := strings.TrimSpace(quest.RewardBadgeKey)
	pullRequestIDs, err := questEvidencePullRequestIDs(ctx, tx, quest.EvidenceReferences)
	if err != nil {
		return err
	}
	evidence, err := json.Marshal(map[string]any{
		"issuer":                   "profile-service",
		"rule":                     "quest_reward",
		"rule_version":             questRewardVersion,
		"quest_id":                 quest.ID,
		"assignment_id":            assignmentID,
		"completion_event_id":      completionID,
		"evidence_score_event_ids": questEvidenceScoreEventIDs(quest.EvidenceReferences),
		"evidence_pr_ids":          pullRequestIDs,
	})
	if err != nil {
		return err
	}

	var userBadgeID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO user_badges (user_id, badge_key, awarded_at, evidence_jsonb)
		VALUES ($1::uuid, $2, $3, $4::jsonb)
		ON CONFLICT (user_id, badge_key) DO UPDATE
		SET evidence_jsonb = user_badges.evidence_jsonb || jsonb_build_object('quest_reward', EXCLUDED.evidence_jsonb)
		RETURNING id::text
	`, userID, badgeKey, now, string(evidence)).Scan(&userBadgeID); err != nil {
		return err
	}

	metadata, err := json.Marshal(map[string]any{
		"quest_id":            quest.ID,
		"assignment_id":       assignmentID,
		"completion_event_id": completionID,
		"user_badge_id":       userBadgeID,
	})
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO user_quest_reward_grants (
			grant_key,
			completion_event_id,
			assignment_id,
			user_id,
			quest_definition_id,
			reward_type,
			badge_key,
			user_badge_id,
			metadata_jsonb,
			granted_at
		)
		VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'badge', $6, $7::uuid, $8::jsonb, $9)
		ON CONFLICT (grant_key) DO UPDATE
		SET
			user_badge_id = COALESCE(user_quest_reward_grants.user_badge_id, EXCLUDED.user_badge_id),
			status = 'applied',
			metadata_jsonb = EXCLUDED.metadata_jsonb
	`, questRewardGrantKey(assignmentID, "badge:"+badgeKey),
		completionID,
		assignmentID,
		userID,
		definitionID,
		badgeKey,
		userBadgeID,
		string(metadata),
		now,
	); err != nil {
		return err
	}
	return insertQuestAuditEvent(ctx, tx, "quest.reward_granted", userID, definitionID, assignmentID, questAssignmentAuditKey(assignmentID, "reward_badge:"+badgeKey), map[string]any{
		"quest_id":        quest.ID,
		"reward_type":     "badge",
		"badge_key":       badgeKey,
		"user_badge_id":   userBadgeID,
		"evidence_pr_ids": pullRequestIDs,
	}, now)
}

func insertQuestAuditEvent(ctx context.Context, tx pgx.Tx, action, userID, definitionID, assignmentID, eventKey string, metadata map[string]any, now time.Time) error {
	raw, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO quest_audit_events (
			event_key,
			user_id,
			quest_definition_id,
			assignment_id,
			action,
			metadata_jsonb,
			created_at
		)
		VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, $6::jsonb, $7)
		ON CONFLICT (event_key) DO NOTHING
	`, eventKey, userID, definitionID, assignmentID, action, string(raw), now)
	return err
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

func questCadenceForStore(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "daily":
		return "daily"
	case "weekly":
		return "weekly"
	case "seasonal", "long-term", "long_term":
		return "seasonal"
	case "one_time", "one-time":
		return "one_time"
	default:
		return "skill_based"
	}
}

func questStatusForStore(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "completed":
		return "completed"
	case "locked":
		return "locked"
	case "expired":
		return "expired"
	case "canceled":
		return "canceled"
	default:
		return "active"
	}
}

func questStatusFromStore(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "completed":
		return "Completed"
	case "locked":
		return "Locked"
	case "expired":
		return "Expired"
	case "canceled":
		return "Canceled"
	default:
		return "Active"
	}
}

func questAssignmentKey(userID, snapshotID string, quest contracts.QuestView) string {
	window := strings.TrimSpace(snapshotID)
	if quest.ExpiresAt != nil {
		window = quest.ExpiresAt.UTC().Format("2006-01-02")
	}
	return strings.Join([]string{"quest_assignment", userID, quest.ID, window}, ":")
}

func questProgressEventKey(assignmentID, eventID string) string {
	return strings.Join([]string{"quest_progress", assignmentID, safeQuestKeyPart(eventID)}, ":")
}

func questCompletionKey(assignmentID string) string {
	return "quest_completion:" + strings.TrimSpace(assignmentID)
}

func questRewardGrantKey(assignmentID, reward string) string {
	return strings.Join([]string{"quest_reward", assignmentID, safeQuestKeyPart(reward)}, ":")
}

func questAssignmentAuditKey(assignmentID, action string) string {
	return strings.Join([]string{"quest_audit", assignmentID, safeQuestKeyPart(action)}, ":")
}

func safeQuestKeyPart(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "none"
	}
	replacer := strings.NewReplacer(" ", "_", "\n", "_", "\t", "_")
	return replacer.Replace(value)
}

func normalizedQuestUUID(value string) string {
	uuid, err := contracts.NormalizeUUID(value, "id")
	if err != nil {
		return ""
	}
	return uuid
}

func firstNonZeroTime(values ...time.Time) time.Time {
	for _, value := range values {
		if !value.IsZero() {
			return value.UTC()
		}
	}
	return time.Time{}
}

func questExpiresAtValue(quest contracts.QuestView) any {
	if quest.ExpiresAt == nil || quest.ExpiresAt.IsZero() {
		return nil
	}
	return quest.ExpiresAt.UTC()
}

func questRewardSkill(quest contracts.QuestView) string {
	if skill := normalizeQuestSkill(quest.WeakAreaTarget); skill != "" {
		return skill
	}
	switch quest.ID {
	case "quest-regression-tests":
		return "testing"
	case "quest-maintainer-review":
		return "review"
	case "quest-performance-benchmark":
		return "performance"
	case "quest-consistency":
		return "consistency"
	default:
		return ""
	}
}

func questEvidenceScoreEventIDs(refs []contracts.QuestEvidenceReference) []string {
	ids := make([]string, 0, len(refs))
	seen := map[string]struct{}{}
	for _, ref := range refs {
		id := normalizedQuestUUID(ref.EventID)
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

func questEvidencePullRequestIDs(ctx context.Context, tx pgx.Tx, refs []contracts.QuestEvidenceReference) ([]string, error) {
	scoreEventIDs := questEvidenceScoreEventIDs(refs)
	if len(scoreEventIDs) == 0 {
		return nil, nil
	}
	rows, err := tx.Query(ctx, `
		SELECT DISTINCT pull_request_id::text
		FROM score_events
		WHERE id::text = ANY($1::text[])
		  AND pull_request_id IS NOT NULL
		ORDER BY pull_request_id::text
	`, scoreEventIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]string, 0, len(scoreEventIDs))
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}
