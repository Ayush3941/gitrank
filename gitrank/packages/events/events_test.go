package events

import "testing"

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
