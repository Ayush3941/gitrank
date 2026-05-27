package service

import (
	"testing"
	"time"
)

func TestShouldFinalizeExistingSyncRun(t *testing.T) {
	t.Parallel()

	finishedAt := time.Now().UTC()

	cases := []struct {
		name       string
		status     string
		finishedAt *time.Time
		want       bool
	}{
		{name: "completed terminal", status: "completed", finishedAt: &finishedAt, want: true},
		{name: "failed terminal", status: "failed", finishedAt: &finishedAt, want: true},
		{name: "partial terminal", status: "partial", finishedAt: &finishedAt, want: true},
		{name: "queued in flight", status: "queued", finishedAt: &finishedAt, want: false},
		{name: "running in flight", status: "running", finishedAt: &finishedAt, want: false},
		{name: "in progress in flight", status: "in_progress", finishedAt: &finishedAt, want: false},
		{name: "no finished timestamp", status: "completed", finishedAt: nil, want: false},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := shouldFinalizeExistingSyncRun(tc.status, tc.finishedAt)
			if got != tc.want {
				t.Fatalf("shouldFinalizeExistingSyncRun(%q) = %t, want %t", tc.status, got, tc.want)
			}
		})
	}
}
