SHELL := /bin/sh
TMPDIR ?= $(CURDIR)/.tmp
GOCACHE ?= $(CURDIR)/.gocache
GO_MODULE_FIND := find . \( -path './.tmp' -o -path './.gocache' \) -prune -o -name go.mod

.PHONY: fmt test test-migrations test-critical-path-flows race vet audit-go-safety audit-v2-contributing-checklist generate-v2-completion-audit mark-v2-contributing-live-gates finalize-v2-live-closeout verify-v2-unresolved-checklist-scope verify-contributing-checked-file-refs verify-critical-path-tests verify-v2-no-mock-release-gate verify-v2-staging-seed verify-v2-live-readiness verify-live-v2-inputs report-live-v2-env-presence verify-v2-completion-audit-behavior verify-v2-artifact-redaction verify-live-github-access verify-origin-push-access inspect-github-app-installation-permissions verify-rollback-procedure verify-observability-manifests verify-observability-evidence verify-live-observability generate-observability-evidence-from-workflow-run generate-rollback-drill-evidence generate-database-restore-drill-evidence generate-v2-live-closeout-status verify-live-v2-workflow verify-live-v2-workflow-run verify-public-workflow-health verify-remote-live-v2-workflow-sync sync-remote-trivy-policy sync-remote-live-v2-workflow run-live-v2-gates-workflow run-live-v2-workflow-evidence-pipeline create-github-app-installation-token verify-rollback-drill-evidence verify-database-restore-drill-evidence verify-secret-policy verify-k8s-autoscaling verify-finalize-v2-closeout-env-aliases verify-github-app-token-env-aliases discover-github-required-status-checks apply-github-repository-controls apply-github-repository-controls-auto verify-github-repository-controls verify-github-repository-controls-public render-k8s-release-manifests bench-ingestion tidy compose-up compose-down seed-local seed-v2-staging

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

audit-v2-contributing-checklist:
	TMPDIR="$(TMPDIR)" ./scripts/audit_v2_contributing_checklist.sh

generate-v2-completion-audit:
	TMPDIR="$(TMPDIR)" ./scripts/generate_v2_completion_audit.sh

mark-v2-contributing-live-gates:
	TMPDIR="$(TMPDIR)" ./scripts/mark_v2_contributing_live_gates_complete.sh

finalize-v2-live-closeout:
	TMPDIR="$(TMPDIR)" ./scripts/finalize_v2_live_closeout.sh

verify-v2-unresolved-checklist-scope:
	TMPDIR="$(TMPDIR)" ./scripts/verify_v2_unresolved_checklist_scope.sh

verify-contributing-checked-file-refs:
	TMPDIR="$(TMPDIR)" ./scripts/verify_contributing_checked_file_refs.sh

verify-critical-path-tests:
	TMPDIR="$(TMPDIR)" ./scripts/verify_critical_path_tests.sh

verify-v2-no-mock-release-gate:
	TMPDIR="$(TMPDIR)" ./scripts/verify_v2_no_mock_release_gate.sh

verify-v2-staging-seed:
	TMPDIR="$(TMPDIR)" ./scripts/verify_v2_staging_seed.sh

verify-v2-live-readiness:
	TMPDIR="$(TMPDIR)" ./scripts/verify_v2_live_readiness.sh

verify-live-v2-inputs:
	TMPDIR="$(TMPDIR)" ./scripts/verify_live_v2_inputs.sh

report-live-v2-env-presence:
	INFERRED_GITHUB_REPOSITORY="$${INFERRED_GITHUB_REPOSITORY:-$${GITHUB_REPOSITORY:-}}" TMPDIR="$(TMPDIR)" ./scripts/report_live_v2_env_presence.sh

verify-v2-completion-audit-behavior:
	TMPDIR="$(TMPDIR)" ./scripts/verify_v2_completion_audit_behavior.sh

verify-v2-artifact-redaction:
	TMPDIR="$(TMPDIR)" ./scripts/verify_v2_artifact_redaction.sh

verify-live-github-access:
	TMPDIR="$(TMPDIR)" ./scripts/verify_live_github_access.sh

verify-origin-push-access:
	TMPDIR="$(TMPDIR)" ./scripts/verify_origin_push_access.sh

inspect-github-app-installation-permissions:
	TMPDIR="$(TMPDIR)" ./scripts/inspect_github_app_installation_permissions.sh

verify-rollback-procedure:
	TMPDIR="$(TMPDIR)" ./scripts/verify_rollback_procedure.sh

verify-observability-manifests:
	TMPDIR="$(TMPDIR)" ./scripts/verify_observability_manifests.sh

verify-observability-evidence:
	test -n "$${EVIDENCE_FILE:-}" || (echo "EVIDENCE_FILE is required" >&2; exit 1)
	TMPDIR="$(TMPDIR)" ./scripts/verify_observability_evidence_record.sh "$${EVIDENCE_FILE}"

verify-live-observability:
	TMPDIR="$(TMPDIR)" ./scripts/verify_live_observability.sh

generate-observability-evidence-from-workflow-run:
	TMPDIR="$(TMPDIR)" ./scripts/generate_observability_evidence_from_workflow_run.sh

generate-rollback-drill-evidence:
	TMPDIR="$(TMPDIR)" ./scripts/generate_rollback_drill_evidence.sh

generate-database-restore-drill-evidence:
	TMPDIR="$(TMPDIR)" ./scripts/generate_database_restore_drill_evidence.sh

generate-v2-live-closeout-status:
	TMPDIR="$(TMPDIR)" ./scripts/generate_v2_live_closeout_status.sh

verify-live-v2-workflow:
	TMPDIR="$(TMPDIR)" ./scripts/verify_live_v2_workflow.sh

verify-live-v2-workflow-run:
	TMPDIR="$(TMPDIR)" ./scripts/verify_live_v2_workflow_run.sh

verify-public-workflow-health:
	TMPDIR="$(TMPDIR)" ./scripts/verify_public_workflow_health.sh

verify-remote-live-v2-workflow-sync:
	TMPDIR="$(TMPDIR)" ./scripts/verify_remote_live_v2_workflow_sync.sh

sync-remote-trivy-policy:
	TMPDIR="$(TMPDIR)" ./scripts/sync_remote_trivy_policy.sh

sync-remote-live-v2-workflow:
	TMPDIR="$(TMPDIR)" ./scripts/sync_remote_live_v2_workflow.sh

run-live-v2-gates-workflow:
	TMPDIR="$(TMPDIR)" ./scripts/run_live_v2_gates_workflow.sh

run-live-v2-workflow-evidence-pipeline:
	TMPDIR="$(TMPDIR)" ./scripts/run_live_v2_workflow_evidence_pipeline.sh

create-github-app-installation-token:
	TMPDIR="$(TMPDIR)" ./scripts/create_github_app_installation_token.sh

verify-rollback-drill-evidence:
	test -n "$${EVIDENCE_FILE:-}" || (echo "EVIDENCE_FILE is required" >&2; exit 1)
	TMPDIR="$(TMPDIR)" ./scripts/verify_rollback_drill_record.sh "$${EVIDENCE_FILE}"

verify-database-restore-drill-evidence:
	test -n "$${EVIDENCE_FILE:-}" || (echo "EVIDENCE_FILE is required" >&2; exit 1)
	TMPDIR="$(TMPDIR)" ./scripts/verify_database_restore_drill_record.sh "$${EVIDENCE_FILE}"

verify-secret-policy:
	TMPDIR="$(TMPDIR)" ./scripts/verify_secret_policy.sh

verify-k8s-autoscaling:
	TMPDIR="$(TMPDIR)" ./scripts/verify_k8s_autoscaling.sh

verify-finalize-v2-closeout-env-aliases:
	TMPDIR="$(TMPDIR)" ./scripts/verify_finalize_v2_closeout_env_aliases.sh

verify-github-app-token-env-aliases:
	TMPDIR="$(TMPDIR)" ./scripts/verify_github_app_token_env_aliases.sh

discover-github-required-status-checks:
	TMPDIR="$(TMPDIR)" ./scripts/discover_github_required_status_checks.sh

apply-github-repository-controls:
	TMPDIR="$(TMPDIR)" ./scripts/apply_github_repository_controls.sh

apply-github-repository-controls-auto:
	TMPDIR="$(TMPDIR)" ./scripts/apply_github_repository_controls_auto.sh

verify-github-repository-controls:
	TMPDIR="$(TMPDIR)" ./scripts/verify_github_repository_controls.sh

verify-github-repository-controls-public:
	TMPDIR="$(TMPDIR)" ./scripts/verify_github_repository_controls_public.sh

render-k8s-release-manifests:
	test -n "$${K8S_ENVIRONMENT:-}" || (echo "K8S_ENVIRONMENT is required" >&2; exit 1)
	test -n "$${OUTPUT_FILE:-}" || (echo "OUTPUT_FILE is required" >&2; exit 1)
	TMPDIR="$(TMPDIR)" ./scripts/render_k8s_release_manifests.sh "$${K8S_ENVIRONMENT}" "$${OUTPUT_FILE}"

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

seed-v2-staging:
	./scripts/seed_v2_staging.sh
