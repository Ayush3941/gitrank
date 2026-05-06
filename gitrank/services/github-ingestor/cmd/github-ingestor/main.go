package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/packages/logger"
	"github.com/Ayush3941/gitrank/packages/store"
	"github.com/Ayush3941/gitrank/services/github-ingestor/internal/httpapi"
	"github.com/Ayush3941/gitrank/services/github-ingestor/internal/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

const version = "dev"

func main() {
	cfg, err := config.Load("github-ingestor", "GITHUB_INGESTOR_ADDR")
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

	deliveryStore := store.DeliveryStore(store.NewInMemoryDeliveryStore(cfg.GitHub.DedupeTTL))
	jobQueue := store.NewInMemoryJobQueue()
	persistence := service.New(nil)
	if cfg.Database.URL != "" {
		dbpool, err := pgxpool.New(ctx, cfg.Database.URL)
		if err != nil {
			panic(err)
		}
		defer dbpool.Close()
		deliveryStore = store.NewPostgresDeliveryStore(dbpool, cfg.Services.RequestTimeout)
		persistence = service.New(dbpool)
	}

	server := httpkit.NewServer(cfg.Addr, httpapi.NewRouterWithStores(cfg, deliveryStore, jobQueue, persistence, log, version), cfg.ShutdownTimeout, log)
	log.Info("starting service", "addr", cfg.Addr, "version", version)
	if err := server.Run(ctx); err != nil {
		log.Error("server exited", "error", err)
		os.Exit(1)
	}
}
