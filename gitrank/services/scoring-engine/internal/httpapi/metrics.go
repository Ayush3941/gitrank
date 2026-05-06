package httpapi

import (
	"fmt"
	"io"
	"sync"
	"time"
)

type scoreMetricsSource struct {
	service string

	mu sync.Mutex

	count         uint64
	durationTotal time.Duration
	suspicious    uint64
	replays       uint64
	replayEvents  uint64
	replayBadges  uint64
}

func newScoreMetricsSource(service string) *scoreMetricsSource {
	return &scoreMetricsSource{service: service}
}

func (s *scoreMetricsSource) Observe(suspicious bool, duration time.Duration) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	s.count++
	s.durationTotal += duration
	if suspicious {
		s.suspicious++
	}
}

func (s *scoreMetricsSource) ObserveReplay(badges, events int) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	s.replays++
	s.replayEvents += uint64(events)
	s.replayBadges += uint64(badges)
}

func (s *scoreMetricsSource) WritePrometheus(w io.Writer) {
	if s == nil {
		return
	}

	s.mu.Lock()
	count := s.count
	durationTotal := s.durationTotal
	suspicious := s.suspicious
	replays := s.replays
	replayEvents := s.replayEvents
	replayBadges := s.replayBadges
	service := s.service
	s.mu.Unlock()

	_, _ = fmt.Fprintf(w, "# HELP gitrank_score_computations_total Total contribution score computations.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_score_computations_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_score_computation_duration_ms_sum Sum of score computation duration in milliseconds.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_score_computation_duration_ms_sum counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_score_suspicious_total Total scoring results flagged as suspicious.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_score_suspicious_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_score_replays_total Total persisted score replay runs.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_score_replays_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_score_replay_events_total Total score events written during replay runs.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_score_replay_events_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_score_badges_issued_total Total badges projected during replay runs.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_score_badges_issued_total counter\n")
	_, _ = fmt.Fprintf(w, `gitrank_score_computations_total{service=%q} %d`+"\n", service, count)
	_, _ = fmt.Fprintf(w, `gitrank_score_computation_duration_ms_sum{service=%q} %.3f`+"\n", service, float64(durationTotal.Microseconds())/1000.0)
	_, _ = fmt.Fprintf(w, `gitrank_score_suspicious_total{service=%q} %d`+"\n", service, suspicious)
	_, _ = fmt.Fprintf(w, `gitrank_score_replays_total{service=%q} %d`+"\n", service, replays)
	_, _ = fmt.Fprintf(w, `gitrank_score_replay_events_total{service=%q} %d`+"\n", service, replayEvents)
	_, _ = fmt.Fprintf(w, `gitrank_score_badges_issued_total{service=%q} %d`+"\n", service, replayBadges)
}
