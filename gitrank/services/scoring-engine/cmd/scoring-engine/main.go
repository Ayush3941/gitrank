package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/packages/logger"
	"github.com/Ayush3941/gitrank/services/scoring-engine/internal/httpapi"
	"github.com/Ayush3941/gitrank/services/scoring-engine/internal/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

const version = "dev"

func main() {
	cfg, err := config.Load("scoring-engine", "SCORING_ENGINE_ADDR")
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

	if err := cfg.ValidateScoringService(); err != nil {
		panic(err)
	}

	dbpool, err := pgxpool.New(ctx, cfg.Database.URL)
	if err != nil {
		panic(err)
	}
	defer dbpool.Close()

	scoringService, err := service.New(cfg, dbpool, log)
	if err != nil {
		panic(err)
	}

	server := httpkit.NewServer(cfg.Addr, httpapi.NewRouter(cfg, scoringService, log, version), cfg.ShutdownTimeout, log)
	log.Info("starting service", "addr", cfg.Addr, "version", version)
	if err := server.Run(ctx); err != nil {
		log.Error("server exited", "error", err)
		os.Exit(1)
	}
}
