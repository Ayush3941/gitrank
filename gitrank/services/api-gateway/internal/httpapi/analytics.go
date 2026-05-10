package httpapi

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"sync"

	"github.com/Ayush3941/gitrank/packages/httpkit"
)

var allowedAnalyticsEvents = map[string]struct{}{
	"onboarding.completed":     {},
	"sync.succeeded":           {},
	"sync.failed":              {},
	"profile.viewed":           {},
	"score_explanation.opened": {},
	"badge.viewed":             {},
}

type analyticsEventRequest struct {
	EventName string `json:"event_name"`
	Source    string `json:"source,omitempty"`
	Target    string `json:"target,omitempty"`
	Status    string `json:"status,omitempty"`
}

type analyticsMetricsSource struct {
	service string
	log     *slog.Logger

	mu      sync.Mutex
	entries map[analyticsMetricKey]uint64
}

type analyticsMetricKey struct {
	eventName string
	status    string
}

func newAnalyticsMetricsSource(service string, log *slog.Logger) *analyticsMetricsSource {
	return &analyticsMetricsSource{
		service: strings.TrimSpace(service),
		log:     log,
		entries: make(map[analyticsMetricKey]uint64),
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

	s.mu.Lock()
	s.entries[analyticsMetricKey{eventName: eventName, status: status}]++
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

func (s *analyticsMetricsSource) WritePrometheus(w io.Writer) {
	if s == nil {
		return
	}
	_, _ = fmt.Fprintf(w, "# HELP gitrank_product_analytics_events_total Total accepted product analytics events by name and status.\n")
	_, _ = fmt.Fprintf(w, "# TYPE gitrank_product_analytics_events_total counter\n")

	s.mu.Lock()
	keys := make([]analyticsMetricKey, 0, len(s.entries))
	for key := range s.entries {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].eventName != keys[j].eventName {
			return keys[i].eventName < keys[j].eventName
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
	service := s.service
	s.mu.Unlock()

	for _, snapshot := range snapshots {
		_, _ = fmt.Fprintf(
			w,
			`gitrank_product_analytics_events_total{service=%q,event_name=%q,status=%q} %d`+"\n",
			service,
			snapshot.key.eventName,
			snapshot.key.status,
			snapshot.count,
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
