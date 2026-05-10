package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/githubapi"
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
	var executor *service.Executor
	restClient, err := githubapi.NewRESTClient(githubapi.ClientConfig{
		BaseURL:                        cfg.GitHub.APIBaseURL,
		APIVersion:                     cfg.GitHub.APIVersion,
		UserAgent:                      cfg.GitHub.UserAgent,
		HTTPClient:                     &http.Client{Timeout: cfg.GitHub.RequestTimeout},
		SecondaryBackoff:               cfg.GitHub.SecondaryBackoff,
		MaxConcurrency:                 cfg.GitHub.MaxConcurrency,
		CircuitBreakerFailureThreshold: cfg.GitHub.CircuitBreakerFailureThreshold,
		CircuitBreakerOpenInterval:     cfg.GitHub.CircuitBreakerOpenInterval,
		CircuitBreakerHalfOpenMax:      cfg.GitHub.CircuitBreakerHalfOpenMax,
	})
	if err != nil {
		panic(err)
	}
	if cfg.Database.URL != "" {
		dbpool, err := pgxpool.New(ctx, cfg.Database.URL)
		if err != nil {
			panic(err)
		}
		defer dbpool.Close()
		deliveryStore = store.NewPostgresDeliveryStore(dbpool, cfg.Services.RequestTimeout)
		persistence = service.New(dbpool)
		executor = service.NewExecutor(cfg, dbpool, restClient)
	}

	server := httpkit.NewServer(cfg.Addr, httpapi.NewRouterWithStores(cfg, deliveryStore, jobQueue, persistence, executor, log, version), cfg.ShutdownTimeout, log)
	log.Info("starting service", "addr", cfg.Addr, "version", version)
	if err := server.Run(ctx); err != nil {
		log.Error("server exited", "error", err)
		os.Exit(1)
	}
}
