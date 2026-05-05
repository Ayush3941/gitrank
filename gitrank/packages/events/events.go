package events

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"
)

const SchemaVersion = 1

const (
	GitHubSyncRequested         = "github.sync.requested"
	GitHubPullRequestIngested   = "github.pull_request.ingested"
	ContributionAnalysisDone    = "analysis.contribution.completed"
	ContributionScoreCalculated = "scoring.contribution.completed"
	ProfileSnapshotRefreshed    = "profile.snapshot.refreshed"
)

type Envelope struct {
	ID            string          `json:"id"`
	Type          string          `json:"type"`
	Version       int             `json:"version"`
	Source        string          `json:"source"`
	CorrelationID string          `json:"correlation_id,omitempty"`
	OccurredAt    time.Time       `json:"occurred_at"`
	Payload       json.RawMessage `json:"payload"`
}

type Handler func(context.Context, Envelope) error

type Publisher interface {
	Publish(context.Context, Envelope) error
}

type Subscriber interface {
	Subscribe(context.Context, Handler) error
}

func New[T any](eventType, source, correlationID string, payload T) (Envelope, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return Envelope{}, err
	}

	return Envelope{
		ID:            newID(),
		Type:          eventType,
		Version:       SchemaVersion,
		Source:        source,
		CorrelationID: correlationID,
		OccurredAt:    time.Now().UTC(),
		Payload:       payloadBytes,
	}, nil
}

func (e Envelope) Validate() error {
	switch {
	case e.ID == "":
		return errors.New("event ID is required")
	case e.Type == "":
		return errors.New("event type is required")
	case e.Source == "":
		return errors.New("event source is required")
	case e.Version <= 0:
		return errors.New("event version must be positive")
	case e.OccurredAt.IsZero():
		return errors.New("event time is required")
	case len(e.Payload) == 0:
		return errors.New("event payload is required")
	default:
		return nil
	}
}

func newID() string {
	var bytes [16]byte
	_, _ = rand.Read(bytes[:])
	return hex.EncodeToString(bytes[:])
}
