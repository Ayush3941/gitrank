package service

import "testing"

func TestComposeSyncRunMetricsIncludesPersistedAndFetchedKeys(t *testing.T) {
	t.Parallel()

	metrics := composeSyncRunMetrics(
		map[string]int{
			"pull_requests": 3,
			"reviews":       2,
		},
		map[string]int{
			"pull_requests": 5,
			"reviews":       4,
			"issues":        1,
		},
	)

	if got := metrics["pull_requests"]; got != 3 {
		t.Fatalf("pull_requests = %d, want 3", got)
	}
	if got := metrics["persisted_pull_requests"]; got != 3 {
		t.Fatalf("persisted_pull_requests = %d, want 3", got)
	}
	if got := metrics["fetched_pull_requests"]; got != 5 {
		t.Fatalf("fetched_pull_requests = %d, want 5", got)
	}
	if got := metrics["fetched_reviews"]; got != 4 {
		t.Fatalf("fetched_reviews = %d, want 4", got)
	}
	if got := metrics["issues"]; got != 1 {
		t.Fatalf("issues = %d, want 1", got)
	}
	if got := metrics["fetched_issues"]; got != 1 {
		t.Fatalf("fetched_issues = %d, want 1", got)
	}
}

func TestComposeSyncRunMetricsSkipsBlankKeys(t *testing.T) {
	t.Parallel()

	metrics := composeSyncRunMetrics(
		map[string]int{
			"":      2,
			"repos": 1,
		},
		map[string]int{
			"   ":    7,
			"issues": 4,
		},
	)

	if _, exists := metrics[""]; exists {
		t.Fatal("blank key should not be present")
	}
	if _, exists := metrics["persisted_"]; exists {
		t.Fatal("blank persisted key should not be present")
	}
	if _, exists := metrics["fetched_"]; exists {
		t.Fatal("blank fetched key should not be present")
	}
	if got := metrics["repos"]; got != 1 {
		t.Fatalf("repos = %d, want 1", got)
	}
	if got := metrics["issues"]; got != 4 {
		t.Fatalf("issues = %d, want 4", got)
	}
}
