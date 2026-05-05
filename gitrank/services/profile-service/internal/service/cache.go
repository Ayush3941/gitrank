package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	client *redis.Client
}

func NewCache(redisURL string) (*Cache, error) {
	if strings.TrimSpace(redisURL) == "" {
		return &Cache{}, nil
	}

	opts, err := redis.ParseURL(strings.TrimSpace(redisURL))
	if err != nil {
		return nil, err
	}

	return &Cache{client: redis.NewClient(opts)}, nil
}

func (c *Cache) Enabled() bool {
	return c != nil && c.client != nil
}

func (c *Cache) Ping(ctx context.Context) error {
	if !c.Enabled() {
		return nil
	}
	return c.client.Ping(ctx).Err()
}

func (c *Cache) Close() error {
	if !c.Enabled() {
		return nil
	}
	return c.client.Close()
}

func (c *Cache) GetJSON(ctx context.Context, key string, dst any) (bool, error) {
	if !c.Enabled() {
		return false, nil
	}

	raw, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return false, nil
		}
		return false, err
	}

	if err := json.Unmarshal(raw, dst); err != nil {
		return false, err
	}
	return true, nil
}

func (c *Cache) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	if !c.Enabled() {
		return nil
	}

	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, key, payload, ttl).Err()
}
