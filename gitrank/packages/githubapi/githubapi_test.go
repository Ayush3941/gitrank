package githubapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"testing"
)

func TestBuildAuthorizeURL(t *testing.T) {
	url, err := BuildAuthorizeURL(OAuthConfig{
		AuthorizeURL: "https://github.com/login/oauth/authorize",
		ClientID:     "client",
		RedirectURL:  "https://example.com/callback",
		Scopes:       []string{"read:user", "user:email"},
		AllowSignup:  true,
	}, "state-1")
	if err != nil {
		t.Fatalf("BuildAuthorizeURL() error = %v", err)
	}
	if url == "" {
		t.Fatal("BuildAuthorizeURL() returned empty URL")
	}
}

func TestVerifyWebhookSignature(t *testing.T) {
	body := []byte(`{"action":"opened"}`)
	mac := hmac.New(sha256.New, []byte("secret"))
	_, _ = mac.Write(body)
	signature := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if err := VerifyWebhookSignature("secret", body, signature); err != nil {
		t.Fatalf("VerifyWebhookSignature() error = %v", err)
	}
}

func TestParseWebhookEnvelope(t *testing.T) {
	headers := http.Header{}
	headers.Set("X-GitHub-Delivery", "delivery-1")
	headers.Set("X-GitHub-Event", "pull_request")
	headers.Set("X-Hub-Signature-256", "sha256=sig")

	env, err := ParseWebhookEnvelope(headers, []byte(`{"action":"opened","repository":{"id":99,"full_name":"octo/repo"},"installation":{"id":12},"pull_request":{"number":7,"head":{"sha":"abc123"}},"review":{"id":44}}`))
	if err != nil {
		t.Fatalf("ParseWebhookEnvelope() error = %v", err)
	}
	if env.Repository != "octo/repo" {
		t.Fatalf("Repository = %q, want octo/repo", env.Repository)
	}
	if env.RepositoryID != 99 {
		t.Fatalf("RepositoryID = %d, want 99", env.RepositoryID)
	}
	if env.Number != 7 {
		t.Fatalf("Number = %d, want 7", env.Number)
	}
	if env.ReviewID != 44 {
		t.Fatalf("ReviewID = %d, want 44", env.ReviewID)
	}
	if env.CommitSHA != "abc123" {
		t.Fatalf("CommitSHA = %q, want abc123", env.CommitSHA)
	}
}
