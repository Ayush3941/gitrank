SHELL := /bin/sh
TMPDIR ?= $(CURDIR)/.tmp
GOCACHE ?= $(CURDIR)/.gocache

.PHONY: fmt test test-migrations race vet audit-go-safety verify-critical-path-tests verify-rollback-procedure verify-observability-manifests bench-ingestion tidy compose-up compose-down seed-local

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

audit-go-safety:
	./scripts/audit_go_safety.sh

verify-critical-path-tests:
	./scripts/verify_critical_path_tests.sh

verify-rollback-procedure:
	./scripts/verify_rollback_procedure.sh

verify-observability-manifests:
	./scripts/verify_observability_manifests.sh

bench-ingestion:
	mkdir -p "$(TMPDIR)" "$(GOCACHE)"
	TMPDIR="$(TMPDIR)" GOCACHE="$(GOCACHE)" go test ./services/github-ingestor/internal/service -run '^$$' -bench 'BenchmarkPersistWebhookPullRequestThroughput' -benchmem

tidy:
	find . -name go.mod -execdir go mod tidy \;

compose-up:
	cd deployments/compose && docker compose up -d

compose-down:
	cd deployments/compose && docker compose down -v

seed-local:
	./scripts/seed_local_dev.sh
