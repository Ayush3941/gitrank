package service

import (
	"fmt"
	"io"
	"strings"
	"sync"

	"github.com/Ayush3941/gitrank/packages/githubapi"
)

type githubRateLimitMetrics struct {
	service string

	mu           sync.Mutex
	observed     bool
	limit        int
	remaining    int
	used         int
	resetAtUnix  int64
	resource     string
	observations uint64
}

func newGitHubRateLimitMetrics(service string) *githubRateLimitMetrics {
	return &githubRateLimitMetrics{service: strings.TrimSpace(service)}
}

func (m *githubRateLimitMetrics) Observe(status githubapi.RateLimitStatus) {
	if m == nil {
		return
	}
	if status.Limit == 0 && status.Remaining == 0 && status.Used == 0 && status.ResetAt.IsZero() && strings.TrimSpace(status.Resource) == "" {
		return
	}

	resource := strings.TrimSpace(status.Resource)
	if resource == "" {
		resource = "unknown"
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.observed = true
	m.limit = status.Limit
	m.remaining = status.Remaining
	m.used = status.Used
	m.resetAtUnix = status.ResetAt.UTC().Unix()
	m.resource = resource
	m.observations++
}

func (m *githubRateLimitMetrics) WritePrometheus(w io.Writer) {
	if m == nil {
		return
	}

	m.mu.Lock()
	observed := m.observed
	limit := m.limit
	remaining := m.remaining
	used := m.used
	resetAtUnix := m.resetAtUnix
	resource := m.resource
	observations := m.observations
	service := m.service
	m.mu.Unlock()

	if !observed {
		resource = "unknown"
	}

	_, _ = fmt.Fprintf(w, "# HELP gitrank_github_rate_limit_limit Last observed GitHub REST API rate-limit ceiling.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_github_rate_limit_limit gauge\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_github_rate_limit_remaining Last observed GitHub REST API rate-limit remainder.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_github_rate_limit_remaining gauge\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_github_rate_limit_used Last observed GitHub REST API rate-limit usage.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_github_rate_limit_used gauge\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_github_rate_limit_reset_at_unix Last observed GitHub REST API rate-limit reset time as a Unix timestamp.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_github_rate_limit_reset_at_unix gauge\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_github_rate_limit_observations_total Total GitHub REST API responses that carried rate-limit metadata.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_github_rate_limit_observations_total counter\n")
	_, _ = fmt.Fprintf(w, `gitrank_github_rate_limit_limit{service=%q,resource=%q} %d`+"\n", service, resource, limit)
	_, _ = fmt.Fprintf(w, `gitrank_github_rate_limit_remaining{service=%q,resource=%q} %d`+"\n", service, resource, remaining)
	_, _ = fmt.Fprintf(w, `gitrank_github_rate_limit_used{service=%q,resource=%q} %d`+"\n", service, resource, used)
	_, _ = fmt.Fprintf(w, `gitrank_github_rate_limit_reset_at_unix{service=%q,resource=%q} %d`+"\n", service, resource, resetAtUnix)
	_, _ = fmt.Fprintf(w, `gitrank_github_rate_limit_observations_total{service=%q,resource=%q} %d`+"\n", service, resource, observations)
}
