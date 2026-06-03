# Evidence Records

This directory holds production-readiness evidence templates.

Generated dated evidence records are local or release artifacts, not source
files. The root `.gitignore` excludes generated closeout reports, rendered
Kubernetes manifests, drill records, and observability snapshots by default.
Force-add a generated record only when a release handoff explicitly requires it.

Templates:

- `observability-live-template.txt`
- `rollback-drill-template.txt`
- `database-restore-drill-template.txt`

Validation:

- `make verify-observability-evidence EVIDENCE_FILE=docs/evidence/<file>.txt`
- `make verify-rollback-drill-evidence EVIDENCE_FILE=docs/evidence/<file>.txt`
- `make verify-database-restore-drill-evidence EVIDENCE_FILE=docs/evidence/<file>.txt`

The verifiers fail on missing fields and placeholder values so maintainer
decisions can be tied to concrete operations evidence.
