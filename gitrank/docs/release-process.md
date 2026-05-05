# Release Process

This process applies once deployable artifacts exist.

## Release Preconditions

- all required CI checks are green
- migrations are reviewed
- rollback notes exist
- release notes are drafted
- security-critical changes are called out explicitly

## Release Steps

1. Tag the release from a reviewed commit on the protected default branch.
2. Build artifacts in CI, not on a maintainer laptop.
3. Generate checksums and SBOMs.
4. Sign artifacts.
5. Publish release notes with migrations, config changes, and operational risks.
6. Deploy to staging first.
7. Verify health checks, logs, dashboards, and critical flows.
8. Promote to production.

## Rollback

- rollback application code first if possible
- never skip migration compatibility review
- preserve incident notes in a release issue or runbook update
