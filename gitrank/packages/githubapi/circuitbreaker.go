package githubapi

import (
	"errors"
	"sync"
	"time"
)

var ErrCircuitOpen = errors.New("github circuit breaker is open")

type circuitState string

const (
	circuitClosed   circuitState = "closed"
	circuitOpen     circuitState = "open"
	circuitHalfOpen circuitState = "half_open"
)

type circuitBreaker struct {
	mu              sync.Mutex
	failureLimit    int
	openInterval    time.Duration
	halfOpenLimit   int
	state           circuitState
	consecutiveFail int
	openedAt        time.Time
	halfOpenActive  int
}

func newCircuitBreaker(failureLimit int, openInterval time.Duration, halfOpenLimit int) *circuitBreaker {
	if failureLimit <= 0 {
		failureLimit = 5
	}
	if openInterval <= 0 {
		openInterval = 30 * time.Second
	}
	if halfOpenLimit <= 0 {
		halfOpenLimit = 1
	}
	return &circuitBreaker{
		failureLimit:  failureLimit,
		openInterval:  openInterval,
		halfOpenLimit: halfOpenLimit,
		state:         circuitClosed,
	}
}

func (b *circuitBreaker) before(now time.Time) error {
	if b == nil {
		return nil
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	now = now.UTC()
	if b.state == circuitOpen {
		if now.Sub(b.openedAt) < b.openInterval {
			return ErrCircuitOpen
		}
		b.state = circuitHalfOpen
		b.halfOpenActive = 0
	}
	if b.state == circuitHalfOpen {
		if b.halfOpenActive >= b.halfOpenLimit {
			return ErrCircuitOpen
		}
		b.halfOpenActive++
	}
	return nil
}

func (b *circuitBreaker) success() {
	if b == nil {
		return
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	b.state = circuitClosed
	b.consecutiveFail = 0
	b.openedAt = time.Time{}
	b.halfOpenActive = 0
}

func (b *circuitBreaker) failure(now time.Time) {
	if b == nil {
		return
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	now = now.UTC()
	if b.state == circuitHalfOpen {
		b.state = circuitOpen
		b.openedAt = now
		b.halfOpenActive = 0
		return
	}
	b.consecutiveFail++
	if b.consecutiveFail >= b.failureLimit {
		b.state = circuitOpen
		b.openedAt = now
		b.halfOpenActive = 0
	}
}
