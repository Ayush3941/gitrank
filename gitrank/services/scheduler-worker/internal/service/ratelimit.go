package service

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

type scopeRateLimiter struct {
	mu     sync.Mutex
	window time.Duration
	max    int
	hits   map[string]scopeWindow
}

type scopeWindow struct {
	startedAt time.Time
	count     int
}

type RateLimitError struct {
	Scope      string
	Key        string
	RetryAfter time.Duration
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("%s rate limit exceeded for %s", e.Scope, e.Key)
}

func newScopeRateLimiter(window time.Duration, max int) *scopeRateLimiter {
	return &scopeRateLimiter{
		window: window,
		max:    max,
		hits:   make(map[string]scopeWindow),
	}
}

func (l *scopeRateLimiter) Allow(key string, now time.Time) (bool, time.Duration) {
	if l == nil || l.max <= 0 || l.window <= 0 {
		return true, 0
	}

	key = strings.TrimSpace(key)
	if key == "" {
		return true, 0
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	now = now.UTC()
	current := l.hits[key]
	if current.startedAt.IsZero() || now.Sub(current.startedAt) >= l.window {
		l.hits[key] = scopeWindow{startedAt: now, count: 1}
		return true, 0
	}
	if current.count >= l.max {
		return false, l.window - now.Sub(current.startedAt)
	}
	current.count++
	l.hits[key] = current
	return true, 0
}
