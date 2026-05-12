SHELL := /bin/sh
TMPDIR ?= $(CURDIR)/.tmp
GOCACHE ?= $(CURDIR)/.gocache
GO_MODULE_FIND := find . \( -path './.tmp' -o -path './.gocache' \) -prune -o -name go.mod

.PHONY: fmt test test-migrations test-critical-path-flows race vet audit-go-safety verify-critical-path-tests verify-v2-no-mock-release-gate verify-rollback-procedure verify-observability-manifests verify-secret-policy apply-github-repository-controls verify-github-repository-controls bench-ingestion tidy compose-up compose-down seed-local

fmt:
	mkdir -p "$(TMPDIR)" "$(GOCACHE)"
	$(GO_MODULE_FIND) -execdir sh -c 'go fmt ./...' \;

test:
	mkdir -p "$(TMPDIR)" "$(GOCACHE)"
	$(GO_MODULE_FIND) -execdir sh -c 'TMPDIR="$(TMPDIR)" GOCACHE="$(GOCACHE)" go test ./...' \;

test-migrations:
	TMPDIR="$(TMPDIR)" ./scripts/test_migrations.sh

test-critical-path-flows:
	TMPDIR="$(TMPDIR)" GOCACHE="$(GOCACHE)" ./scripts/test_critical_path_flows.sh

race:
	mkdir -p "$(TMPDIR)" "$(GOCACHE)"
	$(GO_MODULE_FIND) -execdir sh -c 'TMPDIR="$(TMPDIR)" GOCACHE="$(GOCACHE)" go test -race ./...' \;

vet:
	mkdir -p "$(TMPDIR)" "$(GOCACHE)"
	$(GO_MODULE_FIND) -execdir sh -c 'TMPDIR="$(TMPDIR)" GOCACHE="$(GOCACHE)" go vet ./...' \;

audit-go-safety:
	./scripts/audit_go_safety.sh

verify-critical-path-tests:
	TMPDIR="$(TMPDIR)" ./scripts/verify_critical_path_tests.sh

verify-v2-no-mock-release-gate:
	TMPDIR="$(TMPDIR)" ./scripts/verify_v2_no_mock_release_gate.sh

verify-rollback-procedure:
	TMPDIR="$(TMPDIR)" ./scripts/verify_rollback_procedure.sh

verify-observability-manifests:
	TMPDIR="$(TMPDIR)" ./scripts/verify_observability_manifests.sh

verify-secret-policy:
	TMPDIR="$(TMPDIR)" ./scripts/verify_secret_policy.sh

apply-github-repository-controls:
	TMPDIR="$(TMPDIR)" ./scripts/apply_github_repository_controls.sh

verify-github-repository-controls:
	TMPDIR="$(TMPDIR)" ./scripts/verify_github_repository_controls.sh

bench-ingestion:
	mkdir -p "$(TMPDIR)" "$(GOCACHE)"
	TMPDIR="$(TMPDIR)" GOCACHE="$(GOCACHE)" go test ./services/github-ingestor/internal/service -run '^$$' -bench 'BenchmarkPersistWebhookPullRequestThroughput' -benchmem

tidy:
	$(GO_MODULE_FIND) -execdir go mod tidy \;

compose-up:
	cd deployments/compose && docker compose up -d

compose-down:
	cd deployments/compose && docker compose down -v

seed-local:
	./scripts/seed_local_dev.sh
