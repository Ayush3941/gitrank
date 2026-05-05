package httpapi

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
)

func TestWebhookAcceptedAndDeduplicated(t *testing.T) {
	router := NewRouter(testConfig(), testLogger(), "test")
	payload := []byte(`{"action":"opened","repository":{"id":99,"full_name":"octo/repo"},"installation":{"id":12},"pull_request":{"number":7,"head":{"sha":"abc123"}}}`)

	first := signedWebhookRequest(payload)
	firstResponse := httptest.NewRecorder()
	router.ServeHTTP(firstResponse, first)

	if firstResponse.Code != http.StatusAccepted {
		t.Fatalf("first status = %d, want %d, body=%s", firstResponse.Code, http.StatusAccepted, firstResponse.Body.String())
	}

	var accepted contracts.GitHubWebhookReceipt
	if err := json.Unmarshal(firstResponse.Body.Bytes(), &accepted); err != nil {
		t.Fatalf("unmarshal first response: %v", err)
	}
	if accepted.Deduplicated {
		t.Fatal("first delivery should not be deduplicated")
	}
	if !accepted.SignatureOK || !accepted.ReplayProtected {
		t.Fatalf("unexpected receipt flags: %+v", accepted)
	}
	if accepted.DeliveryStatus != "enqueued" {
		t.Fatalf("delivery status = %q, want %q", accepted.DeliveryStatus, "enqueued")
	}
	if len(accepted.JobIDs) != 1 {
		t.Fatalf("job ids len = %d, want 1", len(accepted.JobIDs))
	}

	second := signedWebhookRequest(payload)
	secondResponse := httptest.NewRecorder()
	router.ServeHTTP(secondResponse, second)

	if secondResponse.Code != http.StatusAccepted {
		t.Fatalf("second status = %d, want %d, body=%s", secondResponse.Code, http.StatusAccepted, secondResponse.Body.String())
	}

	var duplicate contracts.GitHubWebhookReceipt
	if err := json.Unmarshal(secondResponse.Body.Bytes(), &duplicate); err != nil {
		t.Fatalf("unmarshal second response: %v", err)
	}
	if !duplicate.Deduplicated {
		t.Fatal("second delivery should be deduplicated")
	}
	if duplicate.DeliveryStatus != "duplicate" {
		t.Fatalf("delivery status = %q, want %q", duplicate.DeliveryStatus, "duplicate")
	}
	if len(duplicate.JobIDs) != 0 {
		t.Fatalf("duplicate job ids len = %d, want 0", len(duplicate.JobIDs))
	}
}

func TestWebhookRejectsInvalidSignature(t *testing.T) {
	router := NewRouter(testConfig(), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/webhooks/github", bytes.NewReader([]byte(`{"action":"opened"}`)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-GitHub-Delivery", "delivery-1")
	request.Header.Set("X-GitHub-Event", "pull_request")
	request.Header.Set("X-Hub-Signature-256", "sha256=invalid")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusUnauthorized, response.Body.String())
	}

	var out contracts.ErrorResponse
	if err := json.Unmarshal(response.Body.Bytes(), &out); err != nil {
		t.Fatalf("unmarshal error response: %v", err)
	}
	if out.Error.Code != "invalid_signature" {
		t.Fatalf("error code = %q, want %q", out.Error.Code, "invalid_signature")
	}
}

func TestWebhookRejectsOversizedPayload(t *testing.T) {
	cfg := testConfig()
	cfg.GitHub.MaxBodyBytes = 8
	router := NewRouter(cfg, testLogger(), "test")
	payload := []byte(`{"action":"opened"}`)
	request := signedWebhookRequest(payload)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusRequestEntityTooLarge, response.Body.String())
	}
}

func TestSyncPreviewRejectsUnknownFields(t *testing.T) {
	router := NewRouter(testConfig(), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/sync/preview", bytes.NewReader([]byte(`{"mode":"user","user":"octocat","unexpected":true}`)))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusBadRequest, response.Body.String())
	}

	var out contracts.ErrorResponse
	if err := json.Unmarshal(response.Body.Bytes(), &out); err != nil {
		t.Fatalf("unmarshal error response: %v", err)
	}
	if out.Error.Code != "invalid_json" {
		t.Fatalf("error code = %q, want %q", out.Error.Code, "invalid_json")
	}
}

func TestSyncCommitRouteAccepts(t *testing.T) {
	router := NewRouter(testConfig(), testLogger(), "test")
	request := httptest.NewRequest(http.MethodPost, "/v1/sync/commit", bytes.NewReader([]byte(`{"repository":"octo/repo","sha":"abc123"}`)))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, http.StatusAccepted, response.Body.String())
	}

	var out contracts.GitHubQueuePreview
	if err := json.Unmarshal(response.Body.Bytes(), &out); err != nil {
		t.Fatalf("unmarshal sync response: %v", err)
	}
	if out.Status != "queued" {
		t.Fatalf("status = %q, want %q", out.Status, "queued")
	}
	if len(out.JobTypes) != 1 || out.JobTypes[0] != "sync.commit" {
		t.Fatalf("job types = %v, want [sync.commit]", out.JobTypes)
	}
	if len(out.JobIDs) != 1 {
		t.Fatalf("job ids len = %d, want 1", len(out.JobIDs))
	}
}

func testConfig() config.App {
	return config.App{
		ServiceName: "github-ingestor",
		Env:         config.Development,
		Addr:        ":8082",
		Log: config.Log{
			Level:  "info",
			Format: "text",
		},
		ShutdownTimeout: time.Second,
		GitHub: config.GitHub{
			WebhookSecret:  "webhook-secret",
			MaxBodyBytes:   1 << 20,
			DedupeTTL:      time.Hour,
			RequestTimeout: time.Second,
		},
		Scheduler: config.Scheduler{
			MaxAttempts: 3,
		},
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func signedWebhookRequest(payload []byte) *http.Request {
	request := httptest.NewRequest(http.MethodPost, "/webhooks/github", bytes.NewReader(payload))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-GitHub-Delivery", "delivery-1")
	request.Header.Set("X-GitHub-Event", "pull_request")
	request.Header.Set("X-Hub-Signature-256", signPayload("webhook-secret", payload))
	return request
}

func signPayload(secret string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}
