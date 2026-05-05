package httpapi

import (
	"fmt"
	"io"
	"sort"
	"sync"
	"time"
)

type analysisMetricsSource struct {
	service string

	mu      sync.Mutex
	entries map[string]*analysisMetricValue
}

type analysisMetricValue struct {
	count         uint64
	durationTotal time.Duration
}

func newAnalysisMetricsSource(service string) *analysisMetricsSource {
	return &analysisMetricsSource{
		service: service,
		entries: make(map[string]*analysisMetricValue),
	}
}

func (s *analysisMetricsSource) Observe(category string, duration time.Duration) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	current, ok := s.entries[category]
	if !ok {
		current = &analysisMetricValue{}
		s.entries[category] = current
	}
	current.count++
	current.durationTotal += duration
}

func (s *analysisMetricsSource) WritePrometheus(w io.Writer) {
	if s == nil {
		return
	}

	_, _ = fmt.Fprintf(w, "# HELP gitrank_pr_analysis_requests_total Total analyzed pull requests by inferred category.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_pr_analysis_requests_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_pr_analysis_duration_ms_sum Sum of pull-request analysis duration in milliseconds.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_pr_analysis_duration_ms_sum counter\n")

	s.mu.Lock()
	categories := make([]string, 0, len(s.entries))
	for category := range s.entries {
		categories = append(categories, category)
	}
	sort.Strings(categories)
	snapshots := make([]struct {
		category string
		value    analysisMetricValue
	}, 0, len(categories))
	for _, category := range categories {
		snapshots = append(snapshots, struct {
			category string
			value    analysisMetricValue
		}{
			category: category,
			value:    *s.entries[category],
		})
	}
	service := s.service
	s.mu.Unlock()

	for _, snapshot := range snapshots {
		_, _ = fmt.Fprintf(
			w,
			`gitrank_pr_analysis_requests_total{service=%q,category=%q} %d`+"\n",
			service,
			snapshot.category,
			snapshot.value.count,
		)
		_, _ = fmt.Fprintf(
			w,
			`gitrank_pr_analysis_duration_ms_sum{service=%q,category=%q} %.3f`+"\n",
			service,
			snapshot.category,
			float64(snapshot.value.durationTotal.Microseconds())/1000.0,
		)
	}
}
