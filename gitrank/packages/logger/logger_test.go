package logger

import (
	"bytes"
	"log/slog"
	"strings"
	"testing"
)

func TestLoggerRedactsSensitiveValues(t *testing.T) {
	var output bytes.Buffer

	log := New(Config{
		Level:       "info",
		Format:      "json",
		Service:     "test",
		Environment: "test",
		Output:      &output,
	})

	log.Info("message",
		slog.String("api_key", "top-secret"),
		slog.String("request_id", "req-1"),
	)

	got := output.String()
	if strings.Contains(got, "top-secret") {
		t.Fatalf("logger output leaked secret: %s", got)
	}
	if !strings.Contains(got, "[REDACTED]") {
		t.Fatalf("logger output missing redaction marker: %s", got)
	}
	if !strings.Contains(got, "req-1") {
		t.Fatalf("logger output should preserve non-sensitive values: %s", got)
	}
}

func TestCorrelationHelpersAttachFields(t *testing.T) {
	var output bytes.Buffer

	log := New(Config{
		Level:       "info",
		Format:      "json",
		Service:     "test",
		Environment: "test",
		Output:      &output,
	})

	WithCorrelationID(WithRequestID(log, "req-2"), "corr-9").Info("message")

	got := output.String()
	if !strings.Contains(got, "req-2") {
		t.Fatalf("logger output missing request ID: %s", got)
	}
	if !strings.Contains(got, "corr-9") {
		t.Fatalf("logger output missing correlation ID: %s", got)
	}
}
