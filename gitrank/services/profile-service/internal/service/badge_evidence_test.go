package service

import "testing"

func TestNormalizeBadgeEvidenceBackfillsRuleVersionAndPRIDs(t *testing.T) {
	evidence := map[string]any{
		"pull_request_id": "pr-legacy",
	}
	normalized, changed := normalizeBadgeEvidence("critical-path-contributor", evidence, []string{"pr-fallback"})
	if !changed {
		t.Fatal("changed = false, want true for legacy badge evidence")
	}
	if rule, _ := normalized["rule"].(string); rule != "critical-path-contributor" {
		t.Fatalf("rule = %q, want critical-path-contributor", rule)
	}
	if version, _ := normalized["rule_version"].(string); version != "badges/v1" {
		t.Fatalf("rule_version = %q, want badges/v1", version)
	}
	ids, ok := normalized["evidence_pr_ids"].([]string)
	if !ok {
		t.Fatalf("evidence_pr_ids type = %T, want []string", normalized["evidence_pr_ids"])
	}
	if len(ids) != 2 || ids[0] != "pr-legacy" || ids[1] != "pr-fallback" {
		t.Fatalf("evidence_pr_ids = %+v, want [pr-legacy pr-fallback]", ids)
	}
}

func TestNormalizeBadgeEvidenceUsesQuestRewardRuleVersion(t *testing.T) {
	evidence := map[string]any{
		"quest_reward": map[string]any{
			"evidence_pr_ids": []any{"pr-quest", "pr-quest"},
		},
	}
	normalized, changed := normalizeBadgeEvidence("quest-badge", evidence, nil)
	if !changed {
		t.Fatal("changed = false, want true for quest reward evidence")
	}
	if rule, _ := normalized["rule"].(string); rule != "quest_reward" {
		t.Fatalf("rule = %q, want quest_reward", rule)
	}
	if version, _ := normalized["rule_version"].(string); version != questRewardVersion {
		t.Fatalf("rule_version = %q, want %q", version, questRewardVersion)
	}
	ids, ok := normalized["evidence_pr_ids"].([]string)
	if !ok {
		t.Fatalf("evidence_pr_ids type = %T, want []string", normalized["evidence_pr_ids"])
	}
	if len(ids) != 1 || ids[0] != "pr-quest" {
		t.Fatalf("evidence_pr_ids = %+v, want [pr-quest]", ids)
	}
}

func TestBadgeFallbackPRIDsDedupesAndCaps(t *testing.T) {
	rows := []scoreRow{
		{PullRequestID: "pr-1"},
		{PullRequestID: "pr-2"},
		{PullRequestID: "pr-1"},
		{PullRequestID: "pr-3"},
	}
	ids := badgeFallbackPRIDs(rows, 2)
	if len(ids) != 2 || ids[0] != "pr-1" || ids[1] != "pr-2" {
		t.Fatalf("fallback ids = %+v, want first two unique PR ids", ids)
	}
}
