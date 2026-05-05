package store

import "time"

type DeliveryStore interface {
	Remember(delivery WebhookDelivery) (bool, error)
	MarkStatus(deliveryID string, status WebhookDeliveryStatus, err error) error
	Lookup(deliveryID string) (WebhookDelivery, bool, error)
	Snapshot(now time.Time) (DeliveryStoreSnapshot, error)
}
