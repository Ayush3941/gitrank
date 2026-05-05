package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/httpkit"
	"github.com/Ayush3941/gitrank/packages/logger"
	"github.com/Ayush3941/gitrank/services/profile-service/internal/httpapi"
	"github.com/Ayush3941/gitrank/services/profile-service/internal/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

const version = "dev"

func main() {
	cfg, err := config.Load("profile-service", "PROFILE_SERVICE_ADDR")
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

	dbpool, err := pgxpool.New(ctx, cfg.Database.URL)
	if err != nil {
		panic(err)
	}
	defer dbpool.Close()

	cache, err := service.NewCache(cfg.Redis.URL)
	if err != nil {
		panic(err)
	}
	defer cache.Close()

	profileService, err := service.New(cfg, dbpool, cache, log)
	if err != nil {
		panic(err)
	}

	server := httpkit.NewServer(cfg.Addr, httpapi.NewRouter(cfg, profileService, log, version), cfg.ShutdownTimeout, log)
	log.Info("starting service", "addr", cfg.Addr, "version", version)
	if err := server.Run(ctx); err != nil {
		log.Error("server exited", "error", err)
		os.Exit(1)
	}
}
