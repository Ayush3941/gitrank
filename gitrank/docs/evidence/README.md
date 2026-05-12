# Evidence Records

This directory holds templates and optional committed records for production
readiness evidence.

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
