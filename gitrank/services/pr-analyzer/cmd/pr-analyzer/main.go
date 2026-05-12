package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/httpkit"
	"github.com/gitrank/gitrank/packages/logger"
	"github.com/gitrank/gitrank/services/pr-analyzer/internal/analyzer"
	"github.com/gitrank/gitrank/services/pr-analyzer/internal/httpapi"
	"github.com/jackc/pgx/v5/pgxpool"
)

const version = "dev"

func main() {
	cfg, err := config.Load("pr-analyzer", "PR_ANALYZER_ADDR")
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

	if err := cfg.ValidatePRAnalyzerService(); err != nil {
		panic(err)
	}

	dbpool, err := pgxpool.New(ctx, cfg.Database.URL)
	if err != nil {
		panic(err)
	}
	defer dbpool.Close()

	analysisStore := analyzer.NewStore(dbpool)
	server := httpkit.NewServer(cfg.Addr, httpapi.NewRouterWithStore(cfg, analysisStore, log, version), cfg.ShutdownTimeout, log)
	log.Info("starting service", "addr", cfg.Addr, "version", version)
	if err := server.Run(ctx); err != nil {
		log.Error("server exited", "error", err)
		os.Exit(1)
	}
}
