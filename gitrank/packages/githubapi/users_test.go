package githubapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

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

func TestUserAdapters(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/user":
			_ = json.NewEncoder(w).Encode(CurrentUser{
				ID:        7,
				Login:     "octocat",
				AvatarURL: "https://avatars.githubusercontent.com/u/1?v=4",
				Name:      "Octo Cat",
				Email:     "octocat@example.com",
				Type:      "User",
			})
		case "/user/emails":
			_ = json.NewEncoder(w).Encode([]UserEmail{
				{Email: "octocat@example.com", Primary: true, Verified: true},
			})
		default:
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
	}))
	defer server.Close()

	client, err := NewRESTClient(ClientConfig{
		BaseURL:          server.URL + "/",
		APIVersion:       "2026-03-10",
		UserAgent:        "GitRank/test",
		TokenSource:      StaticTokenSource("user-token"),
		HTTPClient:       server.Client(),
		SecondaryBackoff: time.Second,
		MaxConcurrency:   1,
	})
	if err != nil {
		t.Fatalf("NewRESTClient() error = %v", err)
	}

	user, _, err := GetCurrentUser(context.Background(), client)
	if err != nil {
		t.Fatalf("GetCurrentUser() error = %v", err)
	}
	if user.Login != "octocat" {
		t.Fatalf("login = %q, want octocat", user.Login)
	}

	emails, _, err := ListUserEmails(context.Background(), client)
	if err != nil {
		t.Fatalf("ListUserEmails() error = %v", err)
	}
	if len(emails) != 1 || emails[0].Email != "octocat@example.com" {
		t.Fatalf("emails = %+v, want primary email response", emails)
	}
}
