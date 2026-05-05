package store

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresDeliveryStoreIntegration(t *testing.T) {
	databaseURL := strings.TrimSpace(os.Getenv("GITRANK_STORE_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("GITRANK_STORE_DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New() error = %v", err)
	}
	defer pool.Close()

	suffix := time.Now().UTC().UnixNano()
	repositoryName := fmt.Sprintf("octo/repo-%d", suffix)
	installationID := int64(700000 + suffix%100000)
	repositoryID := suffix % 1000000

	_, err = pool.Exec(ctx, `
		INSERT INTO repositories (
			github_repository_id,
			owner_login,
			name,
			full_name
		) VALUES ($1, $2, $3, $4)
	`,
		repositoryID,
		"octo",
		fmt.Sprintf("repo-%d", suffix),
		repositoryName,
	)
	if err != nil {
		t.Fatalf("insert repository: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO github_installations (
			github_installation_id,
			account_login
		) VALUES ($1, $2)
	`,
		installationID,
		"octo-app",
	)
	if err != nil {
		t.Fatalf("insert installation: %v", err)
	}

	delivery, err := NewWebhookDelivery(WebhookDeliveryInput{
		DeliveryID:     fmt.Sprintf("delivery-%d", suffix),
		EventType:      "pull_request",
		Action:         "opened",
		Repository:     repositoryName,
		InstallationID: installationID,
		Signature:      "sha256=test-signature",
		Payload:        []byte(`{"action":"opened"}`),
		ReceivedAt:     time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("NewWebhookDelivery() error = %v", err)
	}

	store := NewPostgresDeliveryStore(pool, time.Second)
	duplicate, err := store.Remember(delivery)
	if err != nil {
		t.Fatalf("Remember() error = %v", err)
	}
	if duplicate {
		t.Fatal("first Remember() duplicate = true, want false")
	}

	loaded, found, err := store.Lookup(delivery.DeliveryID)
	if err != nil {
		t.Fatalf("Lookup() error = %v", err)
	}
	if !found {
		t.Fatal("Lookup() found = false, want true")
	}
	if loaded.Repository != repositoryName {
		t.Fatalf("repository = %q, want %q", loaded.Repository, repositoryName)
	}
	if loaded.InstallationID != installationID {
		t.Fatalf("installation id = %d, want %d", loaded.InstallationID, installationID)
	}
	if loaded.Status != DeliveryReceived {
		t.Fatalf("status = %q, want %q", loaded.Status, DeliveryReceived)
	}

	if err := store.MarkStatus(delivery.DeliveryID, DeliveryEnqueued, nil); err != nil {
		t.Fatalf("MarkStatus() error = %v", err)
	}

	updated, found, err := store.Lookup(delivery.DeliveryID)
	if err != nil {
		t.Fatalf("Lookup() after mark error = %v", err)
	}
	if !found {
		t.Fatal("Lookup() after mark found = false, want true")
	}
	if updated.Status != DeliveryEnqueued {
		t.Fatalf("status after mark = %q, want %q", updated.Status, DeliveryEnqueued)
	}

	duplicate, err = store.Remember(delivery)
	if err != nil {
		t.Fatalf("Remember() duplicate error = %v", err)
	}
	if !duplicate {
		t.Fatal("second Remember() duplicate = false, want true")
	}

	snapshot, err := store.Snapshot(time.Now().UTC())
	if err != nil {
		t.Fatalf("Snapshot() error = %v", err)
	}
	if snapshot.Total != 1 {
		t.Fatalf("snapshot total = %d, want 1", snapshot.Total)
	}
	if snapshot.Deduplicated != 1 {
		t.Fatalf("snapshot deduplicated = %d, want 1", snapshot.Deduplicated)
	}
	if snapshot.ReplayRecorded != 1 {
		t.Fatalf("snapshot replay recorded = %d, want 1", snapshot.ReplayRecorded)
	}
	if snapshot.ByStatus[DeliveryDuplicate] != 1 {
		t.Fatalf("snapshot duplicate status count = %d, want 1", snapshot.ByStatus[DeliveryDuplicate])
	}
}
