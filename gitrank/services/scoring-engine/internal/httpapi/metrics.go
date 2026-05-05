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

func (s *scoreMetricsSource) WritePrometheus(w io.Writer) {
	if s == nil {
		return
	}

	s.mu.Lock()
	count := s.count
	durationTotal := s.durationTotal
	suspicious := s.suspicious
	service := s.service
	s.mu.Unlock()

	_, _ = fmt.Fprintf(w, "# HELP gitrank_score_computations_total Total contribution score computations.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_score_computations_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_score_computation_duration_ms_sum Sum of score computation duration in milliseconds.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_score_computation_duration_ms_sum counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_score_suspicious_total Total scoring results flagged as suspicious.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_score_suspicious_total counter\n")
	_, _ = fmt.Fprintf(w, `gitrank_score_computations_total{service=%q} %d`+"\n", service, count)
	_, _ = fmt.Fprintf(w, `gitrank_score_computation_duration_ms_sum{service=%q} %.3f`+"\n", service, float64(durationTotal.Microseconds())/1000.0)
	_, _ = fmt.Fprintf(w, `gitrank_score_suspicious_total{service=%q} %d`+"\n", service, suspicious)
}
