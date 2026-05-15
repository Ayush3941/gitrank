# V2 Completion Audit Matrix

- Generated at (UTC): `2026-05-15T20:11:56Z`
- Repository: `Ayush3941/gitrank`
- Objective: `achieve V2 according to CONTRIBUTING.md`
- Contributing source: `/home/kali/Desktop/gitrank/CONTRIBUTING.md`
- Checklist items found: `585`
- Checked items: `574`
- Unchecked items: `11`

## Success Criteria

1. All checklist items in `CONTRIBUTING.md` are checked.
2. Critical local gates pass (`make verify-v2-live-readiness`).
3. Public origin workflow health is green (`make verify-public-workflow-health`) unless intentionally waived.
4. No unresolved checklist items remain in `make audit-v2-contributing-checklist`.
5. Live-gate preflights and probes are green (or intentionally skipped with explicit waiver):
   - `make verify-remote-live-v2-workflow-sync`
   - `make verify-live-github-access`
   - `make verify-github-repository-controls-public`
   - `make verify-live-v2-workflow-run`
6. Explicit file, command, and gate references in `CONTRIBUTING.md` resolve to real artifacts or real commands.

## Prompt-to-Artifact Checklist

### Unchecked Checklist Lines

| Line | Requirement |
|---|---|
| 63 | - [ ] Production observability exists. |
| 777 | - [ ] enable dependency graph |
| 778 | - [ ] enable Dependabot alerts |
| 783 | - [ ] protect the default branch or apply repository rulesets |
| 784 | - [ ] require pull request review before merge |
| 785 | - [ ] require status checks before merge |
| 966 | - [ ] enforce required checks before merge |
| 967 | - [ ] prevent direct pushes to protected branches |
| 1077 | - [ ] default branch protections or rulesets are enforced |
| 1246 | - [ ] Deploy and verify production observability against real traffic, including sync, analysis, scoring, profile, quest, PR report, leaderboard, queue, GitHub, and AI dashboards. `make verify-live-observability` now automates Prometheus target/rule/metric checks plus Grafana dashboard presence, and `.github/workflows/verify-live-v2-gates.yml` can run it in GitHub Actions, but live endpoint credentials and traffic are still required. |
| 1247 | - [ ] Apply and verify live GitHub repository controls before V2 release branches are cut. `.github/workflows/verify-live-v2-gates.yml` can run auto-apply plus verification (`apply_github_controls=true`) with `GITRANK_REPO_ADMIN_TOKEN`. |

### Explicit File References In CONTRIBUTING

| Line | Reference | Exists |
|---|---|---|
| 1068 | `SECURITY.md` | yes |
| 1128 | `frontend/lib/api/mock-api.ts` | no |
| 1146 | `gitrank/docs/runbooks/dead-letter-replay.md` | yes |
| 1151 | `frontend/lib/mock-data/gitrank.ts` | no |
| 1152 | `frontend/lib/api/mock-api.ts` | no |
| 1163 | `0020_score_event_evidence_backfill.sql` | yes |
| 1164 | `0019_user_badge_evidence_backfill.sql` | yes |
| 1174 | `gitrank/docs/releases/v2-remaining-live-gates.md` | yes |
| 1194 | `.github/workflows/trivy.yml` | yes |
| 1232 | `gitrank/.env.v2-live-gates.example` | yes |
| 1246 | `.github/workflows/verify-live-v2-gates.yml` | yes |
| 1247 | `.github/workflows/verify-live-v2-gates.yml` | yes |
| 1249 | `gitrank/docs/evidence/database-restore-drill-2026-05-15-local.txt` | yes |
| 1249 | `gitrank/docs/evidence/rollback-drill-2026-05-15-local.txt` | yes |
| 1250 | `gitrank/docs/evidence/rendered-k8s-production-2026-05-15.yaml` | yes |
| 1250 | `gitrank/docs/evidence/rendered-k8s-staging-2026-05-15.yaml` | yes |
| 1253 | `gitrank/docs/releases/v2.md` | yes |
| 128 | `README.md` | yes |
| 1288 | `gitrank/docs/releases/abra-closeout.md` | yes |
| 129 | `gitrank/README.md` | yes |
| 1294 | `CODEOWNERS` | yes |
| 1294 | `LICENSE` | yes |
| 1294 | `SECURITY.md` | yes |
| 130 | `gitrank/docs/production-decision-register.md` | yes |
| 1303 | `docs/scoring-model.md` | yes |
| 146 | `README.md` | yes |
| 207 | `go.work` | yes |
| 211 | `gitrank/` | yes |
| 255 | `SECURITY.md` | yes |
| 258 | `CODEOWNERS` | yes |
| 264 | `gitrank/docs/` | yes |
| 270 | `CONTRIBUTING.md` | yes |
| 270 | `SECURITY.md` | yes |
| 276 | `gitrank/docs/MAINTAINER_GUIDE.md` | yes |
| 302 | `gitrank/docs/scoring-model.md` | yes |
| 303 | `gitrank/docs/anti-gaming.md` | yes |
| 304 | `gitrank/docs/fairness-and-limitations.md` | yes |
| 355 | `gitrank/docs/data-model.md` | yes |
| 356 | `gitrank/deployments/` | yes |
| 362 | `gitrank/docs/data-model.md` | yes |
| 363 | `gitrank/docs/privacy-and-data-handling.md` | yes |
| 364 | `gitrank/docs/infrastructure-baseline.md` | yes |
| 370 | `gitrank/services/api-gateway` | yes |
| 406 | `gitrank/services/auth-service` | yes |
| 434 | `gitrank/services/github-ingestor` | yes |
| 49 | `gitrank/README.md` | yes |
| 499 | `gitrank/services/pr-analyzer` | yes |
| 50 | `gitrank/go.work` | yes |
| 542 | `gitrank/services/scoring-engine` | yes |
| 577 | `gitrank/services/profile-service` | yes |
| 604 | `gitrank/services/scheduler-worker` | yes |
| 635 | `gitrank/packages/contracts` | yes |
| 642 | `gitrank/packages/logger` | yes |
| 649 | `gitrank/packages/config` | yes |
| 657 | `gitrank/packages/errors` | yes |
| 663 | `gitrank/packages/events` | yes |
| 670 | `gitrank/packages/authkit` | yes |
| 69 | `gitrank/docs/evidence/observability-live-*.txt` | pattern |
| 69 | `gitrank/docs/runbooks/production-observability.md` | yes |
| 73 | `frontend/` | yes |
| 73 | `gitrank/` | yes |
| 779 | `dependabot.yml` | yes |
| 786 | `CODEOWNERS` | yes |
| 788 | `gitrank/docs/runbooks/github-repository-controls.md` | yes |
| 943 | `gitrank/docs/evidence/rollback-drill-*.txt` | pattern |
| 943 | `gitrank/docs/runbooks/production-rollback-drill.md` | yes |
| 947 | `gitrank/deployments/compose/` | yes |
| 948 | `gitrank/deployments/k8s/` | yes |
| 969 | `gitrank/docs/runbooks/github-repository-controls.md` | yes |
| 973 | `README.md` | yes |

### Explicit `make` Command References In CONTRIBUTING

| Command | Target Present In `gitrank/Makefile` |
|---|---|
| `make apply-github-repository-controls` | yes |
| `make audit-v2-contributing-checklist` | yes |
| `make create-github-app-installation-token` | yes |
| `make discover-github-required-status-checks` | yes |
| `make generate-database-restore-drill-evidence` | yes |
| `make generate-observability-evidence-from-workflow-run` | yes |
| `make generate-rollback-drill-evidence` | yes |
| `make generate-v2-completion-audit` | yes |
| `make generate-v2-live-closeout-status` | yes |
| `make mark-v2-contributing-live-gates` | yes |
| `make render-k8s-release-manifests` | yes |
| `make run-live-v2-gates-workflow` | yes |
| `make run-live-v2-workflow-evidence-pipeline` | yes |
| `make seed-v2-staging` | yes |
| `make sync-remote-trivy-policy` | yes |
| `make test-critical-path-flows` | yes |
| `make verify-contributing-checked-file-refs` | yes |
| `make verify-database-restore-drill-evidence` | yes |
| `make verify-github-repository-controls` | yes |
| `make verify-github-repository-controls-public` | yes |
| `make verify-k8s-autoscaling` | yes |
| `make verify-live-github-access` | yes |
| `make verify-live-observability` | yes |
| `make verify-live-v2-inputs` | yes |
| `make verify-live-v2-workflow-run` | yes |
| `make verify-observability-evidence` | yes |
| `make verify-observability-manifests` | yes |
| `make verify-public-workflow-health` | yes |
| `make verify-rollback-drill-evidence` | yes |
| `make verify-rollback-procedure` | yes |
| `make verify-secret-policy` | yes |
| `make verify-v2-live-readiness` | yes |
| `make verify-v2-no-mock-release-gate` | yes |
| `make verify-v2-staging-seed` | yes |
| `make verify-v2-unresolved-checklist-scope` | yes |

## Local Readiness Gate (make verify-v2-live-readiness)

- Exit code: `2`

```text
make[1]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_v2_live_readiness.sh
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_v2_no_mock_release_gate.sh

> frontend@0.1.0 check:no-production-mocks
> node scripts/check-no-production-mocks.mjs

live v2 workflow verification passed
v2 no-mock release gate passed
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_contributing_checked_file_refs.sh
contributing checked-file reference verification passed
- checked references validated: 33
- required-present refs: 30
- required-absent refs: 3
- wildcard refs skipped: 0
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_v2_unresolved_checklist_scope.sh
v2 unresolved checklist scope verification passed
unchecked items in approved live-gate scope: 11
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_live_v2_workflow.sh
live v2 workflow verification passed
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_observability_manifests.sh
observability manifest verification passed
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_rollback_procedure.sh
rollback procedure verification passed
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_k8s_autoscaling.sh
k8s autoscaling verification passed
- base HPA resources: 8
- verified deployment targets: api-gateway auth-service github-ingestor pr-analyzer profile-service scheduler-worker scheduler-job-worker scoring-engine
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_secret_policy.sh
secret policy verification passed
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_finalize_v2_closeout_env_aliases.sh
finalize-v2-live-closeout env-alias verification passed
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_github_app_token_env_aliases.sh
github-app token env-alias verification passed
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_v2_completion_audit_behavior.sh
v2 completion audit behavior verification passed
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[2]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_v2_artifact_redaction.sh
v2 artifact redaction verification failed: audit report should redact repository label by default (missing pattern: - repository: OWNER/REPO)
make[2]: *** [Makefile:81: verify-v2-artifact-redaction] Error 1
make[2]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
make[1]: *** [Makefile:69: verify-v2-live-readiness] Error 2
make[1]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
```

## Public Workflow Health Gate (make verify-public-workflow-health)

- Exit code: `0`

```text
make[1]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_public_workflow_health.sh
workflow ok: CI (run_id=25874612452 created_at=2026-05-14T17:21:51Z)
workflow ok: Frontend CI (run_id=25874612460 created_at=2026-05-14T17:21:51Z)
workflow ok: Secret Scan (run_id=25874612443 created_at=2026-05-14T17:21:51Z)
workflow ok: CodeQL (run_id=25874612393 created_at=2026-05-14T17:21:51Z)
workflow ok: Trivy Scan (run_id=25874612414 created_at=2026-05-14T17:21:51Z)
public workflow health verification passed for Ayush3941/gitrank (push/main)
make[1]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
```

## Checklist Audit (make audit-v2-contributing-checklist)

- Exit code: `2`

```text
make[1]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/audit_v2_contributing_checklist.sh
v2 contributing audit summary
unchecked items: 11
live env template: /home/kali/Desktop/gitrank/gitrank/.env.v2-live-gates.example
bootstrap hint: cp /home/kali/Desktop/gitrank/gitrank/.env.v2-live-gates.example .env.v2-live-gates.local && edit required values, then run CONFIRM_FINALIZE_V2=yes make -C /home/kali/Desktop/gitrank/gitrank finalize-v2-live-closeout-local-env
63 | - [ ] Production observability exists. | run make verify-live-observability and provide live observability evidence file
777 | - [ ] enable dependency graph | run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
778 | - [ ] enable Dependabot alerts | run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
783 | - [ ] protect the default branch or apply repository rulesets | run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
784 | - [ ] require pull request review before merge | run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
785 | - [ ] require status checks before merge | run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
966 | - [ ] enforce required checks before merge | run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
967 | - [ ] prevent direct pushes to protected branches | run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
1077 | - [ ] default branch protections or rulesets are enforced | run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
1246 | - [ ] Deploy and verify production observability against real traffic, including sync, analysis, scoring, profile, quest, PR report, leaderboard, queue, GitHub, and AI dashboards. `make verify-live-observability` now automates Prometheus target/rule/metric checks plus Grafana dashboard presence, and `.github/workflows/verify-live-v2-gates.yml` can run it in GitHub Actions, but live endpoint credentials and traffic are still required. | run make verify-live-observability with live endpoints, or verify live-gates workflow evidence and generate a record with make generate-observability-evidence-from-workflow-run
1247 | - [ ] Apply and verify live GitHub repository controls before V2 release branches are cut. `.github/workflows/verify-live-v2-gates.yml` can run auto-apply plus verification (`apply_github_controls=true`) with `GITRANK_REPO_ADMIN_TOKEN`. | run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
public probe snapshot
repository: Ayush3941/gitrank
repo metadata http: 200
default branch: main
branch metadata http: 200
default branch protected: false
branch rules http: 200
branch rules count: 0
live-gates workflow runs http: 200
live-gates workflow run count: 0
live-gates workflow badge status: no status
live-gates workflow badge url: https://github.com/Ayush3941/gitrank/actions/workflows/verify-live-v2-gates.yml/badge.svg?event=workflow_dispatch&branch=main
remote workflow sync probe: fail
remote workflow sync summary: verify remote live-v2 workflow sync failed: remote workflow content drift detected via raw fallback for .github/workflows/verify-live-v2-gates.yml on Ayush3941/gitrank@main (remote_url=https://raw.githubusercontent.com/Ayush3941/gitrank/main/.github/workflows/verify-live-v2-gates.yml; local_commit=59850392a08efc810397a6c81082d65d58d5d9c7 local_dirty=no; sync by pushing the local branch to origin (for example: git push origin main) or run make sync-remote-live-v2-workflow with token/App credentials)
origin push access probe: fail
origin push access summary: origin push access verification failed: missing HTTPS git credentials for remote 'origin'; configure a credential helper or PAT-backed remote and retry
public workflow health probe: pass
public workflow health summary: public workflow health verification passed for Ayush3941/gitrank (push/main)
controls public probe: fail
controls public probe summary: github repository controls public verification failed: default branch is neither protected nor covered by branch rulesets; dependency graph appears disabled in public repository UI (verification_mode=public-partial dependabot_status=requires-token dependency_graph_status=public-ui-disabled)
env derived readiness
derived.auth_mode: none
derived.has_app_bootstrap: false
derived.workflow_sync_credential_readiness: unavailable
derived.origin_push_access_readiness: unavailable
derived.workflow_sync_execution_path: unavailable
v2 contributing audit failed: checklist still has unresolved items
make[1]: *** [Makefile:34: audit-v2-contributing-checklist] Error 1
make[1]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
```

## Essential Live Env Presence

- Exit code: `0`

```text
GITHUB_REPOSITORY=set(inferred:Ayush3941/gitrank)
GITRANK_REPO_ADMIN_TOKEN=unset
GITHUB_TOKEN=unset
GH_TOKEN=unset
GITHUB_APP_ID=unset
GITHUB_APP_INSTALLATION_ID=unset
GITHUB_APP_PRIVATE_KEY_FILE=unset
GITHUB_APP_PRIVATE_KEY_PEM=unset
GITRANK_GITHUB_APP_ID=unset
GITRANK_GITHUB_APP_INSTALLATION_ID=unset
GITRANK_GITHUB_APP_PRIVATE_KEY_FILE=unset
GITRANK_GITHUB_APP_PRIVATE_KEY_PEM=unset
PROMETHEUS_BASE_URL=unset
GRAFANA_BASE_URL=unset
GRAFANA_API_TOKEN=unset
OBS_EVIDENCE_FILE=unset
ROLLBACK_EVIDENCE_FILE=unset
RESTORE_EVIDENCE_FILE=unset
IMAGE_TAG=unset
IMAGE_REGISTRY_OWNER=unset
REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES=unset
STAGING_K8S_PUBLIC_BASE_URL=unset
PRODUCTION_K8S_PUBLIC_BASE_URL=unset
STAGING_K8S_API_BASE_URL=unset
PRODUCTION_K8S_API_BASE_URL=unset
STAGING_K8S_AUTH_COOKIE_DOMAIN=unset
PRODUCTION_K8S_AUTH_COOKIE_DOMAIN=unset
STAGING_K8S_GITHUB_OAUTH_REDIRECT_URL=unset
PRODUCTION_K8S_GITHUB_OAUTH_REDIRECT_URL=unset
STAGING_K8S_API_HOST=unset
PRODUCTION_K8S_API_HOST=unset
STAGING_K8S_AUTH_HOST=unset
PRODUCTION_K8S_AUTH_HOST=unset
STAGING_K8S_TLS_SECRET_NAME=unset
PRODUCTION_K8S_TLS_SECRET_NAME=unset
derived.auth_mode=none
derived.has_app_bootstrap=false
derived.workflow_sync_credential_readiness=unavailable
derived.origin_push_access_readiness=unavailable
derived.workflow_sync_execution_path=unavailable
```

## Remote Live V2 Workflow Sync (make verify-remote-live-v2-workflow-sync)

- Exit code: `2`

```text
make[1]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_remote_live_v2_workflow_sync.sh
verify remote live-v2 workflow sync failed: remote workflow content drift detected via raw fallback for .github/workflows/verify-live-v2-gates.yml on Ayush3941/gitrank@main (remote_url=https://raw.githubusercontent.com/Ayush3941/gitrank/main/.github/workflows/verify-live-v2-gates.yml; local_commit=59850392a08efc810397a6c81082d65d58d5d9c7 local_dirty=no; sync by pushing the local branch to origin (for example: git push origin main) or run make sync-remote-live-v2-workflow with token/App credentials)
make[1]: *** [Makefile:127: verify-remote-live-v2-workflow-sync] Error 1
make[1]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
```

## Live GitHub Access Preflight (make verify-live-github-access)

- Exit code: `2`

```text
make[1]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_live_github_access.sh
live github access verification failed: GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required (or set GitHub App credentials)
make[1]: *** [Makefile:84: verify-live-github-access] Error 1
make[1]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
```

## Public GitHub Controls Precheck (make verify-github-repository-controls-public)

- Exit code: `2`

```text
make[1]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_github_repository_controls_public.sh
github repository controls public verification failed: default branch is neither protected nor covered by branch rulesets; dependency graph appears disabled in public repository UI (verification_mode=public-partial dependabot_status=requires-token dependency_graph_status=public-ui-disabled)
make[1]: *** [Makefile:177: verify-github-repository-controls-public] Error 1
make[1]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
```

## Workflow Evidence Probe (make verify-live-v2-workflow-run)

- Exit code: `2`

```text
make[1]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_live_v2_workflow_run.sh
live v2 workflow run verification failed: workflow-run read hit GitHub API rate limit (HTTP 403); provide GITHUB_TOKEN, GH_TOKEN, GITRANK_REPO_ADMIN_TOKEN, or GitHub App credentials
make[1]: *** [Makefile:121: verify-live-v2-workflow-run] Error 1
make[1]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
```

## Completion Verdict Inputs

- Local readiness gate exit code: `2`
- Public workflow health gate exit code: `0`
- Public workflow health mode: `true` (configured: `auto`)
- Checklist audit exit code: `2`
- Checklist audit public probe mode: `true` (configured: `auto`)
- Env presence probe exit code: `0`
- Remote live workflow sync exit code: `2`
- Live GitHub access preflight exit code: `2`
- Public GitHub controls precheck exit code: `2`
- Workflow evidence probe exit code: `2`
- Current unchecked checklist count: `11`

### Probe Waivers

- none

Current audit verdict: **objective not complete**.

