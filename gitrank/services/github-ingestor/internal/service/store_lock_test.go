package service

import (
	"context"
	"errors"
	"testing"
	"time"
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

func TestMarkSyncRunRunningRequiresPool(t *testing.T) {
	t.Parallel()

	store := &Store{}
	_, err := store.MarkSyncRunRunning(context.Background(), "corr-1", "user", "octocat", time.Now().UTC())
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("MarkSyncRunRunning() error = %v, want ErrUnavailable", err)
	}
}

func TestCanonicalSyncRunSubject(t *testing.T) {
	t.Parallel()

	if got := canonicalSyncRunSubject("user", " Ayush3941 "); got != "ayush3941" {
		t.Fatalf("canonicalSyncRunSubject(user) = %q, want ayush3941", got)
	}
	if got := canonicalSyncRunSubject("repository", " Owner/Repo "); got != "Owner/Repo" {
		t.Fatalf("canonicalSyncRunSubject(repository) = %q, want Owner/Repo", got)
	}
}

func TestCanonicalRequestedBySubject(t *testing.T) {
	t.Parallel()

	if got := canonicalRequestedBySubject("8F0C38C9-671F-499D-A1B7-1F9F4F57CBB4"); got != "8f0c38c9-671f-499d-a1b7-1f9f4f57cbb4" {
		t.Fatalf("canonicalRequestedBySubject(uuid) = %q, want lowercase uuid", got)
	}
	if got := canonicalRequestedBySubject("service-account"); got != "service-account" {
		t.Fatalf("canonicalRequestedBySubject(non-uuid) = %q, want service-account", got)
	}
}
