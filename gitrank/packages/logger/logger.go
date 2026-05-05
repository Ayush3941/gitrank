package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
)

type Config struct {
	Level       string
	Format      string
	Service     string
	Environment string
	AddSource   bool
	Output      io.Writer
}

func New(cfg Config) *slog.Logger {
	writer := cfg.Output
	if writer == nil {
		writer = os.Stdout
	}

	opts := &slog.HandlerOptions{
		Level:       parseLevel(cfg.Level),
		AddSource:   cfg.AddSource,
		ReplaceAttr: redactAttr,
	}

	var handler slog.Handler
	if strings.EqualFold(cfg.Format, "json") {
		handler = slog.NewJSONHandler(writer, opts)
	} else {
		handler = slog.NewTextHandler(writer, opts)
	}

	return slog.New(handler).With(
		slog.String("service", cfg.Service),
		slog.String("environment", cfg.Environment),
	)
}

func With(ctx context.Context, log *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerKey{}, log)
}

func FromContext(ctx context.Context) *slog.Logger {
	if log, ok := ctx.Value(loggerKey{}).(*slog.Logger); ok && log != nil {
		return log
	}
	return slog.Default()
}

func parseLevel(level string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func redactAttr(_ []string, attr slog.Attr) slog.Attr {
	key := strings.ToLower(attr.Key)
	if isSensitiveKey(key) {
		return slog.String(attr.Key, "[REDACTED]")
	}
	return attr
}

func isSensitiveKey(key string) bool {
	sensitive := []string{
		"authorization",
		"cookie",
		"secret",
		"token",
		"password",
		"private_key",
		"privatekey",
		"api_key",
		"apikey",
		"jwt",
	}
	for _, needle := range sensitive {
		if strings.Contains(key, needle) {
			return true
		}
	}
	return false
}

type loggerKey struct{}
