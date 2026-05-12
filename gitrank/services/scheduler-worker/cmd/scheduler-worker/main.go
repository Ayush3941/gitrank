package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/gitrank/gitrank/packages/config"
	"github.com/gitrank/gitrank/packages/httpkit"
	"github.com/gitrank/gitrank/packages/logger"
	"github.com/gitrank/gitrank/services/scheduler-worker/internal/httpapi"
	"github.com/gitrank/gitrank/services/scheduler-worker/internal/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

const version = "dev"

func main() {
	cfg, err := config.Load("scheduler-worker", "SCHEDULER_WORKER_ADDR")
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

	var (
		scheduler *service.Service
		pool      *pgxpool.Pool
	)
	if cfg.Database.URL != "" {
		pool, err = pgxpool.New(ctx, cfg.Database.URL)
		if err != nil {
			log.Error("scheduler state pool init failed", "error", err)
			os.Exit(1)
		}
		defer pool.Close()

		scheduler, err = service.NewPersistent(cfg, pool)
		if err != nil {
			log.Error("scheduler state restore failed", "error", err)
			os.Exit(1)
		}
	} else {
		scheduler = service.New(cfg)
	}
	if cfg.Scheduler.RunMode != "api" {
		go scheduler.Run(ctx)
	}

	server := httpkit.NewServer(cfg.Addr, httpapi.NewRouter(cfg, scheduler, log, version), cfg.ShutdownTimeout, log)
	log.Info("starting service", "addr", cfg.Addr, "version", version, "scheduler_run_mode", cfg.Scheduler.RunMode)
	if err := server.Run(ctx); err != nil {
		log.Error("server exited", "error", err)
		os.Exit(1)
	}
}
