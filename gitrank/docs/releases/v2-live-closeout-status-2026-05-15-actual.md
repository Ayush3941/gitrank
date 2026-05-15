# V2 Live Closeout Status

- Generated at (UTC): `2026-05-15T20:11:56Z`
- Repository: `Ayush3941/gitrank`
- Workdir: `/home/kali/Desktop/gitrank/gitrank`

## Branch Divergence

- Exit code: `0`

```text
## main...origin/main [ahead 86]
 M gitrank/scripts/verify_v2_completion_audit_behavior.sh
?? gitrank/docs/releases/v2-completion-audit-2026-05-15-actual.md
?? gitrank/docs/releases/v2-live-closeout-status-2026-05-15-actual.md
?? gitrank_abstract.pdf

left-right count (origin/main...HEAD): 0	86

recent divergent commits:
> 0fa028d (HEAD -> main) docs(v2): document current github app installation blocker
> f335cfe docs(v2): refresh remaining live-gates snapshot
> def8fb6 docs(v2): add local observability and k8s runtime evidence
> 89bbbbc docs(v2): record rollback and restore drill evidence
> 4091ede feat(frontend): apply neon cyberpunk theme across shared UI
> 66fbc4a chore(v2): simplify env-file finalizer and closeout hints
> 32b707b docs(v2): mark ABRA complete and add closeout evidence
> 6aa12af chore(frontend): track env example for ABRA insight config
> edd416f feat(frontend): ship ABRA insights and neon cyberpunk UX
> cf90762 docs: add ABRA presentation upgrade checklist
> 5974528 chore(v2): align closeout hints with env-file finalizer flow
> bab88f1 chore(v2): support env-file loading in finalizer
> a6afd2f chore(v2): add live env bootstrap hints to checklist audit
> 46aa176 chore(v2): point live gate input failures to env template
> 08300bf chore(v2): paginate github app repository scope checks
> 326113b chore(v2): add public workflow health probe to audit snapshot
> 0938a97 chore(v2): add app scope precheck to workflow health gate
> 1708a00 chore(v2): expose origin-push readiness in live env snapshots
> a546e68 chore(v2): add trivy sync fallback and app scope preflight
> 0ae5600 chore(v2): preflight remote workflow sync access paths
> 3f9a37a chore(v2): surface push-auth fallback in workflow sync gate
> 370d841 chore(v2): add app installation scope checks to controls gates
> 29c6a79 chore(v2): fail fast on github app repo-scope mismatch
> 668a044 chore(v2): include push preflight in controls remediation
> b83ca30 chore(v2): add origin push-access preflight for live gates
> 4f298de chore(v2): enrich public probe snapshot with sync and badge signals
> 2cacf8f chore(v2): improve remote workflow sync remediation hints
> 1fafa1d docs(v2): refresh live-gates snapshot with current blockers
> 7034de4 chore(v2): add badge signal to workflow-run probe failures
> b72c184 chore(v2): clarify zero-rules controls failure signal
```

## Local Readiness Gate

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

## Contributing Checklist Audit

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

## Checklist Audit Artifact

- File: `/home/kali/Desktop/gitrank/gitrank/.tmp/v2-closeout-status-audit.192402.md`

```markdown
# V2 Contributing Audit Report

Status: fail
Unchecked items: 11
Contributing file: /home/kali/Desktop/gitrank/CONTRIBUTING.md

## Unresolved Items
- bootstrap hint: CONFIRM_FINALIZE_V2=yes make -C /home/kali/Desktop/gitrank/gitrank finalize-v2-live-closeout-local-env
- line 63: - [ ] Production observability exists.
  remediation: run make verify-live-observability and provide live observability evidence file
- line 777: - [ ] enable dependency graph
  remediation: run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
- line 778: - [ ] enable Dependabot alerts
  remediation: run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
- line 783: - [ ] protect the default branch or apply repository rulesets
  remediation: run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
- line 784: - [ ] require pull request review before merge
  remediation: run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
- line 785: - [ ] require status checks before merge
  remediation: run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
- line 966: - [ ] enforce required checks before merge
  remediation: run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
- line 967: - [ ] prevent direct pushes to protected branches
  remediation: run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
- line 1077: - [ ] default branch protections or rulesets are enforced
  remediation: run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run
- line 1246: - [ ] Deploy and verify production observability against real traffic, including sync, analysis, scoring, profile, quest, PR report, leaderboard, queue, GitHub, and AI dashboards. `make verify-live-observability` now automates Prometheus target/rule/metric checks plus Grafana dashboard presence, and `.github/workflows/verify-live-v2-gates.yml` can run it in GitHub Actions, but live endpoint credentials and traffic are still required.
  remediation: run make verify-live-observability with live endpoints, or verify live-gates workflow evidence and generate a record with make generate-observability-evidence-from-workflow-run
- line 1247: - [ ] Apply and verify live GitHub repository controls before V2 release branches are cut. `.github/workflows/verify-live-v2-gates.yml` can run auto-apply plus verification (`apply_github_controls=true`) with `GITRANK_REPO_ADMIN_TOKEN`.
  remediation: run make verify-origin-push-access + make verify-live-github-access (token/App preflight) and make verify-github-repository-controls-public (precheck), then apply/verify via make apply-github-repository-controls-auto + make verify-github-repository-controls (admin token or GitHub App creds), or verify successful live-gates workflow evidence via make verify-live-v2-workflow-run

## Public Probe Snapshot
- repository: Ayush3941/gitrank
- repo metadata http: 200
- default branch: main
- branch metadata http: 200
- default branch protected: false
- branch rules http: 200
- branch rules count: 0
- live-gates workflow runs http: 200
- live-gates workflow run count: 0
- live-gates workflow badge status: no status
- live-gates workflow badge url: https://github.com/Ayush3941/gitrank/actions/workflows/verify-live-v2-gates.yml/badge.svg?event=workflow_dispatch&branch=main
- remote workflow sync probe: fail
- remote workflow sync summary: verify remote live-v2 workflow sync failed: remote workflow content drift detected via raw fallback for .github/workflows/verify-live-v2-gates.yml on Ayush3941/gitrank@main (remote_url=https://raw.githubusercontent.com/Ayush3941/gitrank/main/.github/workflows/verify-live-v2-gates.yml; local_commit=59850392a08efc810397a6c81082d65d58d5d9c7 local_dirty=no; sync by pushing the local branch to origin (for example: git push origin main) or run make sync-remote-live-v2-workflow with token/App credentials)
- origin push access probe: fail
- origin push access summary: origin push access verification failed: missing HTTPS git credentials for remote 'origin'; configure a credential helper or PAT-backed remote and retry
- public workflow health probe: pass
- public workflow health summary: public workflow health verification passed for Ayush3941/gitrank (push/main)
- controls public probe: fail
- controls public probe summary: github repository controls public verification failed: default branch is neither protected nor covered by branch rulesets; dependency graph appears disabled in public repository UI (verification_mode=public-partial dependabot_status=requires-token dependency_graph_status=public-ui-disabled)

## Env Presence Snapshot
- derived.auth_mode: none
- derived.has_app_bootstrap: false
- derived.workflow_sync_credential_readiness: unavailable
- derived.origin_push_access_readiness: unavailable
- derived.workflow_sync_execution_path: unavailable
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

## Public Workflow Health Gate

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

## Remote Live V2 Workflow Sync

- Exit code: `2`

```text
make[1]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_remote_live_v2_workflow_sync.sh
verify remote live-v2 workflow sync failed: remote workflow content drift detected via raw fallback for .github/workflows/verify-live-v2-gates.yml on Ayush3941/gitrank@main (remote_url=https://raw.githubusercontent.com/Ayush3941/gitrank/main/.github/workflows/verify-live-v2-gates.yml; local_commit=59850392a08efc810397a6c81082d65d58d5d9c7 local_dirty=no; sync by pushing the local branch to origin (for example: git push origin main) or run make sync-remote-live-v2-workflow with token/App credentials)
make[1]: *** [Makefile:127: verify-remote-live-v2-workflow-sync] Error 1
make[1]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
```

## Live GitHub Access Preflight

- Exit code: `2`

```text
make[1]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_live_github_access.sh
live github access verification failed: GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required (or set GitHub App credentials)
make[1]: *** [Makefile:84: verify-live-github-access] Error 1
make[1]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
```

## Public GitHub Controls Precheck

- Exit code: `2`

```text
make[1]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_github_repository_controls_public.sh
github repository controls public verification failed: default branch is neither protected nor covered by branch rulesets; dependency graph appears disabled in public repository UI (verification_mode=public-partial dependabot_status=requires-token dependency_graph_status=public-ui-disabled)
make[1]: *** [Makefile:177: verify-github-repository-controls-public] Error 1
make[1]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
```

## Latest Workflow Evidence Probe

- Exit code: `2`

```text
make[1]: Entering directory '/home/kali/Desktop/gitrank/gitrank'
TMPDIR="/home/kali/Desktop/gitrank/gitrank/.tmp" ./scripts/verify_live_v2_workflow_run.sh
live v2 workflow run verification failed: workflow-run read hit GitHub API rate limit (HTTP 403); provide GITHUB_TOKEN, GH_TOKEN, GITRANK_REPO_ADMIN_TOKEN, or GitHub App credentials
make[1]: *** [Makefile:121: verify-live-v2-workflow-run] Error 1
make[1]: Leaving directory '/home/kali/Desktop/gitrank/gitrank'
```

## Next Command Plan

1. Populate live environment inputs and export them.
Current missing vars: `PROMETHEUS_BASE_URL, GRAFANA_BASE_URL, GRAFANA_API_TOKEN, OBS_EVIDENCE_FILE, ROLLBACK_EVIDENCE_FILE, RESTORE_EVIDENCE_FILE, IMAGE_TAG, IMAGE_REGISTRY_OWNER, STAGING_K8S_PUBLIC_BASE_URL, PRODUCTION_K8S_PUBLIC_BASE_URL, STAGING_K8S_API_BASE_URL, PRODUCTION_K8S_API_BASE_URL, STAGING_K8S_AUTH_COOKIE_DOMAIN, PRODUCTION_K8S_AUTH_COOKIE_DOMAIN, STAGING_K8S_GITHUB_OAUTH_REDIRECT_URL, PRODUCTION_K8S_GITHUB_OAUTH_REDIRECT_URL, STAGING_K8S_API_HOST, PRODUCTION_K8S_API_HOST, STAGING_K8S_AUTH_HOST, PRODUCTION_K8S_AUTH_HOST, STAGING_K8S_TLS_SECRET_NAME, PRODUCTION_K8S_TLS_SECRET_NAME, GITRANK_REPO_ADMIN_TOKEN_OR_GITHUB_TOKEN_OR_GH_TOKEN_OR_GITHUB_APP_CREDENTIALS`.
REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES: `true`.
For auth-required commands, use either `GITRANK_REPO_ADMIN_TOKEN` (or `GITHUB_TOKEN`) or GitHub App credentials (`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and private key).

2. Run public workflow-health check and clear failing origin workflows.

```bash
cd gitrank
GITHUB_REPOSITORY=Ayush3941/gitrank make verify-public-workflow-health
```

3. If Trivy workflow-health fails because remote policy files drift, sync them.

```bash
cd gitrank
GITHUB_REPOSITORY=Ayush3941/gitrank \
GITRANK_REPO_ADMIN_TOKEN=... \
make sync-remote-trivy-policy
```

4. Run token access preflight for GitHub controls/workflow evidence.

```bash
cd gitrank
GITHUB_REPOSITORY=Ayush3941/gitrank \
GITRANK_REPO_ADMIN_TOKEN=... \
make verify-live-github-access
```

5. Run public controls precheck and fix branch protection first if needed.

```bash
cd gitrank
GITHUB_REPOSITORY=Ayush3941/gitrank make verify-github-repository-controls-public
```

6. Verify the remote live-gates workflow file is present and in sync.

```bash
cd gitrank
GITHUB_REPOSITORY=Ayush3941/gitrank make verify-remote-live-v2-workflow-sync
```

7. Sync the live-gates workflow file to remote default branch if sync verification or dispatch/evidence probes report it missing or stale.

```bash
cd gitrank
GITHUB_REPOSITORY=Ayush3941/gitrank \
GITRANK_REPO_ADMIN_TOKEN=... \
make sync-remote-live-v2-workflow
```

8. Run live-gates workflow evidence pipeline.

```bash
cd gitrank
CONFIRM_RUN_LIVE_V2_PIPELINE=yes \
GITHUB_REPOSITORY=Ayush3941/gitrank \
GITRANK_REPO_ADMIN_TOKEN=... \
TARGET_ENVIRONMENT=staging \
RUN_GITHUB_CONTROLS=true \
RUN_OBSERVABILITY=true \
RUN_RELEASE_RENDER=true \
ENVIRONMENT=staging \
CLUSTER=your-cluster \
NAMESPACE=gitrank \
OPERATOR=your-name \
make run-live-v2-workflow-evidence-pipeline
```

If dispatch credentials are not available, you can use the scoped push trigger on `.github/workflows/verify-live-v2-gates.yml` (runs only when that workflow file changes on `main`):

```bash
git add .github/workflows/verify-live-v2-gates.yml
git commit -s -m "ci(v2): trigger scoped live gates run"
git push origin main
cd gitrank
GITHUB_REPOSITORY=Ayush3941/gitrank WORKFLOW_EVENT=any make verify-live-v2-workflow-run
```

If workflow evidence verification reports no successful `workflow_dispatch` run, retry the verifier across all events:

```bash
cd gitrank
GITHUB_REPOSITORY=Ayush3941/gitrank \
WORKFLOW_EVENT=any \
make verify-live-v2-workflow-run
```

9. Generate rollback and restore drill evidence (or provide equivalent real drill records).

```bash
cd gitrank
OUTPUT_FILE=docs/evidence/rollback-drill-YYYY-MM-DD.txt \
ENVIRONMENT=staging CLUSTER=your-cluster NAMESPACE=gitrank OPERATOR=your-name \
STARTING_COMMIT=<sha> CANDIDATE_COMMIT=<sha> ROLLBACK_TARGET_REVISION=<revision> \
DATABASE_BACKUP_MARKER=<backup-id> WORKFLOW_RUN_URL=https://github.com/Ayush3941/gitrank/actions/runs/<id> \
ROLLOUT_HISTORY_CAPTURED=yes ROLLBACK_MODE=workflow ROLLOUT_STATUS_RESULTS=healthy \
CRITICAL_PRODUCT_CHECKS=pass make generate-rollback-drill-evidence

OUTPUT_FILE=docs/evidence/database-restore-drill-YYYY-MM-DD.txt \
ENVIRONMENT=staging CLUSTER=your-cluster NAMESPACE=gitrank OPERATOR=your-name \
RESTORE_SOURCE=managed-backup RESTORE_TARGET=staging-db BACKUP_IDENTIFIER=<backup-id> \
RESTORE_START_TIMESTAMP=2026-05-12T10:00:00Z RESTORE_COMPLETION_TIMESTAMP=2026-05-12T10:15:00Z \
RESTORE_COMMAND_OR_WORKFLOW=workflow SCHEMA_MIGRATION_STATE=up-to-date CRITICAL_PRODUCT_CHECKS=pass \
make generate-database-restore-drill-evidence
```

10. Finalize checklist marking and re-audit.

Recommended path (env file):

```bash
cd gitrank
cp .env.v2-live-gates.example .env.v2-live-gates.local
# edit values, then run:
CONFIRM_FINALIZE_V2=yes \
make finalize-v2-live-closeout-local-env
```

Advanced explicit override path:

```bash
cd gitrank
CONFIRM_FINALIZE_V2=yes VERIFY_FROM_WORKFLOW=true RUN_GITHUB_CONTROLS=true RUN_OBSERVABILITY=true RUN_K8S_RUNTIME=true RUN_ROLLBACK_RESTORE=true \
REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES=true \
STAGING_K8S_PUBLIC_BASE_URL=https://staging.example \
PRODUCTION_K8S_PUBLIC_BASE_URL=https://prod.example \
STAGING_K8S_API_BASE_URL=https://api.staging.example \
PRODUCTION_K8S_API_BASE_URL=https://api.prod.example \
STAGING_K8S_AUTH_COOKIE_DOMAIN=.staging.example \
PRODUCTION_K8S_AUTH_COOKIE_DOMAIN=.prod.example \
STAGING_K8S_GITHUB_OAUTH_REDIRECT_URL=https://auth.staging.example/oauth/github/callback \
PRODUCTION_K8S_GITHUB_OAUTH_REDIRECT_URL=https://auth.prod.example/oauth/github/callback \
STAGING_K8S_API_HOST=api.staging.example \
PRODUCTION_K8S_API_HOST=api.prod.example \
STAGING_K8S_AUTH_HOST=auth.staging.example \
PRODUCTION_K8S_AUTH_HOST=auth.prod.example \
STAGING_K8S_TLS_SECRET_NAME=staging-tls \
PRODUCTION_K8S_TLS_SECRET_NAME=production-tls \
OBS_EVIDENCE_FILE=docs/evidence/observability-live-YYYY-MM-DD.txt \
ROLLBACK_EVIDENCE_FILE=docs/evidence/rollback-drill-YYYY-MM-DD.txt \
RESTORE_EVIDENCE_FILE=docs/evidence/database-restore-drill-YYYY-MM-DD.txt \
make finalize-v2-live-closeout
```

### Probe Exit Codes

- Branch divergence probe: `0`
- Local readiness: `2`
- Contributing audit: `2`
- Checklist audit public probe mode: `true` (configured: `auto`)
- Env presence probe: `0`
- Public workflow health: `0`
- Public workflow health mode: `true` (configured: `auto`)
- Remote live workflow sync: `2`
- Live GitHub access preflight: `2`
- GitHub App permission snapshot: `skip`
- Public controls precheck: `2`
- Workflow evidence probe: `2`

