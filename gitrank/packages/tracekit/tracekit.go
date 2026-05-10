package tracekit

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strings"
)

const (
	headerTraceParent = "traceparent"
	traceVersion      = "00"
	defaultFlags      = "01"
)

type contextKey string

const traceContextKey contextKey = "trace_context"

type TraceContext struct {
	TraceID string
	SpanID  string
	Flags   string
}

func New() TraceContext {
	return TraceContext{
		TraceID: randomHex(16),
		SpanID:  randomHex(8),
		Flags:   defaultFlags,
	}
}

func Parse(header string) (TraceContext, bool) {
	parts := strings.Split(strings.TrimSpace(header), "-")
	if len(parts) != 4 || parts[0] != traceVersion {
		return TraceContext{}, false
	}
	if !validLowerHex(parts[1], 32) || !validLowerHex(parts[2], 16) || !validLowerHex(parts[3], 2) {
		return TraceContext{}, false
	}
	if parts[1] == strings.Repeat("0", 32) || parts[2] == strings.Repeat("0", 16) {
		return TraceContext{}, false
	}
	return TraceContext{
		TraceID: parts[1],
		SpanID:  parts[2],
		Flags:   parts[3],
	}, true
}

func (t TraceContext) Header() string {
	if t.Flags == "" {
		t.Flags = defaultFlags
	}
	return traceVersion + "-" + t.TraceID + "-" + t.SpanID + "-" + t.Flags
}

func (t TraceContext) Child() TraceContext {
	if t.TraceID == "" {
		return New()
	}
	if t.Flags == "" {
		t.Flags = defaultFlags
	}
	t.SpanID = randomHex(8)
	return t
}

func WithContext(ctx context.Context, trace TraceContext) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, traceContextKey, trace)
}

func FromContext(ctx context.Context) (TraceContext, bool) {
	if ctx == nil {
		return TraceContext{}, false
	}
	trace, ok := ctx.Value(traceContextKey).(TraceContext)
	return trace, ok
}

func Ensure(ctx context.Context) (context.Context, TraceContext) {
	if ctx == nil {
		ctx = context.Background()
	}
	if trace, ok := FromContext(ctx); ok {
		return ctx, trace
	}
	trace := New()
	return WithContext(ctx, trace), trace
}

func ExtractOrNew(ctx context.Context, header string) (context.Context, TraceContext) {
	trace, ok := Parse(header)
	if ok {
		trace = trace.Child()
	} else {
		trace = New()
	}
	return WithContext(ctx, trace), trace
}

func Inject(ctx context.Context, set func(string, string)) {
	_, trace := Ensure(ctx)
	set(headerTraceParent, trace.Child().Header())
}

func randomHex(byteLen int) string {
	bytes := make([]byte, byteLen)
	if _, err := rand.Read(bytes); err != nil {
		panic("tracekit: crypto random failed")
	}
	return hex.EncodeToString(bytes)
}

func validLowerHex(value string, length int) bool {
	if len(value) != length {
		return false
	}
	for _, ch := range value {
		if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') {
			return false
		}
	}
	return true
}
