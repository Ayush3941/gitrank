package store

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

type WebhookDeliveryStatus string

const (
	DeliveryReceived  WebhookDeliveryStatus = "received"
	DeliveryDuplicate WebhookDeliveryStatus = "duplicate"
	DeliveryEnqueued  WebhookDeliveryStatus = "enqueued"
	DeliveryProcessed WebhookDeliveryStatus = "processed"
	DeliveryFailed    WebhookDeliveryStatus = "failed"
)

type WebhookDelivery struct {
	DeliveryID     string                `json:"delivery_id"`
	EventType      string                `json:"event_type"`
	Action         string                `json:"action,omitempty"`
	Repository     string                `json:"repository,omitempty"`
	InstallationID int64                 `json:"installation_id,omitempty"`
	Signature      string                `json:"signature,omitempty"`
	PayloadSHA256  string                `json:"payload_sha256"`
	Payload        json.RawMessage       `json:"payload"`
	Status         WebhookDeliveryStatus `json:"status"`
	ReceivedAt     time.Time             `json:"received_at"`
	LastError      string                `json:"last_error,omitempty"`
}

type WebhookDeliveryInput struct {
	DeliveryID     string
	EventType      string
	Action         string
	Repository     string
	InstallationID int64
	Signature      string
	Payload        []byte
	ReceivedAt     time.Time
}

func NewWebhookDelivery(input WebhookDeliveryInput) (WebhookDelivery, error) {
	if strings.TrimSpace(input.DeliveryID) == "" {
		return WebhookDelivery{}, errors.New("delivery ID is required")
	}
	if strings.TrimSpace(input.EventType) == "" {
		return WebhookDelivery{}, errors.New("event type is required")
	}
	if !json.Valid(input.Payload) {
		return WebhookDelivery{}, errors.New("payload must be valid JSON")
	}

	receivedAt := input.ReceivedAt.UTC()
	if receivedAt.IsZero() {
		receivedAt = time.Now().UTC()
	}

	sum := sha256.Sum256(input.Payload)
	return WebhookDelivery{
		DeliveryID:     strings.TrimSpace(input.DeliveryID),
		EventType:      strings.TrimSpace(input.EventType),
		Action:         strings.TrimSpace(input.Action),
		Repository:     strings.TrimSpace(input.Repository),
		InstallationID: input.InstallationID,
		Signature:      strings.TrimSpace(input.Signature),
		PayloadSHA256:  hex.EncodeToString(sum[:]),
		Payload:        append(json.RawMessage(nil), input.Payload...),
		Status:         DeliveryReceived,
		ReceivedAt:     receivedAt,
	}, nil
}
