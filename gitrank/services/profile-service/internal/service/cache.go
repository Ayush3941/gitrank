package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync/atomic"
	"time"

	"github.com/gitrank/gitrank/packages/httpkit"
	"github.com/redis/go-redis/v9"
)

type Cache struct {
	client *redis.Client
	stats  cacheStats
}

type cacheStats struct {
	hits        atomic.Uint64
	misses      atomic.Uint64
	writeOK     atomic.Uint64
	writeErrors atomic.Uint64
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
			c.recordMiss()
			return false, nil
		}
		return false, err
	}

	if err := json.Unmarshal(raw, dst); err != nil {
		return false, err
	}
	c.recordHit()
	return true, nil
}

func (c *Cache) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	if !c.Enabled() {
		return nil
	}

	payload, err := json.Marshal(value)
	if err != nil {
		c.recordWriteError()
		return err
	}
	if err := c.client.Set(ctx, key, payload, ttl).Err(); err != nil {
		c.recordWriteError()
		return err
	}
	c.recordWriteOK()
	return nil
}

func (c *Cache) WritePrometheus(w io.Writer) {
	if c == nil {
		return
	}

	hits := c.stats.hits.Load()
	misses := c.stats.misses.Load()
	writes := c.stats.writeOK.Load()
	writeErrors := c.stats.writeErrors.Load()
	totalReads := hits + misses
	hitRate := 0.0
	if totalReads > 0 {
		hitRate = float64(hits) / float64(totalReads)
	}

	_, _ = fmt.Fprintf(w, "# HELP gitrank_profile_cache_hits_total Successful profile cache reads.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_profile_cache_hits_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_profile_cache_misses_total Missed profile cache reads.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_profile_cache_misses_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_profile_cache_writes_total Successful profile cache writes.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_profile_cache_writes_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_profile_cache_write_errors_total Failed profile cache writes.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_profile_cache_write_errors_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_profile_cache_hit_rate Ratio of cache hits over total cache reads.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_profile_cache_hit_rate gauge\n")
	_, _ = fmt.Fprintf(w, "gitrank_profile_cache_hits_total %d\n", hits)
	_, _ = fmt.Fprintf(w, "gitrank_profile_cache_misses_total %d\n", misses)
	_, _ = fmt.Fprintf(w, "gitrank_profile_cache_writes_total %d\n", writes)
	_, _ = fmt.Fprintf(w, "gitrank_profile_cache_write_errors_total %d\n", writeErrors)
	_, _ = fmt.Fprintf(w, "gitrank_profile_cache_hit_rate %.6f\n", hitRate)
}

func (c *Cache) MetricsSource() httpkit.PrometheusSource {
	if c == nil {
		return nil
	}
	return c
}

func (c *Cache) recordHit() {
	if c != nil {
		c.stats.hits.Add(1)
	}
}

func (c *Cache) recordMiss() {
	if c != nil {
		c.stats.misses.Add(1)
	}
}

func (c *Cache) recordWriteOK() {
	if c != nil {
		c.stats.writeOK.Add(1)
	}
}

func (c *Cache) recordWriteError() {
	if c != nil {
		c.stats.writeErrors.Add(1)
	}
}
