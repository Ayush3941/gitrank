package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultStoreTimeout = 5 * time.Second

type PostgresDeliveryStore struct {
	pool    *pgxpool.Pool
	timeout time.Duration
}

func NewPostgresDeliveryStore(pool *pgxpool.Pool, timeout time.Duration) *PostgresDeliveryStore {
	if timeout <= 0 {
		timeout = defaultStoreTimeout
	}
	return &PostgresDeliveryStore{
		pool:    pool,
		timeout: timeout,
	}
}

func (s *PostgresDeliveryStore) Remember(delivery WebhookDelivery) (bool, error) {
	ctx, cancel := s.context()
	defer cancel()

	tag, err := s.pool.Exec(ctx, `
		INSERT INTO github_webhook_deliveries (
			github_delivery_id,
			event_type,
			action,
			installation_id,
			github_installation_id,
			repository_id,
			repository_full_name,
			signature_sha256,
			payload_sha256,
			status,
			redelivery,
			first_received_at,
			last_received_at,
			last_error,
			payload_jsonb
		) VALUES (
			$1,
			$2,
			$3,
			(SELECT id FROM github_installations WHERE github_installation_id = NULLIF($4, 0) LIMIT 1),
			$4,
			(SELECT id FROM repositories WHERE full_name = $5 LIMIT 1),
			$5,
			$6,
			$7,
			$8,
			FALSE,
			$9,
			$9,
			'',
			$10::jsonb
		)
		ON CONFLICT (github_delivery_id) DO NOTHING
	`,
		delivery.DeliveryID,
		delivery.EventType,
		delivery.Action,
		delivery.InstallationID,
		delivery.Repository,
		delivery.Signature,
		delivery.PayloadSHA256,
		string(delivery.Status),
		delivery.ReceivedAt.UTC(),
		[]byte(delivery.Payload),
	)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 1 {
		return false, nil
	}

	_, err = s.pool.Exec(ctx, `
		UPDATE github_webhook_deliveries
		SET status = $2,
			redelivery = TRUE,
			last_received_at = $3,
			last_error = ''
		WHERE github_delivery_id = $1
	`,
		delivery.DeliveryID,
		string(DeliveryDuplicate),
		delivery.ReceivedAt.UTC(),
	)
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *PostgresDeliveryStore) MarkStatus(deliveryID string, status WebhookDeliveryStatus, err error) error {
	ctx, cancel := s.context()
	defer cancel()

	lastError := ""
	if err != nil {
		lastError = err.Error()
	}
	_, execErr := s.pool.Exec(ctx, `
		UPDATE github_webhook_deliveries
		SET status = $2,
			last_error = $3,
			last_received_at = NOW()
		WHERE github_delivery_id = $1
	`,
		deliveryID,
		string(status),
		lastError,
	)
	return execErr
}

func (s *PostgresDeliveryStore) Lookup(deliveryID string) (WebhookDelivery, bool, error) {
	ctx, cancel := s.context()
	defer cancel()

	row := s.pool.QueryRow(ctx, `
		SELECT
			github_delivery_id,
			event_type,
			action,
			repository_full_name,
			github_installation_id,
			signature_sha256,
			payload_sha256,
			payload_jsonb,
			status,
			first_received_at,
			last_error
		FROM github_webhook_deliveries
		WHERE github_delivery_id = $1
	`, deliveryID)

	var delivery WebhookDelivery
	var payload []byte
	var status string
	if err := row.Scan(
		&delivery.DeliveryID,
		&delivery.EventType,
		&delivery.Action,
		&delivery.Repository,
		&delivery.InstallationID,
		&delivery.Signature,
		&delivery.PayloadSHA256,
		&payload,
		&status,
		&delivery.ReceivedAt,
		&delivery.LastError,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return WebhookDelivery{}, false, nil
		}
		return WebhookDelivery{}, false, err
	}
	delivery.Status = WebhookDeliveryStatus(status)
	delivery.Payload = append(delivery.Payload[:0], payload...)
	return delivery, true, nil
}

func (s *PostgresDeliveryStore) Snapshot(_ time.Time) (DeliveryStoreSnapshot, error) {
	ctx, cancel := s.context()
	defer cancel()

	snapshot := DeliveryStoreSnapshot{
		ByStatus: make(map[WebhookDeliveryStatus]int),
	}
	row := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*)::int,
			COALESCE(SUM(CASE WHEN status = 'duplicate' THEN 1 ELSE 0 END), 0)::int,
			COALESCE(SUM(CASE WHEN redelivery THEN 1 ELSE 0 END), 0)::int
		FROM github_webhook_deliveries
	`)
	if err := row.Scan(&snapshot.Total, &snapshot.Deduplicated, &snapshot.ReplayRecorded); err != nil {
		return DeliveryStoreSnapshot{}, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT status, COUNT(*)::int
		FROM github_webhook_deliveries
		GROUP BY status
	`)
	if err != nil {
		return DeliveryStoreSnapshot{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return DeliveryStoreSnapshot{}, err
		}
		snapshot.ByStatus[WebhookDeliveryStatus(status)] = count
	}
	if err := rows.Err(); err != nil {
		return DeliveryStoreSnapshot{}, err
	}
	return snapshot, nil
}

func (s *PostgresDeliveryStore) context() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), s.timeout)
}
