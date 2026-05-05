package githubapi

import "testing"

func TestPrimaryVerifiedEmail(t *testing.T) {
	emails := []UserEmail{
		{Email: "secondary@example.com", Verified: true},
		{Email: "primary@example.com", Primary: true, Verified: true},
	}

	got := PrimaryVerifiedEmail(emails)
	if got != "primary@example.com" {
		t.Fatalf("PrimaryVerifiedEmail() = %q, want primary@example.com", got)
	}
}
