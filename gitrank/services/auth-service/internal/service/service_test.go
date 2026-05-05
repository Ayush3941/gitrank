package service

import (
	"testing"

	"github.com/Ayush3941/gitrank/packages/config"
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
