package httpapi

import (
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/gitrank/gitrank/packages/httpkit"
)

var allowedAnalyticsEvents = map[string]struct{}{
	"onboarding.started":       {},
	"onboarding.completed":     {},
	"onboarding.sync.started":  {},
	"sync.succeeded":           {},
	"sync.failed":              {},
	"profile.viewed":           {},
	"score_explanation.opened": {},
	"badge.viewed":             {},
	"copy_text.used":           {},
	"profile.shared":           {},
	"empty_state.viewed":       {},
	"error_state.viewed":       {},
	"stale_state.viewed":       {},
	"web_vital.sample":         {},
}

type analyticsEventRequest struct {
	EventName    string  `json:"event_name"`
	Source       string  `json:"source,omitempty"`
	Target       string  `json:"target,omitempty"`
	Status       string  `json:"status,omitempty"`
	MetricName   string  `json:"metric_name,omitempty"`
	MetricValue  float64 `json:"metric_value,omitempty"`
	MetricRating string  `json:"metric_rating,omitempty"`
	RouteGroup   string  `json:"route_group,omitempty"`
}

type analyticsMetricsSource struct {
	service string
	log     *slog.Logger

	mu      sync.Mutex
	entries map[analyticsMetricKey]uint64
	vitals  map[webVitalMetricKey]webVitalAggregate
}

type analyticsMetricKey struct {
	eventName string
	target    string
	status    string
}

type webVitalMetricKey struct {
	metricName string
	routeGroup string
	rating     string
}

type webVitalAggregate struct {
	count uint64
	sum   float64
}

func newAnalyticsMetricsSource(service string, log *slog.Logger) *analyticsMetricsSource {
	return &analyticsMetricsSource{
		service: strings.TrimSpace(service),
		log:     log,
		entries: make(map[analyticsMetricKey]uint64),
		vitals:  make(map[webVitalMetricKey]webVitalAggregate),
	}
}

func handleAnalyticsEvent(w http.ResponseWriter, r *http.Request, analytics *analyticsMetricsSource) {
	var req analyticsEventRequest
	if err := httpkit.DecodeJSON(r, &req, 16<<10); err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return
	}

	eventName, err := normalizeAnalyticsEventName(req.EventName)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadRequest, "invalid_analytics_event", err.Error(), httpkit.RequestIDFromContext(r.Context()))
		return
	}

	status := normalizeAnalyticsStatus(req.Status, http.StatusAccepted)
	source := sanitizeAnalyticsValue(req.Source, 64)
	target := sanitizeAnalyticsValue(req.Target, 128)
	analytics.Observe(eventName, source, target, status)
	if eventName == "web_vital.sample" {
		metricName, err := normalizeWebVitalName(req.MetricName)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_web_vital_metric", err.Error(), httpkit.RequestIDFromContext(r.Context()))
			return
		}
		if math.IsNaN(req.MetricValue) || math.IsInf(req.MetricValue, 0) || req.MetricValue < 0 {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid_web_vital_value", "metric_value must be a finite non-negative number", httpkit.RequestIDFromContext(r.Context()))
			return
		}
		rating := normalizeWebVitalRating(req.MetricRating)
		routeGroup := sanitizeAnalyticsValue(req.RouteGroup, 64)
		if routeGroup == "" {
			routeGroup = routeGroupFromTarget(target)
		}
		if routeGroup == "" {
			routeGroup = "other"
		}
		analytics.ObserveWebVital(metricName, routeGroup, rating, req.MetricValue)
	}

	w.Header().Set("Cache-Control", "no-store")
	httpkit.WriteJSON(w, http.StatusAccepted, map[string]string{"status": "accepted"})
}

func (s *analyticsMetricsSource) Observe(eventName, source, target, status string) {
	if s == nil {
		return
	}
	eventName, err := normalizeAnalyticsEventName(eventName)
	if err != nil {
		return
	}
	status = normalizeAnalyticsStatus(status, http.StatusOK)
	target = sanitizeAnalyticsValue(target, 128)
	source = sanitizeAnalyticsValue(source, 64)

	s.mu.Lock()
	s.entries[analyticsMetricKey{eventName: eventName, target: target, status: status}]++
	s.mu.Unlock()

	if s.log != nil {
		s.log.Info("analytics_event",
			"event_name", eventName,
			"event_source", source,
			"event_target", target,
			"event_status", status,
		)
	}
}

func (s *analyticsMetricsSource) ObserveWebVital(metricName, routeGroup, rating string, value float64) {
	if s == nil {
		return
	}
	metricName, err := normalizeWebVitalName(metricName)
	if err != nil {
		return
	}
	if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		return
	}
	rating = normalizeWebVitalRating(rating)
	routeGroup = sanitizeAnalyticsValue(routeGroup, 64)
	if routeGroup == "" {
		routeGroup = "other"
	}

	s.mu.Lock()
	key := webVitalMetricKey{
		metricName: metricName,
		routeGroup: routeGroup,
		rating:     rating,
	}
	aggregate := s.vitals[key]
	aggregate.count++
	aggregate.sum += value
	s.vitals[key] = aggregate
	s.mu.Unlock()
}

func (s *analyticsMetricsSource) WritePrometheus(w io.Writer) {
	if s == nil {
		return
	}
	_, _ = fmt.Fprintf(w, "# HELP gitrank_product_analytics_events_total Total accepted product analytics events by name and status.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_product_analytics_events_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_frontend_web_vital_samples_total Frontend web vital samples grouped by metric, route group, and rating.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_frontend_web_vital_samples_total counter\n")
	_, _ = fmt.Fprintf(w, "# HELP gitrank_frontend_web_vital_value_total Cumulative frontend web vital values grouped by metric, route group, and rating.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_frontend_web_vital_value_total counter\n")

	s.mu.Lock()
	keys := make([]analyticsMetricKey, 0, len(s.entries))
	for key := range s.entries {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].eventName != keys[j].eventName {
			return keys[i].eventName < keys[j].eventName
		}
		if keys[i].target != keys[j].target {
			return keys[i].target < keys[j].target
		}
		return keys[i].status < keys[j].status
	})
	snapshots := make([]struct {
		key   analyticsMetricKey
		count uint64
	}, 0, len(keys))
	for _, key := range keys {
		snapshots = append(snapshots, struct {
			key   analyticsMetricKey
			count uint64
		}{key: key, count: s.entries[key]})
	}
	webVitalKeys := make([]webVitalMetricKey, 0, len(s.vitals))
	for key := range s.vitals {
		webVitalKeys = append(webVitalKeys, key)
	}
	sort.Slice(webVitalKeys, func(i, j int) bool {
		if webVitalKeys[i].metricName != webVitalKeys[j].metricName {
			return webVitalKeys[i].metricName < webVitalKeys[j].metricName
		}
		if webVitalKeys[i].routeGroup != webVitalKeys[j].routeGroup {
			return webVitalKeys[i].routeGroup < webVitalKeys[j].routeGroup
		}
		return webVitalKeys[i].rating < webVitalKeys[j].rating
	})
	webVitalSnapshots := make([]struct {
		key       webVitalMetricKey
		aggregate webVitalAggregate
	}, 0, len(webVitalKeys))
	for _, key := range webVitalKeys {
		webVitalSnapshots = append(webVitalSnapshots, struct {
			key       webVitalMetricKey
			aggregate webVitalAggregate
		}{key: key, aggregate: s.vitals[key]})
	}
	service := s.service
	s.mu.Unlock()

	for _, snapshot := range snapshots {
		_, _ = fmt.Fprintf(
			w,
			`gitrank_product_analytics_events_total{service=%q,event_name=%q,target=%q,status=%q} %d`+"\n",
			service,
			snapshot.key.eventName,
			snapshot.key.target,
			snapshot.key.status,
			snapshot.count,
		)
	}
	for _, snapshot := range webVitalSnapshots {
		_, _ = fmt.Fprintf(
			w,
			`gitrank_frontend_web_vital_samples_total{service=%q,metric_name=%q,route_group=%q,rating=%q} %d`+"\n",
			service,
			snapshot.key.metricName,
			snapshot.key.routeGroup,
			snapshot.key.rating,
			snapshot.aggregate.count,
		)
		_, _ = fmt.Fprintf(
			w,
			`gitrank_frontend_web_vital_value_total{service=%q,metric_name=%q,route_group=%q,rating=%q} %s`+"\n",
			service,
			snapshot.key.metricName,
			snapshot.key.routeGroup,
			snapshot.key.rating,
			strconv.FormatFloat(snapshot.aggregate.sum, 'f', -1, 64),
		)
	}
}

func analyticsProfileTransform(analytics *analyticsMetricsSource, target string) func(*http.Response, []byte) (int, []byte, map[string]string, error) {
	return func(response *http.Response, payload []byte) (int, []byte, map[string]string, error) {
		if response.StatusCode < http.StatusBadRequest {
			analytics.Observe("profile.viewed", "api-gateway", target, normalizeAnalyticsStatus("", response.StatusCode))
		}
		return response.StatusCode, payload, nil, nil
	}
}

func normalizeAnalyticsEventName(value string) (string, error) {
	eventName := strings.ToLower(strings.TrimSpace(value))
	if _, ok := allowedAnalyticsEvents[eventName]; !ok {
		return "", fmt.Errorf("unsupported analytics event %q", value)
	}
	return eventName, nil
}

func normalizeAnalyticsStatus(value string, statusCode int) string {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	switch trimmed {
	case "success", "failure":
		return trimmed
	}
	if statusCode >= http.StatusBadRequest {
		return "failure"
	}
	return "success"
}

func sanitizeAnalyticsValue(value string, limit int) string {
	value = strings.TrimSpace(value)
	if value == "" || limit <= 0 {
		return ""
	}
	var builder strings.Builder
	for _, ch := range value {
		if builder.Len() >= limit {
			break
		}
		if (ch >= 'a' && ch <= 'z') ||
			(ch >= 'A' && ch <= 'Z') ||
			(ch >= '0' && ch <= '9') ||
			ch == '.' || ch == '_' || ch == '-' || ch == ':' || ch == '/' || ch == '#' {
			builder.WriteRune(ch)
		}
	}
	return builder.String()
}

func normalizeWebVitalName(value string) (string, error) {
	metricName := strings.ToUpper(strings.TrimSpace(value))
	switch metricName {
	case "CLS", "FCP", "LCP", "INP", "TTFB", "FID":
		return metricName, nil
	default:
		return "", fmt.Errorf("unsupported web vital metric %q", value)
	}
}

func normalizeWebVitalRating(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "good", "needs-improvement", "poor":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "unknown"
	}
}

func routeGroupFromTarget(target string) string {
	target = strings.TrimSpace(target)
	if target == "" {
		return ""
	}
	parts := strings.Split(target, ":")
	if len(parts) == 0 {
		return ""
	}
	return sanitizeAnalyticsValue(parts[0], 64)
}
