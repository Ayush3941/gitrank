package httpkit

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"time"

	"github.com/Ayush3941/gitrank/packages/tracekit"
)

type contextKey string

const requestIDContextKey contextKey = "request_id"

func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = newRequestID()
		}

		ctx := context.WithValue(r.Context(), requestIDContextKey, requestID)
		ctx, trace := tracekit.ExtractOrNew(ctx, r.Header.Get("traceparent"))
		w.Header().Set("X-Request-ID", requestID)
		w.Header().Set("traceparent", trace.Header())
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RequestIDFromContext(ctx context.Context) string {
	if value, ok := ctx.Value(requestIDContextKey).(string); ok {
		return value
	}
	return ""
}

func TraceParentFromContext(ctx context.Context) string {
	if trace, ok := tracekit.FromContext(ctx); ok {
		return trace.Header()
	}
	return ""
}

func EnsureTraceContext(ctx context.Context) context.Context {
	ctx, _ = tracekit.Ensure(ctx)
	return ctx
}

func InjectTraceContext(ctx context.Context, header http.Header) {
	tracekit.Inject(ctx, header.Set)
}

func Recoverer(log *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if recovered := recover(); recovered != nil {
					log.Error("panic recovered",
						"request_id", RequestIDFromContext(r.Context()),
						"method", r.Method,
						"path", r.URL.Path,
						"panic", recovered,
					)
					WriteError(w, http.StatusInternalServerError, "internal_error", "internal server error", RequestIDFromContext(r.Context()))
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

func AccessLog(log *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(recorder, r)
			log.Info("http_request",
				"request_id", RequestIDFromContext(r.Context()),
				"traceparent", TraceParentFromContext(r.Context()),
				"method", r.Method,
				"path", r.URL.Path,
				"status", recorder.status,
				"duration_ms", time.Since(start).Milliseconds(),
			)
		})
	}
}

func RequireMethod(method string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method {
			WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", RequestIDFromContext(r.Context()))
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func newRequestID() string {
	var bytes [16]byte
	_, _ = rand.Read(bytes[:])
	return hex.EncodeToString(bytes[:])
}
