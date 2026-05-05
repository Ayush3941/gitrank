package httpapi

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type rateLimiter struct {
	mu      sync.Mutex
	window  time.Duration
	maxHits int
	hits    map[string][]time.Time
}

func newRateLimiter(window time.Duration, maxHits int) *rateLimiter {
	if window <= 0 {
		window = time.Minute
	}
	if maxHits <= 0 {
		maxHits = 60
	}
	return &rateLimiter{
		window:  window,
		maxHits: maxHits,
		hits:    make(map[string][]time.Time),
	}
}

func (l *rateLimiter) Allow(key string, now time.Time) (time.Duration, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()

	cutoff := now.Add(-l.window)
	current := l.hits[key]
	kept := current[:0]
	for _, hit := range current {
		if hit.After(cutoff) {
			kept = append(kept, hit)
		}
	}
	if len(kept) >= l.maxHits {
		retryAfter := kept[0].Add(l.window).Sub(now)
		if retryAfter < time.Second {
			retryAfter = time.Second
		}
		l.hits[key] = kept
		return retryAfter, false
	}

	kept = append(kept, now.UTC())
	l.hits[key] = kept
	return 0, true
}

func clientIP(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		first, _, _ := strings.Cut(forwarded, ",")
		return strings.TrimSpace(first)
	}
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	if strings.TrimSpace(r.RemoteAddr) != "" {
		return r.RemoteAddr
	}
	return "unknown"
}

func retryAfterSeconds(duration time.Duration) string {
	seconds := int(duration.Seconds())
	if duration > time.Duration(seconds)*time.Second {
		seconds++
	}
	if seconds <= 0 {
		seconds = 1
	}
	return strconv.Itoa(seconds)
}
