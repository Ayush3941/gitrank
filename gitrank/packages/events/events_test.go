package events

import (
	"encoding/json"
	"testing"
	"time"
)

func TestNewEventValidate(t *testing.T) {
	event, err := New(GitHubSyncRequested, "scheduler-worker", "corr-1", map[string]string{
		"user": "octocat",
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if err := event.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestKnownEventPayloadSchemas(t *testing.T) {
	refreshedAt := time.Date(2026, time.May, 5, 16, 0, 0, 0, time.UTC)
	sourceWatermark := refreshedAt.Add(-time.Hour)

	tests := []struct {
		name    string
		payload any
		want    map[string]any
	}{
		{
			name: "github sync requested",
			payload: GitHubSyncRequestedPayload{
				Mode:           "repository",
				Repository:     "octo/repo",
				InstallationID: 12,
				RequestedBy:    "octocat",
			},
			want: map[string]any{
				"mode":            "repository",
				"repository":      "octo/repo",
				"installation_id": float64(12),
				"requested_by":    "octocat",
			},
		},
		{
			name: "pull request ingested",
			payload: GitHubPullRequestIngestedPayload{
				Repository:     "octo/repo",
				Number:         7,
				DeliveryID:     "delivery-1",
				InstallationID: 12,
				Action:         "opened",
				HeadSHA:        "abc123",
			},
			want: map[string]any{
				"repository":      "octo/repo",
				"number":          float64(7),
				"delivery_id":     "delivery-1",
				"installation_id": float64(12),
				"action":          "opened",
				"head_sha":        "abc123",
			},
		},
		{
			name: "analysis completed",
			payload: ContributionAnalysisCompletedPayload{
				PullRequestID:   "pr-1",
				Repository:      "octo/repo",
				Number:          7,
				Classification:  "backend",
				Confidence:      0.85,
				AnalyzerVersion: "deterministic-v1",
			},
			want: map[string]any{
				"pull_request_id":  "pr-1",
				"repository":       "octo/repo",
				"number":           float64(7),
				"classification":   "backend",
				"confidence":       0.85,
				"analyzer_version": "deterministic-v1",
			},
		},
		{
			name: "score completed",
			payload: ContributionScoreCompletedPayload{
				UserID:        "user-1",
				PullRequestID: "pr-1",
				ScoreVersion:  "v1alpha1",
				DeltaXP:       42,
			},
			want: map[string]any{
				"user_id":         "user-1",
				"pull_request_id": "pr-1",
				"score_version":   "v1alpha1",
				"delta_xp":        float64(42),
			},
		},
		{
			name: "profile refreshed",
			payload: ProfileSnapshotRefreshedPayload{
				UserID:          "user-1",
				SnapshotID:      "snapshot-1",
				SnapshotVersion: "v1",
				RefreshedAt:     refreshedAt,
				SourceWatermark: sourceWatermark,
			},
			want: map[string]any{
				"user_id":          "user-1",
				"snapshot_id":      "snapshot-1",
				"snapshot_version": "v1",
				"refreshed_at":     refreshedAt.Format(time.RFC3339),
				"source_watermark": sourceWatermark.Format(time.RFC3339),
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			payloadBytes, err := json.Marshal(test.payload)
			if err != nil {
				t.Fatalf("Marshal() error = %v", err)
			}

			var got map[string]any
			if err := json.Unmarshal(payloadBytes, &got); err != nil {
				t.Fatalf("Unmarshal() error = %v", err)
			}
			if len(got) != len(test.want) {
				t.Fatalf("field count = %d, want %d, payload=%s", len(got), len(test.want), payloadBytes)
			}
			for key, want := range test.want {
				if got[key] != want {
					t.Fatalf("field %q = %#v, want %#v", key, got[key], want)
				}
			}
		})
	}
}
