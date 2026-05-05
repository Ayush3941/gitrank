package service

import (
	"bytes"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/githubapi"
)

func TestNormalizeReturnToDefaults(t *testing.T) {
	svc := testServiceForReturnTo()

	if got := svc.normalizeReturnTo("", intentLogin); got != "https://app.gitrank.dev/dashboard" {
		t.Fatalf("login default = %q, want %q", got, "https://app.gitrank.dev/dashboard")
	}
	if got := svc.normalizeReturnTo("", intentLink); got != "https://app.gitrank.dev/dashboard/settings" {
		t.Fatalf("link default = %q, want %q", got, "https://app.gitrank.dev/dashboard/settings")
	}
}

func TestNormalizeReturnToPreservesSameOriginPathsAndQueries(t *testing.T) {
	svc := testServiceForReturnTo()

	got := svc.normalizeReturnTo("/dashboard/settings?tab=privacy", intentLink)
	want := "https://app.gitrank.dev/dashboard/settings?tab=privacy"
	if got != want {
		t.Fatalf("relative return_to = %q, want %q", got, want)
	}

	got = svc.normalizeReturnTo("https://app.gitrank.dev/u/octocat?view=card#hero", intentLogin)
	want = "https://app.gitrank.dev/u/octocat?view=card"
	if got != want {
		t.Fatalf("absolute return_to = %q, want %q", got, want)
	}
}

func TestNormalizeReturnToRejectsExternalOrigins(t *testing.T) {
	svc := testServiceForReturnTo()

	cases := []string{
		"https://evil.example/phish",
		"http://app.gitrank.dev/dashboard",
		"javascript:alert(1)",
		"//evil.example/path",
		"dashboard/settings",
	}

	for _, raw := range cases {
		if got := svc.normalizeReturnTo(raw, intentLogin); got != "https://app.gitrank.dev/dashboard" {
			t.Fatalf("return_to %q normalized to %q", raw, got)
		}
	}
}

func testServiceForReturnTo() *Service {
	return &Service{
		cfg: config.App{
			PublicBaseURL: "https://app.gitrank.dev",
		},
	}
}

func TestGitHubRateLimitMetricsWritePrometheus(t *testing.T) {
	svc := &Service{
		cfg:           config.App{ServiceName: "auth-service"},
		githubMetrics: newGitHubRateLimitMetrics("auth-service"),
	}
	resetAt := time.Unix(1770000000, 0).UTC()
	svc.observeGitHubRateLimit(githubapi.ResponseMetadata{
		RateLimit: githubapi.RateLimitStatus{
			Limit:     5000,
			Remaining: 4999,
			Used:      1,
			ResetAt:   resetAt,
			Resource:  "core",
		},
	})

	var out bytes.Buffer
	svc.MetricsSource().WritePrometheus(&out)
	text := out.String()

	for _, fragment := range []string{
		`gitrank_github_rate_limit_limit{service="auth-service",resource="core"} 5000`,
		`gitrank_github_rate_limit_remaining{service="auth-service",resource="core"} 4999`,
		`gitrank_github_rate_limit_used{service="auth-service",resource="core"} 1`,
		`gitrank_github_rate_limit_reset_at_unix{service="auth-service",resource="core"} 1770000000`,
		`gitrank_github_rate_limit_observations_total{service="auth-service",resource="core"} 1`,
	} {
		if !bytes.Contains(out.Bytes(), []byte(fragment)) {
			t.Fatalf("metrics output missing %q: %s", fragment, text)
		}
	}
}
