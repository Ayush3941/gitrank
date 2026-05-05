package githubapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

type OAuthConfig struct {
	AuthorizeURL string
	ClientID     string
	RedirectURL  string
	Scopes       []string
	AllowSignup  bool
}

type WebhookEnvelope struct {
	DeliveryID   string          `json:"delivery_id"`
	EventType    string          `json:"event_type"`
	Signature    string          `json:"signature"`
	Action       string          `json:"action,omitempty"`
	Repository   string          `json:"repository,omitempty"`
	RepositoryID int64           `json:"repository_id,omitempty"`
	Installation int64           `json:"installation,omitempty"`
	Number       int             `json:"number,omitempty"`
	ReviewID     int64           `json:"review_id,omitempty"`
	CommitSHA    string          `json:"commit_sha,omitempty"`
	Payload      json.RawMessage `json:"payload"`
}

func BuildAuthorizeURL(cfg OAuthConfig, state string) (string, error) {
	if cfg.AuthorizeURL == "" {
		return "", errors.New("authorize URL is required")
	}
	if cfg.ClientID == "" {
		return "", errors.New("client ID is required")
	}
	if cfg.RedirectURL == "" {
		return "", errors.New("redirect URL is required")
	}
	if state == "" {
		return "", errors.New("state is required")
	}

	parsed, err := url.Parse(cfg.AuthorizeURL)
	if err != nil {
		return "", err
	}

	query := parsed.Query()
	query.Set("client_id", cfg.ClientID)
	query.Set("redirect_uri", cfg.RedirectURL)
	query.Set("state", state)
	if len(cfg.Scopes) > 0 {
		query.Set("scope", strings.Join(cfg.Scopes, " "))
	}
	if cfg.AllowSignup {
		query.Set("allow_signup", "true")
	}

	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func VerifyWebhookSignature(secret string, body []byte, signature string) error {
	if secret == "" {
		return errors.New("webhook secret is required")
	}
	if !strings.HasPrefix(signature, "sha256=") {
		return errors.New("unsupported GitHub signature format")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return errors.New("invalid GitHub webhook signature")
	}
	return nil
}

func ParseWebhookEnvelope(headers http.Header, body []byte) (WebhookEnvelope, error) {
	envelope := WebhookEnvelope{
		DeliveryID: headers.Get("X-GitHub-Delivery"),
		EventType:  headers.Get("X-GitHub-Event"),
		Signature:  headers.Get("X-Hub-Signature-256"),
		Payload:    json.RawMessage(body),
	}

	if envelope.DeliveryID == "" {
		return envelope, errors.New("missing X-GitHub-Delivery header")
	}
	if envelope.EventType == "" {
		return envelope, errors.New("missing X-GitHub-Event header")
	}
	if !json.Valid(body) {
		return envelope, errors.New("webhook payload must be valid JSON")
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return envelope, err
	}

	if action, ok := payload["action"].(string); ok {
		envelope.Action = action
	}

	if repository, ok := payload["repository"].(map[string]any); ok {
		if fullName, ok := repository["full_name"].(string); ok {
			envelope.Repository = fullName
		}
		switch value := repository["id"].(type) {
		case float64:
			envelope.RepositoryID = int64(value)
		case int64:
			envelope.RepositoryID = value
		}
	}

	if installation, ok := payload["installation"].(map[string]any); ok {
		switch value := installation["id"].(type) {
		case float64:
			envelope.Installation = int64(value)
		case int64:
			envelope.Installation = value
		}
	}
	if pullRequest, ok := payload["pull_request"].(map[string]any); ok {
		switch value := pullRequest["number"].(type) {
		case float64:
			envelope.Number = int(value)
		case int:
			envelope.Number = value
		}
		if head, ok := pullRequest["head"].(map[string]any); ok {
			if sha, ok := head["sha"].(string); ok {
				envelope.CommitSHA = sha
			}
		}
	}
	if issue, ok := payload["issue"].(map[string]any); ok && envelope.Number == 0 {
		switch value := issue["number"].(type) {
		case float64:
			envelope.Number = int(value)
		case int:
			envelope.Number = value
		}
	}
	if review, ok := payload["review"].(map[string]any); ok {
		switch value := review["id"].(type) {
		case float64:
			envelope.ReviewID = int64(value)
		case int64:
			envelope.ReviewID = value
		}
	}
	if envelope.CommitSHA == "" {
		if after, ok := payload["after"].(string); ok {
			envelope.CommitSHA = after
		}
	}

	return envelope, nil
}

func RESTPath(path string) string {
	return strings.TrimRight(path, "/")
}

func GraphQLQuery(owner, name string, number int) string {
	return fmt.Sprintf(`query {
  repository(owner: %q, name: %q) {
    pullRequest(number: %d) {
      id
      number
      title
      state
      merged
    }
  }
}`, owner, name, number)
}
