package service

import (
	"context"
	"testing"
)

func TestAdvisoryLockKeyForGitHubLoginDeterministic(t *testing.T) {
	t.Parallel()

	left := advisoryLockKeyForGitHubLogin("Ayush3941")
	right := advisoryLockKeyForGitHubLogin("ayush3941")
	if left != right {
		t.Fatalf("advisoryLockKeyForGitHubLogin case-insensitive mismatch: %d vs %d", left, right)
	}

	other := advisoryLockKeyForGitHubLogin("octocat")
	if other == left {
		t.Fatalf("advisoryLockKeyForGitHubLogin collision for sample users: %d", other)
	}
}

func TestTryAcquireUserSyncLeaseRequiresPool(t *testing.T) {
	t.Parallel()

	store := &Store{}
	if _, _, err := store.TryAcquireUserSyncLease(context.Background(), "octocat"); err == nil {
		t.Fatal("TryAcquireUserSyncLease() error = nil, want ErrUnavailable")
	}
}
