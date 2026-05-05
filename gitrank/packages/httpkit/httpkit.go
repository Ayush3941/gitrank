package httpkit

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
)

type Middleware func(http.Handler) http.Handler

type Server struct {
	httpServer      *http.Server
	shutdownTimeout time.Duration
	log             *slog.Logger
}

func NewServer(addr string, handler http.Handler, shutdownTimeout time.Duration, log *slog.Logger) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:              addr,
			Handler:           handler,
			ReadHeaderTimeout: 5 * time.Second,
		},
		shutdownTimeout: shutdownTimeout,
		log:             log,
	}
}

func (s *Server) Run(ctx context.Context) error {
	serverErr := make(chan error, 1)

	go func() {
		serverErr <- s.httpServer.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), s.shutdownTimeout)
		defer cancel()
		return s.httpServer.Shutdown(shutdownCtx)
	case err := <-serverErr:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

func Chain(handler http.Handler, middlewares ...Middleware) http.Handler {
	wrapped := handler
	for i := len(middlewares) - 1; i >= 0; i-- {
		wrapped = middlewares[i](wrapped)
	}
	return wrapped
}

func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func WriteError(w http.ResponseWriter, status int, code, message, requestID string) {
	WriteJSON(w, status, contracts.NewErrorResponse(code, message, requestID))
}

func DecodeJSON(r *http.Request, dst any, maxBytes int64) error {
	r.Body = io.NopCloser(io.LimitReader(r.Body, maxBytes))
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(dst)
}
