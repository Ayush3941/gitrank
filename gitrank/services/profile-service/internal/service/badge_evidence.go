package service

import (
	"encoding/json"
	"sort"
	"strings"
)

func badgeFallbackPRIDs(scoreRows []scoreRow, limit int) []string {
	if limit <= 0 {
		limit = 5
	}
	out := make([]string, 0, limit)
	seen := make(map[string]struct{}, limit)
	for _, row := range scoreRows {
		id := strings.TrimSpace(row.PullRequestID)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
		if len(out) >= limit {
			break
		}
	}
	return out
}

func normalizeBadgeEvidence(badgeKey string, evidence map[string]any, fallbackPRIDs []string) (map[string]any, bool) {
	if evidence == nil {
		evidence = map[string]any{}
	}
	changed := false

	rule := strings.TrimSpace(stringFromAny(evidence["rule"]))
	if rule == "" {
		if _, hasQuestReward := evidence["quest_reward"]; hasQuestReward {
			rule = "quest_reward"
		} else {
			rule = strings.TrimSpace(badgeKey)
		}
		if rule != "" {
			evidence["rule"] = rule
			changed = true
		}
	}

	ruleVersion := strings.TrimSpace(stringFromAny(evidence["rule_version"]))
	if ruleVersion == "" {
		if rule == "quest_reward" {
			ruleVersion = questRewardVersion
		} else {
			ruleVersion = "badges/v1"
		}
		evidence["rule_version"] = ruleVersion
		changed = true
	}

	normalizedIDs := collectBadgeEvidencePRIDs(evidence, fallbackPRIDs)
	if existing, ok := evidence["evidence_pr_ids"]; !ok || !equalPRIDList(existing, normalizedIDs) {
		evidence["evidence_pr_ids"] = normalizedIDs
		changed = true
	}
	return evidence, changed
}

func collectBadgeEvidencePRIDs(evidence map[string]any, fallbackPRIDs []string) []string {
	seen := make(map[string]struct{}, 8)
	out := make([]string, 0, 8)

	appendPRIDList(&out, seen, evidence["evidence_pr_ids"])
	if questReward, ok := evidence["quest_reward"].(map[string]any); ok {
		appendPRIDList(&out, seen, questReward["evidence_pr_ids"])
	}
	appendPRIDsFromEvidenceRows(&out, seen, evidence["evidence_prs"])
	appendSinglePRID(&out, seen, evidence["pull_request_id"])
	appendPRIDList(&out, seen, fallbackPRIDs)

	return out
}

func appendPRIDsFromEvidenceRows(out *[]string, seen map[string]struct{}, raw any) {
	rows, ok := raw.([]any)
	if !ok {
		return
	}
	for _, row := range rows {
		entry, ok := row.(map[string]any)
		if !ok {
			continue
		}
		appendSinglePRID(out, seen, entry["pull_request_id"])
	}
}

func appendPRIDList(out *[]string, seen map[string]struct{}, raw any) {
	switch values := raw.(type) {
	case []string:
		for _, value := range values {
			appendSinglePRID(out, seen, value)
		}
	case []any:
		for _, value := range values {
			appendSinglePRID(out, seen, value)
		}
	}
}

func appendSinglePRID(out *[]string, seen map[string]struct{}, raw any) {
	id := strings.TrimSpace(stringFromAny(raw))
	if id == "" {
		return
	}
	if _, ok := seen[id]; ok {
		return
	}
	seen[id] = struct{}{}
	*out = append(*out, id)
}

func stringFromAny(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

func equalPRIDList(existing any, want []string) bool {
	current := make([]string, 0, len(want))
	switch typed := existing.(type) {
	case []string:
		for _, value := range typed {
			trimmed := strings.TrimSpace(value)
			if trimmed != "" {
				current = append(current, trimmed)
			}
		}
	case []any:
		for _, value := range typed {
			trimmed := strings.TrimSpace(stringFromAny(value))
			if trimmed != "" {
				current = append(current, trimmed)
			}
		}
	default:
		return false
	}

	if len(current) != len(want) {
		return false
	}
	for i := range current {
		if current[i] != want[i] {
			return false
		}
	}
	return true
}

func marshalBadgeEvidence(evidence map[string]any) (string, error) {
	// Keep serialized output stable for repeat refreshes.
	keys := make([]string, 0, len(evidence))
	for key := range evidence {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	ordered := make(map[string]any, len(evidence))
	for _, key := range keys {
		ordered[key] = evidence[key]
	}
	payload, err := json.Marshal(ordered)
	if err != nil {
		return "", err
	}
	return string(payload), nil
}
