package service

import (
	"sync"
	"time"
)

type RateLimiter struct {
	mu      sync.Mutex
	window  time.Duration
	maxHits int
	hits    map[string][]time.Time
}

func NewRateLimiter(window time.Duration, maxHits int) *RateLimiter {
	if window <= 0 {
		window = time.Minute
	}
	if maxHits <= 0 {
		maxHits = 30
	}
	return &RateLimiter{
		window:  window,
		maxHits: maxHits,
		hits:    make(map[string][]time.Time),
	}
}

func (l *RateLimiter) Allow(key string, now time.Time) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	cutoff := now.Add(-l.window)
	entries := l.hits[key]
	kept := entries[:0]
	for _, hit := range entries {
		if hit.After(cutoff) {
			kept = append(kept, hit)
		}
	}

	if len(kept) >= l.maxHits {
		retryAfter := kept[0].Add(l.window).Sub(now)
		if retryAfter < 0 {
			retryAfter = l.window
		}
		l.hits[key] = kept
		return false, retryAfter
	}

	kept = append(kept, now.UTC())
	l.hits[key] = kept
	return true, 0
}
