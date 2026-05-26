# Repository Map

This top-level map keeps navigation simple without changing service runtime paths.

## Start Here

- Product + policy baseline: [`CONTRIBUTING.md`](../CONTRIBUTING.md)
- Local setup and run: [`README.md`](../README.md)
- Backend workspace guide: [`gitrank/README.md`](../gitrank/README.md)
- Frontend guide: [`frontend/README.md`](../frontend/README.md)

## Code Areas

- Frontend app: [`frontend/`](../frontend)
- Backend services and shared Go packages: [`gitrank/`](../gitrank)
- GitHub workflows and repo policy: [`.github/`](../.github)

## Operational Docs

- Architecture docs: [`gitrank/docs/`](../gitrank/docs)
- Release and readiness artifacts: [`gitrank/docs/releases/`](../gitrank/docs/releases)
- Research notes and local paper references: [`docs/research/`](./research)
- Simplified repo tree snapshot: [`docs/REPO_TREE.md`](./REPO_TREE.md)

## Tree Maintenance

- Regenerate the simplified tree snapshot with:
  - `./scripts/generate-repo-tree.sh`
- Default output is depth-limited and rendered from tracked git paths so local runtime artifacts never pollute navigation docs.

## Repo Sync Audit

- Run `./scripts/check-repo-sync.sh` before finalizing structural/doc changes.
- It verifies:
  - no tracked runtime/generated clutter files (including cache trees such as `.tmp`, `.gocache`, `node_modules`, and `.next`)
  - no stale research filename references
  - root tree cleanliness for large binary references
  - `docs/REPO_TREE.md` freshness
  - markdown command drift guards (`frontend/package.json` npm scripts and `gitrank/Makefile` targets)
  - markdown script-path references for both repo-root and `gitrank/` workspace command contexts
  - markdown `go test/run/build/vet` path references against current repo paths
  - machine-specific absolute path leakage in primary docs (for example user-home absolute paths on Linux/macOS/Windows)
  - runtime identity hygiene (no personal/demo identity literals in production frontend/backend code paths)
  - markdown env-variable references aligned with supported env examples/script-level variables
  - `gitrank/Makefile` script-target references aligned with tracked executable `gitrank/scripts/*.sh`
  - workflow `run` script references in `.github/workflows/*` aligned with tracked executable scripts
  - workflow `make <target>` references in `.github/workflows/*` aligned with `gitrank/Makefile` targets
  - workflow `npm run <script>` references in `.github/workflows/*` aligned with `frontend/package.json` scripts
  - markdown relative-link integrity across tracked docs

## Navigation Rule

If you are editing behavior:

1. UI and UX changes start in `frontend/`.
2. API contract or service behavior changes start in `gitrank/services/`.
3. Cross-service contracts start in `gitrank/packages/contracts/`.
