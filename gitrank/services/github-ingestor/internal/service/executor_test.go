package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gitrank/gitrank/packages/authkit"
	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/githubapi"
)

func TestGitHubStatusCodeFromError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		err      error
		wantCode int
		wantOK   bool
	}{
		{
			name:     "extracts status code from github rest error",
			err:      errors.New("GitHub API GET https://api.github.com/repos/octo/repo/commits failed with status 403"),
			wantCode: 403,
			wantOK:   true,
		},
		{
			name:   "missing status code",
			err:    errors.New("dial tcp timeout"),
			wantOK: false,
		},
		{
			name:   "nil error",
			err:    nil,
			wantOK: false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			gotCode, gotOK := gitHubStatusCodeFromError(test.err)
			if gotOK != test.wantOK {
				t.Fatalf("gitHubStatusCodeFromError() ok = %v, want %v", gotOK, test.wantOK)
			}
			if gotCode != test.wantCode {
				t.Fatalf("gitHubStatusCodeFromError() code = %d, want %d", gotCode, test.wantCode)
			}
		})
	}
}

func TestIsSkippableGitHubSyncError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "forbidden errors are skippable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo/commits failed with status 403"),
			want: true,
		},
		{
			name: "not found errors are skippable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo failed with status 404"),
			want: true,
		},
		{
			name: "conflict errors are skippable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo/commits failed with status 409"),
			want: true,
		},
		{
			name: "secondary rate-limit errors are not skippable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo/commits failed with status 429"),
			want: false,
		},
		{
			name: "context deadline exceeded errors are skippable",
			err:  context.DeadlineExceeded,
			want: true,
		},
		{
			name: "context canceled errors are skippable",
			err:  context.Canceled,
			want: true,
		},
		{
			name: "client timeout errors are skippable",
			err:  errors.New("Get \"https://api.github.com/repos/llvm/llvm-project/pulls/182707/reviews?per_page=20\": context deadline exceeded (Client.Timeout exceeded while awaiting headers)"),
			want: true,
		},
		{
			name: "non-github errors are not skippable",
			err:  errors.New("database is unavailable"),
			want: false,
		},
		{
			name: "nil error is not skippable",
			err:  nil,
			want: false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := isSkippableGitHubSyncError(test.err); got != test.want {
				t.Fatalf("isSkippableGitHubSyncError() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestIsRecoverableUserSyncSelectionError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "timeout errors are recoverable",
			err:  context.DeadlineExceeded,
			want: true,
		},
		{
			name: "not found errors are recoverable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo failed with status 404"),
			want: true,
		},
		{
			name: "rate limit errors are recoverable for user selection",
			err:  errors.New("GitHub API GET https://api.github.com/search/issues failed with status 429"),
			want: true,
		},
		{
			name: "server errors are recoverable for user selection",
			err:  errors.New("GitHub API GET https://api.github.com/search/issues failed with status 502"),
			want: true,
		},
		{
			name: "non-github errors are not recoverable",
			err:  errors.New("database is unavailable"),
			want: false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := isRecoverableUserSyncSelectionError(test.err); got != test.want {
				t.Fatalf("isRecoverableUserSyncSelectionError() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestShouldAdvanceAuthoredPRLastSynced(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		fetched          map[string]int
		searchIncomplete bool
		searchOverflow   bool
		want             bool
	}{
		{
			name:             "advances on clean sync",
			fetched:          map[string]int{"authored_pull_requests_selected": 8},
			searchIncomplete: false,
			searchOverflow:   false,
			want:             true,
		},
		{
			name:             "holds cursor when search is incomplete",
			fetched:          map[string]int{"authored_pull_requests_selected": 8},
			searchIncomplete: true,
			searchOverflow:   false,
			want:             false,
		},
		{
			name:             "holds cursor when search overflow is detected",
			fetched:          map[string]int{"authored_pull_requests_selected": 8},
			searchIncomplete: false,
			searchOverflow:   true,
			want:             false,
		},
		{
			name:             "holds cursor when selection search failed",
			fetched:          map[string]int{"authored_pull_request_search_failed": 1},
			searchIncomplete: false,
			searchOverflow:   false,
			want:             false,
		},
		{
			name: "advances cursor on partial retryable hydration failures",
			fetched: map[string]int{
				"authored_pull_requests_selected":  10,
				"authored_pull_requests_skipped":   2,
				"authored_pull_requests_retryable": 2,
			},
			searchIncomplete: false,
			searchOverflow:   false,
			want:             true,
		},
		{
			name: "holds cursor when all selected PR hydrations are retryable",
			fetched: map[string]int{
				"authored_pull_requests_selected":  10,
				"authored_pull_requests_skipped":   10,
				"authored_pull_requests_retryable": 10,
			},
			searchIncomplete: false,
			searchOverflow:   false,
			want:             false,
		},
		{
			name: "holds cursor when auth errors were observed during authored PR hydration",
			fetched: map[string]int{
				"authored_pull_requests_selected":    10,
				"authored_pull_requests_skipped":     2,
				"authored_pull_requests_auth_errors": 1,
			},
			searchIncomplete: false,
			searchOverflow:   false,
			want:             false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			got := shouldAdvanceAuthoredPRLastSynced(test.fetched, test.searchIncomplete, test.searchOverflow)
			if got != test.want {
				t.Fatalf(
					"shouldAdvanceAuthoredPRLastSynced(%v, incomplete=%v, overflow=%v) = %v, want %v",
					test.fetched,
					test.searchIncomplete,
					test.searchOverflow,
					got,
					test.want,
				)
			}
		})
	}
}

func TestUserSyncExecutionStatus(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		fetched map[string]int
		want    string
	}{
		{
			name:    "completed on clean metrics",
			fetched: map[string]int{"authored_pull_requests_selected": 10},
			want:    "completed",
		},
		{
			name:    "partial when search incomplete",
			fetched: map[string]int{"authored_pull_request_search_incomplete": 1},
			want:    "partial",
		},
		{
			name:    "partial when authored PR backfill is still incomplete",
			fetched: map[string]int{"authored_pull_request_backfill_incomplete": 1},
			want:    "partial",
		},
		{
			name:    "partial when retryable pulls skipped",
			fetched: map[string]int{"authored_pull_requests_retryable": 2},
			want:    "partial",
		},
		{
			name:    "partial when pull request hydration failed",
			fetched: map[string]int{"authored_pull_requests_failed": 1},
			want:    "partial",
		},
		{
			name:    "partial when credential scope is limited",
			fetched: map[string]int{"authored_pull_request_scope_limited": 1},
			want:    "partial",
		},
		{
			name: "partial when selected authored targets are all unmerged",
			fetched: map[string]int{
				"authored_pull_requests_selected":               6,
				"authored_pull_requests_selected_merged":        0,
				"authored_pull_requests_selected_unmerged":      6,
				"authored_pull_requests_selected_unmerged_only": 1,
			},
			want: "partial",
		},
		{
			name:    "partial when discovery window returns zero authored pull requests",
			fetched: map[string]int{"authored_pull_request_discovery_empty": 1},
			want:    "partial",
		},
		{
			name: "partial when discovery is empty despite previously persisted authored pull requests",
			fetched: map[string]int{
				"authored_pull_request_discovery_empty":    1,
				"authored_pull_request_persisted_existing": 1,
			},
			want: "partial",
		},
		{
			name: "partial when zero-discovery-with-history marker is set",
			fetched: map[string]int{
				"authored_pull_request_zero_discovery_with_history": 1,
			},
			want: "partial",
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			got := userSyncExecutionStatus(test.fetched)
			if got != test.want {
				t.Fatalf("userSyncExecutionStatus(%v) = %q, want %q", test.fetched, got, test.want)
			}
		})
	}
}

func TestAnnotateAuthoredPullRequestSelectionMetricsMarksUnmergedOnlySelection(t *testing.T) {
	t.Parallel()

	fetched := map[string]int{
		"authored_pull_requests_selected":          4,
		"authored_pull_requests_selected_merged":   0,
		"authored_pull_requests_selected_unmerged": 4,
	}
	annotateAuthoredPullRequestSelectionMetrics(fetched)
	if fetched["authored_pull_requests_selected_unmerged_only"] != 1 {
		t.Fatalf(
			"fetched[authored_pull_requests_selected_unmerged_only] = %d, want 1",
			fetched["authored_pull_requests_selected_unmerged_only"],
		)
	}
}

func TestAnnotateAuthoredPullRequestSelectionMetrics(t *testing.T) {
	t.Parallel()

	t.Run("marks discovery empty when selected target count is zero", func(t *testing.T) {
		t.Parallel()
		fetched := map[string]int{
			"authored_pull_requests_selected": 0,
		}

		annotateAuthoredPullRequestSelectionMetrics(fetched)

		if fetched["authored_pull_request_discovery_empty"] != 1 {
			t.Fatalf("discovery_empty = %d, want 1", fetched["authored_pull_request_discovery_empty"])
		}
		if fetched["authored_pull_request_zero_discovery_with_history"] != 0 {
			t.Fatalf("zero_discovery_with_history = %d, want 0", fetched["authored_pull_request_zero_discovery_with_history"])
		}
	})

	t.Run("marks zero-discovery-with-history when persisted evidence exists", func(t *testing.T) {
		t.Parallel()
		fetched := map[string]int{
			"authored_pull_requests_selected":          0,
			"authored_pull_request_persisted_existing": 1,
		}

		annotateAuthoredPullRequestSelectionMetrics(fetched)

		if fetched["authored_pull_request_discovery_empty"] != 1 {
			t.Fatalf("discovery_empty = %d, want 1", fetched["authored_pull_request_discovery_empty"])
		}
		if fetched["authored_pull_request_zero_discovery_with_history"] != 1 {
			t.Fatalf("zero_discovery_with_history = %d, want 1", fetched["authored_pull_request_zero_discovery_with_history"])
		}
	})

	t.Run("leaves metrics unchanged when selected target count is positive", func(t *testing.T) {
		t.Parallel()
		fetched := map[string]int{
			"authored_pull_requests_selected": 5,
		}

		annotateAuthoredPullRequestSelectionMetrics(fetched)

		if fetched["authored_pull_request_discovery_empty"] != 0 {
			t.Fatalf("discovery_empty = %d, want 0", fetched["authored_pull_request_discovery_empty"])
		}
		if fetched["authored_pull_request_zero_discovery_with_history"] != 0 {
			t.Fatalf("zero_discovery_with_history = %d, want 0", fetched["authored_pull_request_zero_discovery_with_history"])
		}
	})
}

func TestPullRequestLifecycleFetchedCounts(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		pullRequest map[string]any
		wantMerged  int
		wantOpen    int
		wantClosed  int
	}{
		{
			name: "open and unmerged pull request",
			pullRequest: map[string]any{
				"state":  "open",
				"merged": false,
			},
			wantMerged: 0,
			wantOpen:   1,
			wantClosed: 0,
		},
		{
			name: "closed and merged pull request",
			pullRequest: map[string]any{
				"state":     "closed",
				"merged":    true,
				"merged_at": "2026-05-27T00:00:00Z",
			},
			wantMerged: 1,
			wantOpen:   0,
			wantClosed: 1,
		},
		{
			name: "closed merged_at fallback when merged bool is absent",
			pullRequest: map[string]any{
				"state":     "closed",
				"merged_at": "2026-05-27T00:00:00Z",
			},
			wantMerged: 1,
			wantOpen:   0,
			wantClosed: 1,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			got := pullRequestLifecycleFetchedCounts(test.pullRequest)
			if got["pull_requests_merged"] != test.wantMerged {
				t.Fatalf("pull_requests_merged = %d, want %d", got["pull_requests_merged"], test.wantMerged)
			}
			if got["pull_requests_state_open"] != test.wantOpen {
				t.Fatalf("pull_requests_state_open = %d, want %d", got["pull_requests_state_open"], test.wantOpen)
			}
			if got["pull_requests_state_closed"] != test.wantClosed {
				t.Fatalf("pull_requests_state_closed = %d, want %d", got["pull_requests_state_closed"], test.wantClosed)
			}
		})
	}
}

func TestShouldForceAuthoredPRBootstrap(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 5, 27, 10, 0, 0, 0, time.UTC)

	tests := []struct {
		name           string
		cursor         authoredPRHistoryCursor
		selectedTarget int
		persistedCount int
		want           bool
	}{
		{
			name: "forces bootstrap when cursor exists and both selected and persisted are empty",
			cursor: authoredPRHistoryCursor{
				LastSyncedAt: &now,
			},
			selectedTarget: 0,
			persistedCount: 0,
			want:           true,
		},
		{
			name:           "does not force bootstrap on fresh cursor with no evidence",
			cursor:         authoredPRHistoryCursor{},
			selectedTarget: 0,
			persistedCount: 0,
			want:           false,
		},
		{
			name: "does not force bootstrap when targets were selected",
			cursor: authoredPRHistoryCursor{
				BootstrapComplete: true,
			},
			selectedTarget: 2,
			persistedCount: 0,
			want:           false,
		},
		{
			name: "does not force bootstrap when persisted evidence exists",
			cursor: authoredPRHistoryCursor{
				BootstrapComplete: true,
			},
			selectedTarget: 0,
			persistedCount: 3,
			want:           false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			got := shouldForceAuthoredPRBootstrap(test.cursor, test.selectedTarget, test.persistedCount)
			if got != test.want {
				t.Fatalf("shouldForceAuthoredPRBootstrap(%+v, %d, %d) = %v, want %v", test.cursor, test.selectedTarget, test.persistedCount, got, test.want)
			}
		})
	}
}

func TestSyncFailureFetchedMetrics(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		err      error
		wantKeys []string
	}{
		{
			name:     "timeout tagged",
			err:      context.DeadlineExceeded,
			wantKeys: []string{"failed", "timeout_errors"},
		},
		{
			name:     "rate limit tagged",
			err:      errors.New("GitHub API GET https://api.github.com/search/issues failed with status 429"),
			wantKeys: []string{"failed", "rate_limited"},
		},
		{
			name:     "auth tagged",
			err:      errors.New("GitHub API GET https://api.github.com/repos/octo/repo failed with status 403"),
			wantKeys: []string{"failed", "auth_errors"},
		},
		{
			name:     "unsupported api version tagged",
			err:      errors.New("GitHub API GET https://api.github.com/repos/octo/repo failed with status 400: Not a supported version"),
			wantKeys: []string{"failed", "unsupported_api_version"},
		},
		{
			name:     "upstream tagged",
			err:      errors.New("GitHub API GET https://api.github.com/repos/octo/repo failed with status 502"),
			wantKeys: []string{"failed", "upstream_errors"},
		},
		{
			name:     "generic request tagged",
			err:      errors.New("invalid request payload"),
			wantKeys: []string{"failed", "request_errors"},
		},
		{
			name:     "user sync conflict tagged",
			err:      ErrUserSyncInProgress,
			wantKeys: []string{"failed", "user_sync_in_progress", "lease_conflicts"},
		},
		{
			name:     "app installation required tagged",
			err:      ErrUserSyncGitHubAppInstallationRequired,
			wantKeys: []string{"failed", "auth_errors", "app_installation_required"},
		},
		{
			name:     "app installation unavailable tagged",
			err:      ErrUserSyncGitHubAppUnavailable,
			wantKeys: []string{"failed", "request_errors", "app_installation_unavailable"},
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			metrics := syncFailureFetchedMetrics(test.err)
			for _, key := range test.wantKeys {
				if metrics[key] != 1 {
					t.Fatalf("syncFailureFetchedMetrics(%v)[%q] = %d, want 1", test.err, key, metrics[key])
				}
			}
		})
	}
}

func TestClassifyAuthoredPullRequestHydrationError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		err      error
		wantKeys []string
	}{
		{
			name: "timeout is retryable",
			err:  context.DeadlineExceeded,
			wantKeys: []string{
				"authored_pull_requests_skipped",
				"authored_pull_requests_timeouts",
				"authored_pull_requests_retryable",
			},
		},
		{
			name: "rate limit is retryable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo/pulls/7 failed with status 429"),
			wantKeys: []string{
				"authored_pull_requests_skipped",
				"authored_pull_requests_rate_limited",
				"authored_pull_requests_retryable",
			},
		},
		{
			name: "auth is tagged",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo/pulls/7 failed with status 403"),
			wantKeys: []string{
				"authored_pull_requests_skipped",
				"authored_pull_requests_auth_errors",
			},
		},
		{
			name: "not found is tagged",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo/pulls/7 failed with status 404"),
			wantKeys: []string{
				"authored_pull_requests_skipped",
				"authored_pull_requests_not_found",
			},
		},
		{
			name: "upstream is retryable",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo/pulls/7 failed with status 502"),
			wantKeys: []string{
				"authored_pull_requests_skipped",
				"authored_pull_requests_upstream_errors",
				"authored_pull_requests_retryable",
			},
		},
		{
			name: "unsupported api version is tagged",
			err:  errors.New("GitHub API GET https://api.github.com/repos/octo/repo/pulls/7 failed with status 400: Not a supported version"),
			wantKeys: []string{
				"authored_pull_requests_skipped",
				"authored_pull_requests_unsupported_api_version",
			},
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			fetched := map[string]int{}
			classifyAuthoredPullRequestHydrationError(fetched, test.err)
			for _, key := range test.wantKeys {
				if fetched[key] != 1 {
					t.Fatalf("classifyAuthoredPullRequestHydrationError(%v)[%q] = %d, want 1", test.err, key, fetched[key])
				}
			}
		})
	}
}

func TestIsUnsupportedGitHubAPIVersionError(t *testing.T) {
	t.Parallel()

	if !isUnsupportedGitHubAPIVersionError(errors.New("status 400: Not a supported version")) {
		t.Fatal("expected unsupported version phrase to be detected")
	}
	if !isUnsupportedGitHubAPIVersionError(errors.New("status 400: API version is not supported")) {
		t.Fatal("expected alternate unsupported version phrase to be detected")
	}
	if isUnsupportedGitHubAPIVersionError(errors.New("status 400: Problems parsing JSON")) {
		t.Fatal("unexpected unsupported version detection for generic 400")
	}
}

func TestBoundedUserPRSyncTimeout(t *testing.T) {
	t.Parallel()

	defaultTimeout := 45 * time.Second
	minTimeout := 20 * time.Second
	maxTimeout := 90 * time.Second

	tests := []struct {
		name string
		cfg  config.App
		want time.Duration
	}{
		{
			name: "uses fallback when timeout is missing",
			cfg: config.App{
				GitHub: config.GitHub{
					UserPRSyncTimeoutDefault: defaultTimeout,
					UserPRSyncTimeoutMin:     minTimeout,
					UserPRSyncTimeoutMax:     maxTimeout,
				},
			},
			want: defaultTimeout,
		},
		{
			name: "uses minimum bound when default timeout is too short",
			cfg: config.App{
				GitHub: config.GitHub{
					UserPRSyncTimeoutDefault: 5 * time.Second,
					UserPRSyncTimeoutMin:     minTimeout,
					UserPRSyncTimeoutMax:     maxTimeout,
				},
			},
			want: minTimeout,
		},
		{
			name: "uses default timeout when within bounds",
			cfg: config.App{
				GitHub: config.GitHub{
					UserPRSyncTimeoutDefault: 55 * time.Second,
					UserPRSyncTimeoutMin:     minTimeout,
					UserPRSyncTimeoutMax:     maxTimeout,
				},
			},
			want: 55 * time.Second,
		},
		{
			name: "uses maximum bound when default timeout is too high",
			cfg: config.App{
				GitHub: config.GitHub{
					UserPRSyncTimeoutDefault: 120 * time.Second,
					UserPRSyncTimeoutMin:     minTimeout,
					UserPRSyncTimeoutMax:     maxTimeout,
				},
			},
			want: maxTimeout,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := boundedUserPRSyncTimeout(test.cfg); got != test.want {
				t.Fatalf("boundedUserPRSyncTimeout() = %s, want %s", got, test.want)
			}
		})
	}
}

func TestBoundedAuthoredPRSyncLimit(t *testing.T) {
	t.Parallel()

	cfg := config.GitHub{
		AuthoredPRSyncLimit:   15,
		AuthoredPRSearchLimit: 100,
	}

	if got := boundedAuthoredPRSyncLimit(cfg, 0); got != 15 {
		t.Fatalf("boundedAuthoredPRSyncLimit(default) = %d, want 15", got)
	}
	if got := boundedAuthoredPRSyncLimit(cfg, -4); got != 15 {
		t.Fatalf("boundedAuthoredPRSyncLimit(-4) = %d, want 15", got)
	}
	if got := boundedAuthoredPRSyncLimit(cfg, 55); got != 55 {
		t.Fatalf("boundedAuthoredPRSyncLimit(55) = %d, want 55", got)
	}
	if got := boundedAuthoredPRSyncLimit(cfg, 120); got != 100 {
		t.Fatalf("boundedAuthoredPRSyncLimit(120) = %d, want 100", got)
	}
	if got := boundedAuthoredPRSyncLimit(config.GitHub{}, 0); got != 1 {
		t.Fatalf("boundedAuthoredPRSyncLimit(empty) = %d, want 1", got)
	}
	if got := boundedAuthoredPRSyncLimit(config.GitHub{}, authoredPRSearchHardLimit+500); got != authoredPRSearchHardLimit {
		t.Fatalf("boundedAuthoredPRSyncLimit(hard-cap) = %d, want %d", got, authoredPRSearchHardLimit)
	}
	if got := boundedAuthoredPRSyncLimit(config.GitHub{AuthoredPRSearchLimit: authoredPRSearchHardLimit + 50}, authoredPRSearchHardLimit+10); got != authoredPRSearchHardLimit {
		t.Fatalf("boundedAuthoredPRSyncLimit(search-hard-cap) = %d, want %d", got, authoredPRSearchHardLimit)
	}
}

func TestBoundedAuthoredPRSearchLimit(t *testing.T) {
	t.Parallel()

	if got := boundedAuthoredPRSearchLimit(config.GitHub{}); got != authoredPRSearchHardLimit {
		t.Fatalf("boundedAuthoredPRSearchLimit(empty) = %d, want %d", got, authoredPRSearchHardLimit)
	}
	if got := boundedAuthoredPRSearchLimit(config.GitHub{AuthoredPRSearchLimit: 150}); got != 150 {
		t.Fatalf("boundedAuthoredPRSearchLimit(150) = %d, want 150", got)
	}
	if got := boundedAuthoredPRSearchLimit(config.GitHub{AuthoredPRSearchLimit: authoredPRSearchHardLimit + 250}); got != authoredPRSearchHardLimit {
		t.Fatalf("boundedAuthoredPRSearchLimit(hard-cap) = %d, want %d", got, authoredPRSearchHardLimit)
	}
}

func TestExecutorUserSyncLock(t *testing.T) {
	t.Parallel()

	executor := &Executor{}
	if ok := executor.tryAcquireUserSync("OctoCat"); !ok {
		t.Fatal("tryAcquireUserSync(first) = false, want true")
	}
	if ok := executor.tryAcquireUserSync("octocat"); ok {
		t.Fatal("tryAcquireUserSync(second same user) = true, want false")
	}
	executor.releaseUserSync("octocat")
	if ok := executor.tryAcquireUserSync("octocat"); !ok {
		t.Fatal("tryAcquireUserSync(after release) = false, want true")
	}
}

func TestPrioritizeAuthoredPullRequestTargetsBootstrapInProgressIncludesHistoricTargets(t *testing.T) {
	targets := []authoredPullRequestTarget{
		{Repository: "owner/repo", Number: 101},
		{Repository: "owner/repo", Number: 102},
		{Repository: "owner/repo", Number: 103},
		{Repository: "owner/repo", Number: 104},
		{Repository: "owner/repo", Number: 201},
		{Repository: "owner/repo", Number: 202},
	}

	planned := prioritizeAuthoredPullRequestTargets(targets, 3, false, 1)
	if len(planned) != 3 {
		t.Fatalf("len(planned) = %d, want 3", len(planned))
	}
	if planned[0].Number != 101 {
		t.Fatalf("planned[0] = #%d, want most recent #101", planned[0].Number)
	}
	if planned[2].Number != 202 {
		t.Fatalf("planned[2] = #%d, want historic tail #202 to guarantee backfill progress", planned[2].Number)
	}
}

func TestPrioritizeAuthoredPullRequestTargetsBootstrapCompleteUsesNewestOnly(t *testing.T) {
	targets := []authoredPullRequestTarget{
		{Repository: "owner/repo", Number: 1},
		{Repository: "owner/repo", Number: 2},
		{Repository: "owner/repo", Number: 3},
		{Repository: "owner/repo", Number: 4},
	}

	planned := prioritizeAuthoredPullRequestTargets(targets, 2, true, 0)
	if len(planned) != 2 {
		t.Fatalf("len(planned) = %d, want 2", len(planned))
	}
	if planned[0].Number != 1 || planned[1].Number != 2 {
		t.Fatalf("planned = %+v, want first two newest targets", planned)
	}
}

func TestPrioritizeAuthoredPullRequestTargetsKeepsNewestWhenRecentSeedCoversLimit(t *testing.T) {
	targets := []authoredPullRequestTarget{
		{Repository: "owner/repo", Number: 11},
		{Repository: "owner/repo", Number: 12},
		{Repository: "owner/repo", Number: 13},
		{Repository: "owner/repo", Number: 99},
		{Repository: "owner/repo", Number: 100},
	}

	planned := prioritizeAuthoredPullRequestTargets(targets, 3, false, 3)
	if len(planned) != 3 {
		t.Fatalf("len(planned) = %d, want 3", len(planned))
	}
	if planned[0].Number != 11 || planned[1].Number != 12 || planned[2].Number != 13 {
		t.Fatalf("planned = %+v, want newest first slice when recent seed already covers limit", planned)
	}
}

func TestExecutorFetchRepositoryUsesStableMetadataCache(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/octo/repo" {
			t.Fatalf("path = %q, want /repos/octo/repo", r.URL.Path)
		}
		requests++
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":               101,
			"name":             "repo",
			"full_name":        "octo/repo",
			"stargazers_count": requests,
			"owner":            map[string]any{"login": "octo"},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			RepositoryCacheTTL: time.Minute,
		},
	}, nil, client)

	first, err := executor.fetchRepository(context.Background(), "octo", "repo")
	if err != nil {
		t.Fatalf("fetchRepository(first) error = %v", err)
	}
	first["full_name"] = "mutated/repo"
	if owner, ok := first["owner"].(map[string]any); ok {
		owner["login"] = "mutated"
	}

	second, err := executor.fetchRepository(context.Background(), "OCTO", "repo")
	if err != nil {
		t.Fatalf("fetchRepository(second) error = %v", err)
	}
	if requests != 1 {
		t.Fatalf("server requests = %d, want cached second fetch", requests)
	}
	if second["full_name"] != "octo/repo" {
		t.Fatalf("full_name = %v, want cached clone unaffected by caller mutation", second["full_name"])
	}
	if owner := object(second["owner"]); stringValue(owner["login"]) != "octo" {
		t.Fatalf("owner login = %v, want cached nested clone unaffected by caller mutation", owner["login"])
	}
	if intValue(second["stargazers_count"]) != 1 {
		t.Fatalf("stargazers_count = %v, want first response", second["stargazers_count"])
	}
}

func TestDecodeOptionalOAuthTokenKeysIncludesPreviousKeys(t *testing.T) {
	keys := decodeOptionalOAuthTokenKeys(config.App{
		Auth: config.Auth{
			TokenEncryptionKey:          "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
			PreviousTokenEncryptionKeys: []string{"YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY="},
		},
	})
	if len(keys) != 2 {
		t.Fatalf("keys len = %d, want current plus previous", len(keys))
	}

	encrypted, err := authkit.EncryptSecret(keys[1], "ghu_previous")
	if err != nil {
		t.Fatalf("EncryptSecret() error = %v", err)
	}
	decrypted, index, err := authkit.DecryptSecretAny(keys, encrypted)
	if err != nil {
		t.Fatalf("DecryptSecretAny() error = %v", err)
	}
	if index != 1 || decrypted != "ghu_previous" {
		t.Fatalf("DecryptSecretAny() = %q index %d, want previous token at index 1", decrypted, index)
	}
}

func TestExecutorForActorFallsBackWhenInstallationUnavailable(t *testing.T) {
	t.Parallel()

	baseClient := &githubapi.RESTClient{}
	executor := &Executor{
		client: baseClient,
		actorInstallation: func(context.Context, SyncRequestActor) (*githubapi.RESTClient, bool, error) {
			return nil, false, nil
		},
	}

	runtime, err := executor.executorForActor(context.Background(), SyncRequestActor{GitHubLogin: "octocat"}, time.Now().UTC())
	if err != nil {
		t.Fatalf("executorForActor() error = %v", err)
	}
	if runtime != executor {
		t.Fatalf("executorForActor() runtime = %p, want fallback executor %p", runtime, executor)
	}
}

func TestExecutorForActorFallsBackWhenInstallationErrors(t *testing.T) {
	t.Parallel()

	baseClient := &githubapi.RESTClient{}
	executor := &Executor{
		client: baseClient,
		actorInstallation: func(context.Context, SyncRequestActor) (*githubapi.RESTClient, bool, error) {
			return nil, false, errors.New("installation lookup failed")
		},
	}

	runtime, err := executor.executorForActor(context.Background(), SyncRequestActor{GitHubLogin: "octocat"}, time.Now().UTC())
	if err != nil {
		t.Fatalf("executorForActor() error = %v", err)
	}
	if runtime != executor {
		t.Fatalf("executorForActor() runtime = %p, want fallback executor %p", runtime, executor)
	}
}

func TestExecutorForActorPrefersInstallationClientWhenAvailable(t *testing.T) {
	t.Parallel()

	baseClient := &githubapi.RESTClient{}
	installationClient := &githubapi.RESTClient{}
	executor := &Executor{
		client: baseClient,
		actorInstallation: func(context.Context, SyncRequestActor) (*githubapi.RESTClient, bool, error) {
			return installationClient, true, nil
		},
		graphqlTokenSource: func(context.Context, SyncRequestActor, time.Time) (githubapi.TokenSource, bool, error) {
			return githubapi.StaticTokenSource("ghu_fallback_token"), true, nil
		},
		restClientFactory: func(githubapi.TokenSource) (*githubapi.RESTClient, error) {
			return &githubapi.RESTClient{}, nil
		},
	}

	runtime, err := executor.executorForActor(context.Background(), SyncRequestActor{GitHubLogin: "octocat"}, time.Now().UTC())
	if err != nil {
		t.Fatalf("executorForActor() error = %v", err)
	}
	if runtime == executor {
		t.Fatalf("executorForActor() runtime = %p, want cloned executor with installation client", runtime)
	}
	if runtime.client != installationClient {
		t.Fatalf("runtime.client = %p, want installation client %p", runtime.client, installationClient)
	}
}

func TestExecutorForUserSyncActorUsesInstallationWhenAvailable(t *testing.T) {
	t.Parallel()

	baseClient := &githubapi.RESTClient{}
	installationClient := &githubapi.RESTClient{}
	executor := &Executor{
		client: baseClient,
		actorInstallation: func(context.Context, SyncRequestActor) (*githubapi.RESTClient, bool, error) {
			return installationClient, true, nil
		},
	}

	runtime, source, err := executor.executorForUserSyncActor(context.Background(), SyncRequestActor{GitHubLogin: "octocat"}, time.Now().UTC())
	if err != nil {
		t.Fatalf("executorForUserSyncActor() error = %v", err)
	}
	if source != "installation" {
		t.Fatalf("credential source = %q, want installation", source)
	}
	if runtime == executor {
		t.Fatalf("executorForUserSyncActor() runtime = %p, want cloned executor", runtime)
	}
	if runtime.client != installationClient {
		t.Fatalf("runtime.client = %p, want installation client %p", runtime.client, installationClient)
	}
}

func TestExecutorForUserSyncActorReturnsErrorWhenActorInstallationMissing(t *testing.T) {
	t.Parallel()

	executor := &Executor{
		client: &githubapi.RESTClient{},
	}

	runtime, source, err := executor.executorForUserSyncActor(context.Background(), SyncRequestActor{GitHubLogin: "octocat"}, time.Now().UTC())
	if err == nil {
		t.Fatalf("executorForUserSyncActor() error = nil, want app-unavailable error")
	}
	if !errors.Is(err, ErrUserSyncGitHubAppUnavailable) {
		t.Fatalf("executorForUserSyncActor() error = %v, want ErrUserSyncGitHubAppUnavailable", err)
	}
	if runtime != nil {
		t.Fatalf("executorForUserSyncActor() runtime = %p, want nil when actor installation is missing", runtime)
	}
	if source != "" {
		t.Fatalf("credential source = %q, want empty source when actor installation is missing", source)
	}
}

func TestExecutorForUserSyncActorReturnsErrorWhenInstallationMissing(t *testing.T) {
	t.Parallel()

	executor := &Executor{
		client: &githubapi.RESTClient{},
		actorInstallation: func(context.Context, SyncRequestActor) (*githubapi.RESTClient, bool, error) {
			return nil, false, nil
		},
	}

	runtime, source, err := executor.executorForUserSyncActor(context.Background(), SyncRequestActor{GitHubLogin: "octocat"}, time.Now().UTC())
	if err == nil {
		t.Fatalf("executorForUserSyncActor() error = nil, want app-installation-required error")
	}
	if !errors.Is(err, ErrUserSyncGitHubAppInstallationRequired) {
		t.Fatalf("executorForUserSyncActor() error = %v, want ErrUserSyncGitHubAppInstallationRequired", err)
	}
	if runtime != nil {
		t.Fatalf("executorForUserSyncActor() runtime = %p, want nil when installation is missing", runtime)
	}
	if source != "" {
		t.Fatalf("credential source = %q, want empty source when installation is missing", source)
	}
}

func TestExecutorForUserSyncActorReturnsErrorWhenGitHubLoginMissing(t *testing.T) {
	t.Parallel()

	executor := &Executor{client: &githubapi.RESTClient{}}
	runtime, source, err := executor.executorForUserSyncActor(context.Background(), SyncRequestActor{}, time.Now().UTC())
	if err == nil {
		t.Fatalf("executorForUserSyncActor() error = nil, want app-installation-required error")
	}
	if !errors.Is(err, ErrUserSyncGitHubAppInstallationRequired) {
		t.Fatalf("executorForUserSyncActor() error = %v, want ErrUserSyncGitHubAppInstallationRequired", err)
	}
	if runtime != nil {
		t.Fatalf("executorForUserSyncActor() runtime = %p, want nil when login missing", runtime)
	}
	if source != "" {
		t.Fatalf("credential source = %q, want empty source when login missing", source)
	}
}

func TestExecutorForUserSyncActorReturnsErrorWhenInstallationTokenUnavailable(t *testing.T) {
	t.Parallel()

	executor := &Executor{
		client: &githubapi.RESTClient{},
		actorInstallation: func(context.Context, SyncRequestActor) (*githubapi.RESTClient, bool, error) {
			return nil, false, errors.New("installation token mint failed")
		},
	}

	runtime, source, err := executor.executorForUserSyncActor(context.Background(), SyncRequestActor{GitHubLogin: "octocat"}, time.Now().UTC())
	if err == nil {
		t.Fatalf("executorForUserSyncActor() error = nil, want installation-unavailable error")
	}
	if !errors.Is(err, ErrUserSyncGitHubAppUnavailable) {
		t.Fatalf("executorForUserSyncActor() error = %v, want ErrUserSyncGitHubAppUnavailable", err)
	}
	if runtime != nil {
		t.Fatalf("executorForUserSyncActor() runtime = %p, want nil when installation token is unavailable", runtime)
	}
	if source != "" {
		t.Fatalf("credential source = %q, want empty source when installation token is unavailable", source)
	}
}

func TestExecutorForStrictAppSyncActorUsesInstallationWhenAvailable(t *testing.T) {
	t.Parallel()

	baseClient := &githubapi.RESTClient{}
	installationClient := &githubapi.RESTClient{}
	executor := &Executor{
		client: baseClient,
		actorInstallation: func(context.Context, SyncRequestActor) (*githubapi.RESTClient, bool, error) {
			return installationClient, true, nil
		},
		graphqlTokenSource: func(context.Context, SyncRequestActor, time.Time) (githubapi.TokenSource, bool, error) {
			return githubapi.StaticTokenSource("ghu_oauth"), true, nil
		},
	}

	runtime, err := executor.executorForStrictAppSyncActor(context.Background(), SyncRequestActor{GitHubLogin: "octocat"}, time.Now().UTC())
	if err != nil {
		t.Fatalf("executorForStrictAppSyncActor() error = %v", err)
	}
	if runtime == executor {
		t.Fatalf("executorForStrictAppSyncActor() runtime = %p, want cloned executor", runtime)
	}
	if runtime.client != installationClient {
		t.Fatalf("runtime.client = %p, want installation client %p", runtime.client, installationClient)
	}
	if runtime.graphqlTokenSource != nil {
		t.Fatal("runtime.graphqlTokenSource should be nil for strict app sync")
	}
}

func TestExecutorForStrictAppSyncActorFailsWhenInstallationMissing(t *testing.T) {
	t.Parallel()

	executor := &Executor{
		client: &githubapi.RESTClient{},
		actorInstallation: func(context.Context, SyncRequestActor) (*githubapi.RESTClient, bool, error) {
			return nil, false, nil
		},
	}

	runtime, err := executor.executorForStrictAppSyncActor(context.Background(), SyncRequestActor{GitHubLogin: "octocat"}, time.Now().UTC())
	if err == nil {
		t.Fatalf("executorForStrictAppSyncActor() error = nil, want app-installation-required error")
	}
	if !errors.Is(err, ErrUserSyncGitHubAppInstallationRequired) {
		t.Fatalf("executorForStrictAppSyncActor() error = %v, want ErrUserSyncGitHubAppInstallationRequired", err)
	}
	if runtime != nil {
		t.Fatalf("executorForStrictAppSyncActor() runtime = %p, want nil runtime", runtime)
	}
}

func TestExecutorForStrictAppSyncRequestUsesInstallationIDWhenActorMissing(t *testing.T) {
	t.Parallel()

	baseClient := &githubapi.RESTClient{}
	installationClient := &githubapi.RESTClient{}
	executor := &Executor{
		client: baseClient,
		installationClient: func(context.Context, int64) (*githubapi.RESTClient, bool, error) {
			return installationClient, true, nil
		},
		graphqlTokenSource: func(context.Context, SyncRequestActor, time.Time) (githubapi.TokenSource, bool, error) {
			return githubapi.StaticTokenSource("ghu_oauth"), true, nil
		},
	}

	runtime, err := executor.executorForStrictAppSyncRequest(context.Background(), SyncRequestActor{}, 12001, time.Now().UTC())
	if err != nil {
		t.Fatalf("executorForStrictAppSyncRequest() error = %v", err)
	}
	if runtime == executor {
		t.Fatalf("executorForStrictAppSyncRequest() runtime = %p, want cloned executor", runtime)
	}
	if runtime.client != installationClient {
		t.Fatalf("runtime.client = %p, want installation client %p", runtime.client, installationClient)
	}
	if runtime.graphqlTokenSource != nil {
		t.Fatal("runtime.graphqlTokenSource should be nil for strict app sync")
	}
}

func TestExecutorForStrictAppSyncRequestFailsWhenNoActorAndNoInstallation(t *testing.T) {
	t.Parallel()

	executor := &Executor{
		client: &githubapi.RESTClient{},
	}

	runtime, err := executor.executorForStrictAppSyncRequest(context.Background(), SyncRequestActor{}, 0, time.Now().UTC())
	if err == nil {
		t.Fatalf("executorForStrictAppSyncRequest() error = nil, want app-installation-required error")
	}
	if !errors.Is(err, ErrUserSyncGitHubAppInstallationRequired) {
		t.Fatalf("executorForStrictAppSyncRequest() error = %v, want ErrUserSyncGitHubAppInstallationRequired", err)
	}
	if runtime != nil {
		t.Fatalf("executorForStrictAppSyncRequest() runtime = %p, want nil runtime", runtime)
	}
}

func TestInstallationClientSupportsAuthoredPullRequestsTrueWhenSearchHasHits(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/search/issues" {
			t.Fatalf("path = %q, want /search/issues", r.URL.Path)
		}
		if !strings.Contains(r.URL.Query().Get("q"), "author:ayush3941 is:pull-request") {
			t.Fatalf("query = %q, expected authored pull-request search", r.URL.Query().Get("q"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"total_count":        1,
			"incomplete_results": false,
			"items": []map[string]any{
				{
					"number":         1,
					"repository_url": "https://api.github.com/repos/octo/repo",
					"pull_request": map[string]any{
						"url": "https://api.github.com/repos/octo/repo/pulls/1",
					},
				},
			},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := &Executor{}
	supported, err := executor.installationClientSupportsAuthoredPullRequests(context.Background(), client, "ayush3941")
	if err != nil {
		t.Fatalf("installationClientSupportsAuthoredPullRequests() error = %v", err)
	}
	if !supported {
		t.Fatal("installationClientSupportsAuthoredPullRequests() = false, want true")
	}
}

func TestInstallationClientSupportsAuthoredPullRequestsFalseWhenSearchEmpty(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"total_count":        0,
			"incomplete_results": false,
			"items":              []map[string]any{},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := &Executor{}
	supported, err := executor.installationClientSupportsAuthoredPullRequests(context.Background(), client, "ayush3941")
	if err != nil {
		t.Fatalf("installationClientSupportsAuthoredPullRequests() error = %v", err)
	}
	if supported {
		t.Fatal("installationClientSupportsAuthoredPullRequests() = true, want false")
	}
}

func TestExecutorFetchPullRequestFilesUsesBoundedRESTEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/octo/repo/pulls/7/files" {
			t.Fatalf("path = %q, want /repos/octo/repo/pulls/7/files", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "100" {
			t.Fatalf("per_page = %q, want 100", r.URL.Query().Get("per_page"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"filename":  "internal/service.go",
				"status":    "modified",
				"additions": 12,
				"deletions": 3,
				"patch":     "@@ -1 +1 @@\n-old\n+new",
			},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize:            7,
			RepositorySyncPageSize: 10,
		},
	}, nil, client)

	files, err := executor.fetchPullRequestFiles(context.Background(), "octo", "repo", 7)
	if err != nil {
		t.Fatalf("fetchPullRequestFiles() error = %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("files len = %d, want 1", len(files))
	}
	if path := stringValue(files[0]["filename"]); path != "internal/service.go" {
		t.Fatalf("filename = %q, want internal/service.go", path)
	}
}

func TestExecutorFetchPullRequestFilesPaginatesUsingLinkHeaders(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/octo/repo/pulls/9/files" {
			t.Fatalf("path = %q, want /repos/octo/repo/pulls/9/files", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "100" {
			t.Fatalf("per_page = %q, want 100", r.URL.Query().Get("per_page"))
		}

		requests++
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Query().Get("page") {
		case "1":
			w.Header().Set("Link", `<https://api.github.test/repos/octo/repo/pulls/9/files?page=2>; rel="next"`)
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"filename": "first.go", "status": "modified", "changes": 1},
			})
		case "2":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"filename": "second.go", "status": "added", "changes": 4},
			})
		default:
			t.Fatalf("unexpected page = %q", r.URL.Query().Get("page"))
		}
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize: 100,
		},
	}, nil, client)

	files, err := executor.fetchPullRequestFiles(context.Background(), "octo", "repo", 9)
	if err != nil {
		t.Fatalf("fetchPullRequestFiles() error = %v", err)
	}
	if requests != 2 {
		t.Fatalf("requests = %d, want 2", requests)
	}
	if len(files) != 2 {
		t.Fatalf("files len = %d, want 2", len(files))
	}
	if stringValue(files[0]["filename"]) != "first.go" || stringValue(files[1]["filename"]) != "second.go" {
		t.Fatalf("filenames = %#v, want [first.go second.go]", []string{stringValue(files[0]["filename"]), stringValue(files[1]["filename"])})
	}
}

func TestExecutorFetchPullRequestFilesWithPageSizeOverride(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/octo/repo/pulls/13/files" {
			t.Fatalf("path = %q, want /repos/octo/repo/pulls/13/files", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "25" {
			t.Fatalf("per_page = %q, want 25 override", r.URL.Query().Get("per_page"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"filename":  "cmd/main.go",
				"status":    "modified",
				"additions": 8,
				"deletions": 2,
			},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{GitHub: config.GitHub{MaxPageSize: 100}}, nil, client)

	files, err := executor.fetchPullRequestFilesWithPageSize(context.Background(), "octo", "repo", 13, 25)
	if err != nil {
		t.Fatalf("fetchPullRequestFilesWithPageSize() error = %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("files len = %d, want 1", len(files))
	}
	if path := stringValue(files[0]["filename"]); path != "cmd/main.go" {
		t.Fatalf("filename = %q, want cmd/main.go", path)
	}
}

func TestExecutorFetchPullRequestFilesWithPageSizeOverrideCapsAtHundred(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/octo/repo/pulls/14/files" {
			t.Fatalf("path = %q, want /repos/octo/repo/pulls/14/files", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "100" {
			t.Fatalf("per_page = %q, want capped 100", r.URL.Query().Get("per_page"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"filename": "pkg/config/config.go",
				"status":   "modified",
			},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{GitHub: config.GitHub{MaxPageSize: 100}}, nil, client)
	files, err := executor.fetchPullRequestFilesWithPageSize(context.Background(), "octo", "repo", 14, 250)
	if err != nil {
		t.Fatalf("fetchPullRequestFilesWithPageSize() error = %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("files len = %d, want 1", len(files))
	}
}

func TestExecutorFetchAuthoredPullRequestTargetsUsesGitHubSearch(t *testing.T) {
	requestsBySort := map[string]int{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/search/issues" {
			t.Fatalf("path = %q, want /search/issues", r.URL.Path)
		}
		query := r.URL.Query()
		if got := query.Get("q"); !strings.Contains(got, "author:alice is:pull-request archived:false") {
			t.Fatalf("q = %q, want authored PR search query", got)
		}
		sort := query.Get("sort")
		if sort != "updated" && sort != "created" {
			t.Fatalf("sort = %q, want updated or created", sort)
		}
		if query.Get("order") != "desc" {
			t.Fatalf("order = %q, want desc", query.Get("order"))
		}
		if query.Get("per_page") != "100" {
			t.Fatalf("per_page = %q, want 100", query.Get("per_page"))
		}
		if query.Get("page") != "1" {
			t.Fatalf("page = %q, want 1", query.Get("page"))
		}
		requestsBySort[sort]++

		w.Header().Set("Content-Type", "application/json")
		if sort == "created" {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"total_count":        0,
				"incomplete_results": false,
				"items":              []map[string]any{},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"total_count":        5,
			"incomplete_results": false,
			"items": []map[string]any{
				{
					"number":     12,
					"created_at": "2026-03-12T10:00:00Z",
					"updated_at": "2026-05-12T10:00:00Z",
					"pull_request": map[string]any{
						"url": "https://api.github.com/repos/octo/external/pulls/12",
					},
					"repository": map[string]any{
						"full_name": "octo/external",
						"private":   false,
					},
				},
				{
					"number":         12,
					"created_at":     "2026-03-12T10:00:00Z",
					"updated_at":     "2026-05-12T10:00:00Z",
					"repository_url": "https://api.github.com/repos/octo/external",
					"pull_request": map[string]any{
						"url": "https://api.github.com/repos/octo/external/pulls/12",
					},
				},
				{
					"number":         7,
					"created_at":     "2026-03-01T09:00:00Z",
					"updated_at":     "2026-05-11T09:00:00Z",
					"repository_url": "https://api.github.com/repos/team/utility",
					"pull_request": map[string]any{
						"url": "https://api.github.com/repos/team/utility/pulls/7",
					},
				},
				{
					"number":         55,
					"repository_url": "https://api.github.com/repos/team/issue-only",
				},
				{
					"number":     8,
					"created_at": "2026-01-01T09:00:00Z",
					"updated_at": "2026-01-01T09:00:00Z",
					"pull_request": map[string]any{
						"url": "https://api.github.com/repos/private/repo/pulls/8",
					},
					"repository": map[string]any{
						"full_name": "private/repo",
						"private":   true,
					},
				},
			},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize:           9,
			AuthoredPRSearchLimit: 100,
		},
	}, nil, client)

	selection, err := executor.fetchAuthoredPullRequestTargets(
		context.Background(),
		"alice",
		10,
		authoredPRHistoryCursor{},
		time.Date(2026, time.May, 20, 12, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatalf("fetchAuthoredPullRequestTargets() error = %v", err)
	}
	if selection.SearchIncomplete {
		t.Fatal("SearchIncomplete = true, want false for complete response")
	}
	if len(selection.Targets) != 2 {
		t.Fatalf("targets len = %d, want 2 after dedupe and filtering: %+v", len(selection.Targets), selection.Targets)
	}
	if selection.Targets[0] != (authoredPullRequestTarget{Repository: "octo/external", Number: 12}) {
		t.Fatalf("first target = %+v, want octo/external#12", selection.Targets[0])
	}
	if selection.Targets[1] != (authoredPullRequestTarget{Repository: "team/utility", Number: 7}) {
		t.Fatalf("second target = %+v, want team/utility#7", selection.Targets[1])
	}
	if selection.NextCursor.LastSyncedAt == nil || selection.NextCursor.LastSyncedAt.IsZero() {
		t.Fatal("NextCursor.LastSyncedAt is missing")
	}
	if selection.NextCursor.BackfillBeforeAt == nil || selection.NextCursor.BackfillBeforeAt.IsZero() {
		t.Fatal("NextCursor.BackfillBeforeAt is missing")
	}
	if selection.NextCursor.BootstrapComplete {
		t.Fatal("NextCursor.BootstrapComplete = true, want false while backfill remains in progress")
	}
	if requestsBySort["updated"] != 1 {
		t.Fatalf("updated requests = %d, want 1", requestsBySort["updated"])
	}
	if requestsBySort["created"] == 0 {
		t.Fatal("created requests = 0, want at least one recent-seed or backfill discovery window")
	}
	if selection.Fetched["authored_pull_request_recent_seed_windows"] != 1 {
		t.Fatalf("recent seed windows = %d, want 1", selection.Fetched["authored_pull_request_recent_seed_windows"])
	}
	if selection.Fetched["authored_pull_request_discovery_windows"] < 2 {
		t.Fatalf("discovery windows = %d, want >= 2", selection.Fetched["authored_pull_request_discovery_windows"])
	}
	if selection.Fetched["authored_pull_request_incremental_updated_windows"] == 0 {
		t.Fatalf("incremental updated windows = %d, want at least 1", selection.Fetched["authored_pull_request_incremental_updated_windows"])
	}
	if selection.Fetched["authored_pull_request_incremental_created_windows"] == 0 {
		t.Fatalf("incremental created windows = %d, want at least 1", selection.Fetched["authored_pull_request_incremental_created_windows"])
	}
	if selection.Fetched["authored_pull_request_backfill_empty_windows"] == 0 {
		t.Fatalf("backfill empty windows = %d, want > 0 for empty created windows", selection.Fetched["authored_pull_request_backfill_empty_windows"])
	}
}

func TestExecutorFetchAuthoredPullRequestTargetsRescansWhenIncrementalIsEmpty(t *testing.T) {
	requests := 0
	rescanRequests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/search/issues" {
			t.Fatalf("path = %q, want /search/issues", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "100" {
			t.Fatalf("per_page = %q, want 100", r.URL.Query().Get("per_page"))
		}
		requests++
		query := r.URL.Query().Get("q")
		w.Header().Set("Content-Type", "application/json")
		if strings.Contains(query, "created:2025-05-20T12:00:00Z..2026-05-20T12:00:00Z") {
			rescanRequests++
			_ = json.NewEncoder(w).Encode(map[string]any{
				"total_count":        1,
				"incomplete_results": false,
				"items": []map[string]any{
					{
						"number":     1480,
						"created_at": "2025-08-20T10:00:00Z",
						"updated_at": "2026-05-19T21:30:00Z",
						"pull_request": map[string]any{
							"url": "https://api.github.com/repos/hyperledger-labs/fabric-smart-client/pulls/1480",
						},
						"repository": map[string]any{
							"full_name": "hyperledger-labs/fabric-smart-client",
							"private":   false,
						},
					},
				},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"total_count":        0,
			"incomplete_results": false,
			"items":              []map[string]any{},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize:           100,
			AuthoredPRSearchLimit: 100,
		},
	}, nil, client)

	now := time.Date(2026, time.May, 20, 12, 0, 0, 0, time.UTC)
	lastSynced := now.Add(-20 * time.Minute)
	selection, err := executor.fetchAuthoredPullRequestTargets(
		context.Background(),
		"Ayush3941",
		10,
		authoredPRHistoryCursor{
			LastSyncedAt:      &lastSynced,
			BootstrapComplete: true,
		},
		now,
	)
	if err != nil {
		t.Fatalf("fetchAuthoredPullRequestTargets() error = %v", err)
	}
	if requests < 4 {
		t.Fatalf("requests = %d, want at least 4 queries (recent-seed, updated, created, rescan)", requests)
	}
	if rescanRequests != 1 {
		t.Fatalf("rescan requests = %d, want 1", rescanRequests)
	}
	if selection.Fetched["authored_pull_request_recent_seed_windows"] != 1 {
		t.Fatalf("recent seed windows = %d, want 1", selection.Fetched["authored_pull_request_recent_seed_windows"])
	}
	if selection.Fetched["authored_pull_request_rescan_windows"] != 1 {
		t.Fatalf("rescan windows = %d, want 1", selection.Fetched["authored_pull_request_rescan_windows"])
	}
	if len(selection.Targets) != 1 {
		t.Fatalf("targets len = %d, want 1 after rescan", len(selection.Targets))
	}
	if selection.Targets[0] != (authoredPullRequestTarget{Repository: "hyperledger-labs/fabric-smart-client", Number: 1480}) {
		t.Fatalf("target = %+v, want hyperledger-labs/fabric-smart-client#1480", selection.Targets[0])
	}
}

func TestExecutorFetchAuthoredPullRequestTargetsUsesBroadFallbackWhenWindowedQueriesAreEmpty(t *testing.T) {
	requests := 0
	broadRequests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/search/issues" {
			t.Fatalf("path = %q, want /search/issues", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "100" {
			t.Fatalf("per_page = %q, want 100", r.URL.Query().Get("per_page"))
		}
		requests++
		query := r.URL.Query().Get("q")
		w.Header().Set("Content-Type", "application/json")

		if strings.Contains(query, "author:Ayush3941 is:pull-request archived:false") &&
			!strings.Contains(query, "created:") &&
			!strings.Contains(query, "updated:") {
			broadRequests++
			_ = json.NewEncoder(w).Encode(map[string]any{
				"total_count":        1,
				"incomplete_results": false,
				"items": []map[string]any{
					{
						"number":     1525,
						"created_at": "2025-01-20T10:00:00Z",
						"updated_at": "2026-05-20T09:00:00Z",
						"pull_request": map[string]any{
							"url": "https://api.github.com/repos/hyperledger-labs/fabric-smart-client/pulls/1525",
						},
						"repository": map[string]any{
							"full_name": "hyperledger-labs/fabric-smart-client",
							"private":   false,
						},
					},
				},
			})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"total_count":        0,
			"incomplete_results": false,
			"items":              []map[string]any{},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize:           100,
			AuthoredPRSearchLimit: 100,
		},
	}, nil, client)

	now := time.Date(2026, time.May, 20, 12, 0, 0, 0, time.UTC)
	lastSynced := now.Add(-20 * time.Minute)
	selection, err := executor.fetchAuthoredPullRequestTargets(
		context.Background(),
		"Ayush3941",
		10,
		authoredPRHistoryCursor{
			LastSyncedAt:      &lastSynced,
			BootstrapComplete: true,
		},
		now,
	)
	if err != nil {
		t.Fatalf("fetchAuthoredPullRequestTargets() error = %v", err)
	}
	if requests < 5 {
		t.Fatalf("requests = %d, want at least 5 queries including broad fallback", requests)
	}
	if broadRequests != 1 {
		t.Fatalf("broad fallback requests = %d, want 1", broadRequests)
	}
	if selection.Fetched["authored_pull_request_broad_fallback_windows"] != 1 {
		t.Fatalf(
			"broad fallback windows = %d, want 1",
			selection.Fetched["authored_pull_request_broad_fallback_windows"],
		)
	}
	if selection.Fetched["authored_pull_request_broad_fallback_targets"] != 1 {
		t.Fatalf(
			"broad fallback targets = %d, want 1",
			selection.Fetched["authored_pull_request_broad_fallback_targets"],
		)
	}
	if len(selection.Targets) != 1 {
		t.Fatalf("targets len = %d, want 1 after broad fallback", len(selection.Targets))
	}
	if selection.Targets[0] != (authoredPullRequestTarget{Repository: "hyperledger-labs/fabric-smart-client", Number: 1525}) {
		t.Fatalf("target = %+v, want hyperledger-labs/fabric-smart-client#1525", selection.Targets[0])
	}
}

func TestExecutorFetchLiveInstallationRepositoryTargetsUsesPaginationAndFilters(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/installation/repositories" {
			t.Fatalf("path = %q, want /installation/repositories", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer install-token" {
			t.Fatalf("Authorization = %q, want installation token", r.Header.Get("Authorization"))
		}
		if r.URL.Query().Get("per_page") != "3" {
			t.Fatalf("per_page = %q, want 3", r.URL.Query().Get("per_page"))
		}

		requests++
		page := r.URL.Query().Get("page")
		w.Header().Set("Content-Type", "application/json")
		switch page {
		case "1":
			w.Header().Set("Link", `<https://api.github.test/installation/repositories?page=2>; rel="next"`)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"total_count": 6,
				"repositories": []map[string]any{
					{"full_name": "octo/repo-one", "private": false, "archived": false, "disabled": false},
					{"full_name": "octo/private-repo", "private": true, "archived": false, "disabled": false},
					{"full_name": "octo/archived-repo", "private": false, "archived": true, "disabled": false},
				},
			})
		case "2":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"total_count": 6,
				"repositories": []map[string]any{
					{"full_name": "octo/repo-one", "private": false, "archived": false, "disabled": false},
					{"full_name": "octo/repo-two", "private": false, "archived": false, "disabled": false},
					{"full_name": "invalid", "private": false, "archived": false, "disabled": false},
				},
			})
		default:
			t.Fatalf("unexpected page %q", page)
		}
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		TokenSource:      githubapi.StaticTokenSource("install-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			MaxPageSize:                    3,
			InstallationRepositoryPageSize: 3,
			InstallationRepositoryMaxPages: 10,
		},
	}, nil, client)

	repositories, incomplete, err := executor.fetchLiveInstallationRepositoryTargets(context.Background(), client)
	if err != nil {
		t.Fatalf("fetchLiveInstallationRepositoryTargets() error = %v", err)
	}
	if incomplete {
		t.Fatal("incomplete = true, want false after terminal page without next link")
	}
	if requests != 2 {
		t.Fatalf("requests = %d, want 2 pages", requests)
	}
	if len(repositories) != 2 {
		t.Fatalf("repositories len = %d, want 2 filtered entries", len(repositories))
	}
	if repositories[0] != "octo/repo-one" || repositories[1] != "octo/repo-two" {
		t.Fatalf("repositories = %#v, want octo/repo-one and octo/repo-two", repositories)
	}
}

func TestExecutorFetchLiveInstallationRepositoryTargetsCapsPageDepth(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Link", `<https://api.github.test/installation/repositories?page=999>; rel="next"`)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"total_count": 999,
			"repositories": []map[string]any{
				{"full_name": "octo/repo", "private": false, "archived": false, "disabled": false},
			},
		})
	}))
	defer server.Close()

	client, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          server.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		TokenSource:      githubapi.StaticTokenSource("install-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	cfg := config.App{
		GitHub: config.GitHub{
			MaxPageSize:                    100,
			InstallationRepositoryPageSize: 50,
			InstallationRepositoryMaxPages: 10,
		},
	}
	executor := NewExecutor(cfg, nil, client)

	repositories, incomplete, err := executor.fetchLiveInstallationRepositoryTargets(context.Background(), client)
	if err != nil {
		t.Fatalf("fetchLiveInstallationRepositoryTargets() error = %v", err)
	}
	if !incomplete {
		t.Fatal("incomplete = false, want true when max page depth is reached")
	}
	if requests != cfg.GitHub.InstallationRepositoryMaxPages {
		t.Fatalf("requests = %d, want capped %d", requests, cfg.GitHub.InstallationRepositoryMaxPages)
	}
	if len(repositories) != 1 {
		t.Fatalf("repositories len = %d, want deduped single repository", len(repositories))
	}
}

func TestSanitizedPullRequestFilePayloadBoundsPatchAndDropsContents(t *testing.T) {
	longPatch := strings.Repeat("a", maxStoredPullRequestFilePatchBytes+20)
	file := map[string]any{
		"filename": "internal/service.go",
		"patch":    longPatch,
		"contents": "full file should not be stored",
		"content":  "raw file should not be stored",
		"nested": map[string]any{
			"value": "keep",
		},
	}

	patch := pullRequestFilePatch(file)
	if len(patch) != maxStoredPullRequestFilePatchBytes {
		t.Fatalf("patch bytes = %d, want %d", len(patch), maxStoredPullRequestFilePatchBytes)
	}

	payload := sanitizedPullRequestFilePayload(file, patch)
	if _, ok := payload["contents"]; ok {
		t.Fatal("sanitized payload kept contents field")
	}
	if _, ok := payload["content"]; ok {
		t.Fatal("sanitized payload kept content field")
	}
	if rawStringValue(payload["patch"]) != patch {
		t.Fatal("sanitized payload did not use bounded patch")
	}
	if rawStringValue(file["patch"]) != longPatch {
		t.Fatal("sanitization mutated original patch")
	}

	object(payload["nested"])["value"] = "changed"
	if got := stringValue(object(file["nested"])["value"]); got != "keep" {
		t.Fatalf("nested original value = %q, want keep", got)
	}
}

func TestDerivePullRequestFileFeaturesUsesBoundedPatchEvidence(t *testing.T) {
	rawPatch := strings.Join([]string{
		"@@ -1,2 +1,3 @@",
		" context",
		"-old",
		"+new",
		"+added",
	}, "\n")
	file := map[string]any{
		"filename":  "services/auth/session_test.go",
		"status":    "modified",
		"additions": 2,
		"deletions": 1,
		"changes":   3,
		"patch":     rawPatch,
	}

	features := derivePullRequestFileFeatures(file, pullRequestFilePath(file), rawPatch, rawPatch)

	if features["file_type"] != "test" {
		t.Fatalf("file_type = %v, want test", features["file_type"])
	}
	if features["path_extension"] != ".go" {
		t.Fatalf("path_extension = %v, want .go", features["path_extension"])
	}
	if features["patch_hunks"] != 1 || features["patch_added_lines"] != 2 || features["patch_removed_lines"] != 1 {
		t.Fatalf("patch stats = %+v, want 1 hunk, 2 added, 1 removed", features)
	}
	if features["patch_truncated"] != false || features["binary_or_large_patch"] != false {
		t.Fatalf("patch bounds flags = %+v, want not truncated and not binary", features)
	}
}

func TestBoundedStringBytesKeepsValidUTF8(t *testing.T) {
	if got := boundedStringBytes("aé", 2); got != "a" {
		t.Fatalf("boundedStringBytes() = %q, want a", got)
	}
}

func TestExecutorFetchPullRequestsUsesGraphQLBatchWhenTokenAvailable(t *testing.T) {
	restRequests := make(map[string]int)
	restServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		restRequests[r.URL.Path]++
		if r.URL.Path != "/repos/octo/repo/pulls" {
			t.Fatalf("unexpected REST path %q; GraphQL batch should avoid per-PR REST hydration", r.URL.Path)
		}
		if r.URL.Query().Get("per_page") != "10" {
			t.Fatalf("per_page = %q, want GraphQL-bounded page size 10", r.URL.Query().Get("per_page"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"id":     7007,
				"number": 7,
				"user": map[string]any{
					"id":    1001,
					"login": "alice",
				},
				"labels": []map[string]any{
					{
						"id":          9901,
						"name":        "bug",
						"color":       "d73a4a",
						"description": "Something is not working",
						"default":     true,
					},
				},
			},
		})
	}))
	defer restServer.Close()

	graphqlRequests := 0
	graphqlServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		graphqlRequests++
		if r.Method != http.MethodPost {
			t.Fatalf("GraphQL method = %q, want POST", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer user-token" {
			t.Fatalf("Authorization = %q, want user token", r.Header.Get("Authorization"))
		}
		var request githubapi.GraphQLRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatalf("decode GraphQL request: %v", err)
		}
		variables, ok := request.Variables.(map[string]any)
		if !ok {
			t.Fatalf("variables type = %T, want map[string]any", request.Variables)
		}
		if variables["owner"] != "octo" || variables["name"] != "repo" {
			t.Fatalf("variables owner/name = %v/%v, want octo/repo", variables["owner"], variables["name"])
		}
		if variables["first"] != float64(1) || variables["reviewsFirst"] != float64(10) {
			t.Fatalf("variables first/reviewsFirst = %v/%v, want 1/10", variables["first"], variables["reviewsFirst"])
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"repository": map[string]any{
					"pullRequests": map[string]any{
						"nodes": []map[string]any{
							{
								"databaseId":   7007,
								"number":       7,
								"title":        "Fix parser panic",
								"state":        "MERGED",
								"isDraft":      false,
								"merged":       true,
								"mergedAt":     "2026-05-01T12:00:00Z",
								"createdAt":    "2026-04-30T12:00:00Z",
								"updatedAt":    "2026-05-01T12:01:00Z",
								"closedAt":     "2026-05-01T12:00:00Z",
								"changedFiles": 3,
								"additions":    40,
								"deletions":    5,
								"commits":      map[string]any{"totalCount": 2},
								"author":       map[string]any{"login": "alice"},
								"baseRefName":  "main",
								"headRefName":  "fix-parser",
								"labels":       map[string]any{"nodes": []map[string]any{{"name": "bug", "color": "d73a4a", "description": "Something is not working", "isDefault": true}}},
								"reviews": map[string]any{
									"nodes": []map[string]any{
										{
											"databaseId":        701,
											"state":             "APPROVED",
											"submittedAt":       "2026-05-01T11:30:00Z",
											"body":              "Looks good",
											"author":            map[string]any{"login": "bob"},
											"authorAssociation": "MEMBER",
										},
									},
								},
							},
						},
					},
				},
			},
		})
	}))
	defer graphqlServer.Close()

	restClient, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          restServer.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       restServer.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			GraphQLURL:             graphqlServer.URL,
			APIVersion:             "2026-03-10",
			UserAgent:              "GitRank/test",
			RequestTimeout:         time.Second,
			MaxPageSize:            50,
			GraphQLPageSize:        20,
			RepositorySyncPageSize: 10,
			SecondaryBackoff:       time.Millisecond,
			MaxConcurrency:         1,
		},
	}, nil, restClient)
	executor.graphqlTokenSource = func(context.Context, SyncRequestActor, time.Time) (githubapi.TokenSource, bool, error) {
		return githubapi.StaticTokenSource("user-token"), true, nil
	}
	executor.graphqlClientFactory = func(tokenSource githubapi.TokenSource) (*githubapi.GraphQLClient, error) {
		return githubapi.NewGraphQLClient(githubapi.ClientConfig{
			BaseURL:          graphqlServer.URL,
			APIVersion:       "2026-03-10",
			UserAgent:        "GitRank/test",
			TokenSource:      tokenSource,
			HTTPClient:       graphqlServer.Client(),
			SecondaryBackoff: time.Millisecond,
			MaxConcurrency:   1,
		})
	}

	pullRequests, reviewsByNumber, err := executor.fetchPullRequests(context.Background(), "octo", "repo", SyncRequestActor{GitHubLogin: "alice"})
	if err != nil {
		t.Fatalf("fetchPullRequests() error = %v", err)
	}
	if restRequests["/repos/octo/repo/pulls"] != 1 {
		t.Fatalf("REST list requests = %d, want 1", restRequests["/repos/octo/repo/pulls"])
	}
	if graphqlRequests != 1 {
		t.Fatalf("GraphQL requests = %d, want 1", graphqlRequests)
	}
	if len(pullRequests) != 1 {
		t.Fatalf("pullRequests len = %d, want 1", len(pullRequests))
	}
	pr := pullRequests[0]
	if intValue(pr["changed_files"]) != 3 || intValue(pr["commits"]) != 2 {
		t.Fatalf("batched PR metrics = changed_files %v commits %v, want 3/2", pr["changed_files"], pr["commits"])
	}
	if state := stringValue(pr["state"]); state != "closed" {
		t.Fatalf("state = %q, want REST-compatible closed", state)
	}
	if userID := intValue(object(pr["user"])["id"]); userID != 1001 {
		t.Fatalf("merged user id = %d, want REST summary user id", userID)
	}
	if labels := objectArray(pr["labels"]); len(labels) != 1 || intValue(labels[0]["id"]) != 9901 {
		t.Fatalf("merged labels = %#v, want REST summary label with numeric GitHub ID", labels)
	}
	reviews := reviewsByNumber[7]
	if len(reviews) != 1 {
		t.Fatalf("reviews len = %d, want 1", len(reviews))
	}
	if int64Value(reviews[0]["id"]) != 701 || stringValue(object(reviews[0]["user"])["login"]) != "bob" {
		t.Fatalf("review = %#v, want GraphQL review mapped to REST shape", reviews[0])
	}
}

func TestExecutorFetchPullRequestsFallsBackToRESTWhenGraphQLFails(t *testing.T) {
	t.Parallel()

	restRequests := map[string]int{}
	restServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		restRequests[r.URL.Path]++
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/repos/octo/repo/pulls":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"number": 7},
			})
		case "/repos/octo/repo/pulls/7":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            201,
				"number":        7,
				"title":         "fix: graphql fallback",
				"state":         "closed",
				"draft":         false,
				"merged_at":     "2026-05-01T12:00:00Z",
				"created_at":    "2026-04-30T12:00:00Z",
				"updated_at":    "2026-05-01T12:00:00Z",
				"closed_at":     "2026-05-01T12:00:00Z",
				"changed_files": 2,
				"additions":     14,
				"deletions":     4,
				"commits":       1,
				"user": map[string]any{
					"id":    1001,
					"login": "alice",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "fix-graphql-fallback"},
			})
		case "/repos/octo/repo/pulls/7/reviews":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":           701,
					"state":        "COMMENTED",
					"submitted_at": "2026-05-01T11:30:00Z",
					"body":         "fallback review",
					"user": map[string]any{
						"id":    2001,
						"login": "bob",
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer restServer.Close()

	graphqlRequests := 0
	graphqlServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		graphqlRequests++
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"errors": []map[string]any{
				{"message": "Field 'changedFilesIfAvailable' doesn't exist on type 'PullRequest'"},
			},
		})
	}))
	defer graphqlServer.Close()

	restClient, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          restServer.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       restServer.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			GraphQLURL:       graphqlServer.URL,
			APIVersion:       "2026-03-10",
			UserAgent:        "GitRank/test",
			RequestTimeout:   time.Second,
			MaxPageSize:      50,
			GraphQLPageSize:  20,
			SecondaryBackoff: time.Millisecond,
			MaxConcurrency:   1,
		},
	}, nil, restClient)
	executor.graphqlTokenSource = func(context.Context, SyncRequestActor, time.Time) (githubapi.TokenSource, bool, error) {
		return githubapi.StaticTokenSource("user-token"), true, nil
	}
	executor.graphqlClientFactory = func(tokenSource githubapi.TokenSource) (*githubapi.GraphQLClient, error) {
		return githubapi.NewGraphQLClient(githubapi.ClientConfig{
			BaseURL:          graphqlServer.URL,
			APIVersion:       "2026-03-10",
			UserAgent:        "GitRank/test",
			TokenSource:      tokenSource,
			HTTPClient:       graphqlServer.Client(),
			SecondaryBackoff: time.Millisecond,
			MaxConcurrency:   1,
		})
	}

	pullRequests, reviewsByNumber, err := executor.fetchPullRequests(context.Background(), "octo", "repo", SyncRequestActor{GitHubLogin: "alice"})
	if err != nil {
		t.Fatalf("fetchPullRequests() error = %v", err)
	}
	if graphqlRequests != 1 {
		t.Fatalf("GraphQL requests = %d, want 1", graphqlRequests)
	}
	if restRequests["/repos/octo/repo/pulls/7"] != 1 {
		t.Fatalf("REST details requests = %d, want 1", restRequests["/repos/octo/repo/pulls/7"])
	}
	if len(pullRequests) != 1 {
		t.Fatalf("pullRequests len = %d, want 1", len(pullRequests))
	}
	if intValue(pullRequests[0]["changed_files"]) != 2 {
		t.Fatalf("changed_files = %v, want 2 from REST fallback", pullRequests[0]["changed_files"])
	}
	if len(reviewsByNumber[7]) != 1 {
		t.Fatalf("reviewsByNumber[7] len = %d, want 1", len(reviewsByNumber[7]))
	}
}

func TestExecutorFetchPullRequestsRESTSkipsSkippableReviewErrors(t *testing.T) {
	t.Parallel()

	restRequests := map[string]int{}
	restServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		restRequests[r.URL.Path]++
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/repos/octo/repo/pulls":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"number": 7},
			})
		case "/repos/octo/repo/pulls/7":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            201,
				"number":        7,
				"title":         "fix: keep sync alive",
				"state":         "closed",
				"draft":         false,
				"merged_at":     "2026-05-01T12:00:00Z",
				"created_at":    "2026-04-30T12:00:00Z",
				"updated_at":    "2026-05-01T12:00:00Z",
				"closed_at":     "2026-05-01T12:00:00Z",
				"changed_files": 2,
				"additions":     14,
				"deletions":     4,
				"commits":       1,
				"user": map[string]any{
					"id":    1001,
					"login": "alice",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "fix-sync"},
			})
		case "/repos/octo/repo/pulls/7/reviews":
			http.NotFound(w, r)
		default:
			http.NotFound(w, r)
		}
	}))
	defer restServer.Close()

	restClient, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          restServer.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       restServer.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			APIVersion:       "2026-03-10",
			UserAgent:        "GitRank/test",
			RequestTimeout:   time.Second,
			MaxPageSize:      50,
			GraphQLPageSize:  20,
			SecondaryBackoff: time.Millisecond,
			MaxConcurrency:   1,
		},
	}, nil, restClient)
	executor.graphqlTokenSource = nil
	executor.graphqlClientFactory = nil

	pullRequests, reviewsByNumber, err := executor.fetchPullRequests(context.Background(), "octo", "repo", SyncRequestActor{})
	if err != nil {
		t.Fatalf("fetchPullRequests() error = %v", err)
	}
	if restRequests["/repos/octo/repo/pulls/7/reviews"] != 1 {
		t.Fatalf("REST review requests = %d, want 1", restRequests["/repos/octo/repo/pulls/7/reviews"])
	}
	if len(pullRequests) != 1 {
		t.Fatalf("pullRequests len = %d, want 1", len(pullRequests))
	}
	if intValue(pullRequests[0]["number"]) != 7 {
		t.Fatalf("pull request number = %v, want 7", pullRequests[0]["number"])
	}
	reviews, ok := reviewsByNumber[7]
	if !ok {
		t.Fatalf("reviewsByNumber missing key 7")
	}
	if len(reviews) != 0 {
		t.Fatalf("reviewsByNumber[7] len = %d, want 0 after skippable review error", len(reviews))
	}
}

func TestExecutorFetchPullRequestsRESTSkipsNonSkippableReviewErrors(t *testing.T) {
	t.Parallel()

	restRequests := map[string]int{}
	restServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		restRequests[r.URL.Path]++
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/repos/octo/repo/pulls":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"number": 7},
			})
		case "/repos/octo/repo/pulls/7":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            201,
				"number":        7,
				"title":         "fix: survive review endpoint instability",
				"state":         "closed",
				"draft":         false,
				"merged_at":     "2026-05-01T12:00:00Z",
				"created_at":    "2026-04-30T12:00:00Z",
				"updated_at":    "2026-05-01T12:00:00Z",
				"closed_at":     "2026-05-01T12:00:00Z",
				"changed_files": 2,
				"additions":     14,
				"deletions":     4,
				"commits":       1,
				"user": map[string]any{
					"id":    1001,
					"login": "alice",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "fix-sync"},
			})
		case "/repos/octo/repo/pulls/7/reviews":
			http.Error(w, `{"message":"upstream failure"}`, http.StatusInternalServerError)
		default:
			http.NotFound(w, r)
		}
	}))
	defer restServer.Close()

	restClient, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          restServer.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       restServer.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			APIVersion:       "2026-03-10",
			UserAgent:        "GitRank/test",
			RequestTimeout:   time.Second,
			MaxPageSize:      50,
			GraphQLPageSize:  20,
			SecondaryBackoff: time.Millisecond,
			MaxConcurrency:   1,
		},
	}, nil, restClient)
	executor.graphqlTokenSource = nil
	executor.graphqlClientFactory = nil

	pullRequests, reviewsByNumber, err := executor.fetchPullRequests(context.Background(), "octo", "repo", SyncRequestActor{})
	if err != nil {
		t.Fatalf("fetchPullRequests() error = %v", err)
	}
	if restRequests["/repos/octo/repo/pulls/7/reviews"] != 3 {
		t.Fatalf("REST review requests = %d, want 3 retry attempts", restRequests["/repos/octo/repo/pulls/7/reviews"])
	}
	if len(pullRequests) != 1 {
		t.Fatalf("pullRequests len = %d, want 1", len(pullRequests))
	}
	reviews, ok := reviewsByNumber[7]
	if !ok {
		t.Fatalf("reviewsByNumber missing key 7")
	}
	if len(reviews) != 0 {
		t.Fatalf("reviewsByNumber[7] len = %d, want 0 after non-skippable review error", len(reviews))
	}
}

func TestExecutorFetchPullRequestsRESTSkipsSkippablePullRequestDetailErrors(t *testing.T) {
	t.Parallel()

	restRequests := map[string]int{}
	restServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		restRequests[r.URL.Path]++
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/repos/octo/repo/pulls":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"number": 7},
				{"number": 8},
			})
		case "/repos/octo/repo/pulls/7":
			http.NotFound(w, r)
		case "/repos/octo/repo/pulls/8":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":            202,
				"number":        8,
				"title":         "feat: keep partial sync",
				"state":         "closed",
				"draft":         false,
				"merged_at":     "2026-05-02T12:00:00Z",
				"created_at":    "2026-05-01T12:00:00Z",
				"updated_at":    "2026-05-02T12:00:00Z",
				"closed_at":     "2026-05-02T12:00:00Z",
				"changed_files": 3,
				"additions":     20,
				"deletions":     5,
				"commits":       2,
				"user": map[string]any{
					"id":    1002,
					"login": "alice",
				},
				"base": map[string]any{"ref": "main"},
				"head": map[string]any{"ref": "keep-sync"},
			})
		case "/repos/octo/repo/pulls/8/reviews":
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id": 4001,
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer restServer.Close()

	restClient, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:          restServer.URL,
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		HTTPClient:       restServer.Client(),
		SecondaryBackoff: time.Millisecond,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	executor := NewExecutor(config.App{
		GitHub: config.GitHub{
			APIVersion:       "2026-03-10",
			UserAgent:        "GitRank/test",
			RequestTimeout:   time.Second,
			MaxPageSize:      50,
			GraphQLPageSize:  20,
			SecondaryBackoff: time.Millisecond,
			MaxConcurrency:   1,
		},
	}, nil, restClient)
	executor.graphqlTokenSource = nil
	executor.graphqlClientFactory = nil

	pullRequests, reviewsByNumber, err := executor.fetchPullRequests(context.Background(), "octo", "repo", SyncRequestActor{})
	if err != nil {
		t.Fatalf("fetchPullRequests() error = %v", err)
	}
	if len(pullRequests) != 1 {
		t.Fatalf("pullRequests len = %d, want 1 after skippable detail error", len(pullRequests))
	}
	if intValue(pullRequests[0]["number"]) != 8 {
		t.Fatalf("pull request number = %v, want 8", pullRequests[0]["number"])
	}
	if restRequests["/repos/octo/repo/pulls/7/reviews"] != 0 {
		t.Fatalf("REST review requests for skipped detail = %d, want 0", restRequests["/repos/octo/repo/pulls/7/reviews"])
	}
	skipped, ok := reviewsByNumber[7]
	if !ok {
		t.Fatalf("reviewsByNumber missing key 7 for skipped detail path")
	}
	if len(skipped) != 0 {
		t.Fatalf("reviewsByNumber[7] len = %d, want 0 for skipped detail path", len(skipped))
	}
	if len(reviewsByNumber[8]) != 1 {
		t.Fatalf("reviewsByNumber[8] len = %d, want 1", len(reviewsByNumber[8]))
	}
}
