package tracekit

import (
	"context"
	"strings"
	"testing"
)

func TestExtractOrNewContinuesValidTraceParent(t *testing.T) {
	parent := "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"

	ctx, trace := ExtractOrNew(context.Background(), parent)

	if trace.TraceID != "4bf92f3577b34da6a3ce929d0e0e4736" {
		t.Fatalf("trace id = %q, want parent trace id", trace.TraceID)
	}
	if trace.SpanID == "00f067aa0ba902b7" || len(trace.SpanID) != 16 {
		t.Fatalf("span id = %q, want new child span", trace.SpanID)
	}
	loaded, ok := FromContext(ctx)
	if !ok || loaded.TraceID != trace.TraceID {
		t.Fatalf("context trace = %+v, ok=%v", loaded, ok)
	}
}

func TestInjectWritesChildTraceParent(t *testing.T) {
	ctx := WithContext(context.Background(), TraceContext{
		TraceID: "4bf92f3577b34da6a3ce929d0e0e4736",
		SpanID:  "00f067aa0ba902b7",
		Flags:   "01",
	})

	headers := map[string]string{}
	Inject(ctx, func(key, value string) {
		headers[key] = value
	})

	traceparent := headers["traceparent"]
	if !strings.HasPrefix(traceparent, "00-4bf92f3577b34da6a3ce929d0e0e4736-") {
		t.Fatalf("traceparent = %q, want propagated trace id", traceparent)
	}
	if strings.Contains(traceparent, "-00f067aa0ba902b7-") {
		t.Fatalf("traceparent = %q, want child span id", traceparent)
	}
}
