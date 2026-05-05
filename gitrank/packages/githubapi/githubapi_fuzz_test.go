package githubapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"testing"
)

func FuzzVerifyWebhookSignature(f *testing.F) {
	f.Add("secret", []byte(`{"action":"opened"}`))
	f.Add("another-secret", []byte(`{"after":"abc123"}`))
	f.Add("tiny", []byte(`{}`))

	f.Fuzz(func(t *testing.T, secret string, body []byte) {
		if secret == "" {
			if err := VerifyWebhookSignature(secret, body, "sha256=deadbeef"); err == nil {
				t.Fatal("expected error for empty secret")
			}
			return
		}

		mac := hmac.New(sha256.New, []byte(secret))
		_, _ = mac.Write(body)
		validSignature := "sha256=" + hex.EncodeToString(mac.Sum(nil))

		if err := VerifyWebhookSignature(secret, body, validSignature); err != nil {
			t.Fatalf("valid signature rejected: %v", err)
		}

		invalidSignature := validSignature
		if len(invalidSignature) > len("sha256=") {
			last := invalidSignature[len(invalidSignature)-1]
			if last == '0' {
				last = '1'
			} else {
				last = '0'
			}
			invalidSignature = invalidSignature[:len(invalidSignature)-1] + string(last)
		}
		if err := VerifyWebhookSignature(secret, body, invalidSignature); err == nil {
			t.Fatal("expected invalid signature to be rejected")
		}
		if err := VerifyWebhookSignature(secret, body, "sha1=deadbeef"); err == nil {
			t.Fatal("expected unsupported format to be rejected")
		}
	})
}

func FuzzParseWebhookEnvelope(f *testing.F) {
	f.Add(
		"delivery-1",
		"pull_request",
		"sha256=sig",
		[]byte(`{"action":"opened","repository":{"id":99,"full_name":"octo/repo"},"installation":{"id":12},"pull_request":{"number":7,"head":{"sha":"abc123"}},"review":{"id":44}}`),
	)
	f.Add("delivery-2", "push", "sha256=other", []byte(`{"after":"def456","repository":{"full_name":"octo/repo"}}`))
	f.Add("delivery-3", "issues", "sha256=third", []byte(`{"issue":{"number":5}}`))

	f.Fuzz(func(t *testing.T, deliveryID, eventType, signature string, body []byte) {
		headers := http.Header{}
		headers.Set("X-GitHub-Delivery", deliveryID)
		headers.Set("X-GitHub-Event", eventType)
		headers.Set("X-Hub-Signature-256", signature)

		envelope, err := ParseWebhookEnvelope(headers, body)
		if deliveryID == "" || eventType == "" {
			if err == nil {
				t.Fatal("expected missing header error")
			}
			return
		}
		if !jsonValid(body) {
			if err == nil {
				t.Fatal("expected invalid JSON to be rejected")
			}
			return
		}
		if err != nil {
			t.Fatalf("valid JSON payload rejected: %v", err)
		}
		if envelope.DeliveryID != deliveryID {
			t.Fatalf("delivery id = %q, want %q", envelope.DeliveryID, deliveryID)
		}
		if envelope.EventType != eventType {
			t.Fatalf("event type = %q, want %q", envelope.EventType, eventType)
		}
		if string(envelope.Payload) != string(body) {
			t.Fatal("payload body changed during parsing")
		}
	})
}

func jsonValid(body []byte) bool {
	return json.Valid(body)
}
