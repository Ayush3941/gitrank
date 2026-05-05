package httpkit

import (
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

type PrometheusSource interface {
	WritePrometheus(io.Writer)
}

type Metrics struct {
	service string
	started time.Time

	mu      sync.Mutex
	entries map[metricKey]*metricValue
}

type metricKey struct {
	method      string
	statusClass string
}

type metricValue struct {
	count         uint64
	durationTotal time.Duration
}

func NewMetrics(service string) *Metrics {
	return &Metrics{
		service: strings.TrimSpace(service),
		started: time.Now().UTC(),
		entries: make(map[metricKey]*metricValue),
	}
}

func (m *Metrics) Observe(method string, status int, duration time.Duration) {
	if m == nil {
		return
	}

	key := metricKey{
		method:      strings.ToUpper(strings.TrimSpace(method)),
		statusClass: statusClass(status),
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	current, ok := m.entries[key]
	if !ok {
		current = &metricValue{}
		m.entries[key] = current
	}
	current.count++
	current.durationTotal += duration
}

func (m *Metrics) Handler() http.Handler {
	return MetricsHandler(m)
}

func (m *Metrics) WritePrometheus(w io.Writer) {
	if m == nil {
		return
	}

	_, _ = fmt.Fprintf(w, "# HELP gitrank_http_requests_total Total HTTP requests observed by this service.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_http_requests_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_http_request_duration_ms_sum Sum of observed HTTP request duration in milliseconds.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_http_request_duration_ms_sum counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_service_uptime_seconds Service uptime in seconds.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_service_uptime_seconds gauge\n")

	m.mu.Lock()
	keys := make([]metricKey, 0, len(m.entries))
	for key := range m.entries {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].method != keys[j].method {
			return keys[i].method < keys[j].method
		}
		return keys[i].statusClass < keys[j].statusClass
	})
	snapshots := make([]struct {
		key   metricKey
		value metricValue
	}, 0, len(keys))
	for _, key := range keys {
		snapshots = append(snapshots, struct {
			key   metricKey
			value metricValue
		}{
			key:   key,
			value: *m.entries[key],
		})
	}
	started := m.started
	service := m.service
	m.mu.Unlock()

	for _, snapshot := range snapshots {
		_, _ = fmt.Fprintf(
			w,
			`gitrank_http_requests_total{service=%q,method=%q,status_class=%q} %d`+"\n",
			service,
			snapshot.key.method,
			snapshot.key.statusClass,
			snapshot.value.count,
		)
		_, _ = fmt.Fprintf(
			w,
			`gitrank_http_request_duration_ms_sum{service=%q,method=%q,status_class=%q} %.3f`+"\n",
			service,
			snapshot.key.method,
			snapshot.key.statusClass,
			float64(snapshot.value.durationTotal.Microseconds())/1000.0,
		)
	}

	_, _ = fmt.Fprintf(
		w,
		`gitrank_service_uptime_seconds{service=%q} %.3f`+"\n",
		service,
		time.Since(started).Seconds(),
	)
}

func MetricsHandler(primary PrometheusSource, extras ...PrometheusSource) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if primary == nil && len(extras) == 0 {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		if primary != nil {
			primary.WritePrometheus(w)
		}
		for _, extra := range extras {
			if extra != nil {
				extra.WritePrometheus(w)
			}
		}
	})
}

func Instrument(metrics *Metrics) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(recorder, r)
			metrics.Observe(r.Method, recorder.status, time.Since(start))
		})
	}
}

type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	AllowCredentials bool
	MaxAge           time.Duration
}

func CORS(cfg CORSConfig) Middleware {
	allowedOrigins := normalizeList(cfg.AllowedOrigins)
	allowedMethods := cfg.AllowedMethods
	if len(allowedMethods) == 0 {
		allowedMethods = []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodOptions}
	}
	allowedHeaders := cfg.AllowedHeaders
	if len(allowedHeaders) == 0 {
		allowedHeaders = []string{"Content-Type", "X-CSRF-Token", "X-Request-ID"}
	}

	methodHeader := strings.Join(allowedMethods, ", ")
	headersHeader := strings.Join(allowedHeaders, ", ")
	maxAgeSeconds := int(cfg.MaxAge.Seconds())
	if maxAgeSeconds <= 0 {
		maxAgeSeconds = 600
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimSpace(r.Header.Get("Origin"))
			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}

			w.Header().Add("Vary", "Origin")
			if !originAllowed(origin, allowedOrigins) {
				if r.Method == http.MethodOptions {
					WriteError(w, http.StatusForbidden, "cors_forbidden", "origin not allowed", RequestIDFromContext(r.Context()))
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", methodHeader)
			w.Header().Set("Access-Control-Allow-Headers", headersHeader)
			w.Header().Set("Access-Control-Max-Age", fmt.Sprintf("%d", maxAgeSeconds))
			if cfg.AllowCredentials {
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func normalizeList(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			normalized = append(normalized, trimmed)
		}
	}
	return normalized
}

func originAllowed(origin string, allowed []string) bool {
	if len(allowed) == 0 {
		return false
	}
	for _, candidate := range allowed {
		if candidate == "*" || strings.EqualFold(candidate, origin) {
			return true
		}
	}
	return false
}

func statusClass(status int) string {
	switch {
	case status >= 500:
		return "5xx"
	case status >= 400:
		return "4xx"
	case status >= 300:
		return "3xx"
	default:
		return "2xx"
	}
}
