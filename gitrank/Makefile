SHELL := /bin/sh
TMPDIR ?= $(CURDIR)/.tmp
GOCACHE ?= $(CURDIR)/.gocache

.PHONY: fmt test test-migrations race vet tidy compose-up compose-down seed-local

fmt:
	mkdir -p "$(TMPDIR)" "$(GOCACHE)"
	find . -name go.mod -execdir sh -c 'go fmt ./...' \;

test:
	mkdir -p "$(TMPDIR)" "$(GOCACHE)"
	find . -name go.mod -execdir sh -c 'TMPDIR="$(TMPDIR)" GOCACHE="$(GOCACHE)" go test ./...' \;

test-migrations:
	./scripts/test_migrations.sh

race:
	mkdir -p "$(TMPDIR)" "$(GOCACHE)"
	find . -name go.mod -execdir sh -c 'TMPDIR="$(TMPDIR)" GOCACHE="$(GOCACHE)" go test -race ./...' \;

vet:
	mkdir -p "$(TMPDIR)" "$(GOCACHE)"
	find . -name go.mod -execdir sh -c 'TMPDIR="$(TMPDIR)" GOCACHE="$(GOCACHE)" go vet ./...' \;

tidy:
	find . -name go.mod -execdir go mod tidy \;

compose-up:
	cd deployments/compose && docker compose up -d

compose-down:
	cd deployments/compose && docker compose down -v

seed-local:
	./scripts/seed_local_dev.sh
