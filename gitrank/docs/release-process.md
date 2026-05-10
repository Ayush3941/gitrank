# Release Process

This process applies once deployable artifacts exist.

## Release Preconditions

- all required CI checks are green
- `scripts/verify_critical_path_tests.sh` passes and the referenced tests still cover OAuth, sync, PR ingestion, analysis, scoring, profile projection, and webhook idempotency paths
- migrations are reviewed
- rollback notes exist
- release notes are drafted
- security-critical changes are called out explicitly

## Build Reproducibility Goals

- build release artifacts in CI from tagged commits, not from maintainer laptops
- pin builder toolchain versions in workflows and container definitions
- generate checksums for published binaries
- keep the release workflow traceable even though signing is deferred in v1

## Release Steps

1. Tag the release from a reviewed commit on the protected default branch.
2. Build artifacts in CI, not on a maintainer laptop.
3. Generate checksums and SBOMs.
4. Publish GitHub Release notes and attached artifacts.
5. Publish OCI images to the configured container registry.
6. Publish release notes with migrations, config changes, and operational risks.
7. Deploy to staging first.
8. Verify health checks, logs, dashboards, and critical flows.
9. Promote to production.

V1 policy note:

- signing and provenance are intentionally deferred until post-v1 hardening

## Rollback

- rollback application code first if possible
- never skip migration compatibility review
- preserve incident notes in a release issue or runbook update
