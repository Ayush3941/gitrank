package service

import "testing"

func TestSanitizeAccountExportMetadataRedactsSecretBearingKeys(t *testing.T) {
	redactions := []string{}
	sanitized := sanitizeAccountExportMetadata(map[string]any{
		"github_login": "octocat",
		"access_token": "raw-token",
		"nested": map[string]any{
			"session_token_hash": "hash-value",
			"safe":               "visible",
		},
		"events": []any{
			map[string]any{"csrf": "csrf-value"},
			map[string]any{"reason": "user_requested"},
		},
	}, &redactions)

	if sanitized["github_login"] != "octocat" {
		t.Fatalf("github_login = %v, want octocat", sanitized["github_login"])
	}
	if sanitized["access_token"] != "[redacted]" {
		t.Fatalf("access_token = %v, want redacted marker", sanitized["access_token"])
	}
	nested := sanitized["nested"].(map[string]any)
	if nested["session_token_hash"] != "[redacted]" {
		t.Fatalf("nested session hash = %v, want redacted marker", nested["session_token_hash"])
	}
	if nested["safe"] != "visible" {
		t.Fatalf("nested safe value = %v, want visible", nested["safe"])
	}
	events := sanitized["events"].([]any)
	first := events[0].(map[string]any)
	if first["csrf"] != "[redacted]" {
		t.Fatalf("csrf = %v, want redacted marker", first["csrf"])
	}
	if len(redactions) != 3 {
		t.Fatalf("redactions = %+v, want 3 redacted paths", redactions)
	}
}
