package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/httpkit"
	"github.com/gitrank/gitrank/packages/logger"
	"github.com/gitrank/gitrank/services/api-gateway/internal/httpapi"
)

const version = "dev"

func main() {
	cfg, err := config.Load("api-gateway", "API_GATEWAY_ADDR")
	if err != nil {
		panic(err)
	}

	log := logger.New(logger.Config{
		Level:       cfg.Log.Level,
		Format:      cfg.Log.Format,
		Service:     cfg.ServiceName,
		Environment: string(cfg.Env),
		AddSource:   true,
	})

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	server := httpkit.NewServer(cfg.Addr, httpapi.NewRouter(cfg, log, version), cfg.ShutdownTimeout, log)
	log.Info("starting service", "addr", cfg.Addr, "version", version)
	if err := server.Run(ctx); err != nil {
		log.Error("server exited", "error", err)
		os.Exit(1)
	}
}
