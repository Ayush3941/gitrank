# Database Restore Drill Runbook

This runbook validates the restore half of the V2 rollback-and-restore gate.
Rollback validates deployment reversal; this drill validates data recovery from
managed backup or PITR.

Official references:

- PostgreSQL backup and restore: https://www.postgresql.org/docs/current/backup.html

## Scope

- Restore a managed PostgreSQL backup or PITR snapshot into a staging or
  production-like recovery target.
- Confirm GitRank migrations and critical API flows remain consistent after
  restore.
- Record concrete evidence for release readiness.

## Preconditions

- A recent backup or PITR marker exists for the target environment.
- Restore permissions are available for the managed PostgreSQL provider.
- A recovery target database or temporary staging restore target is available.
- Application deployments are available to run post-restore checks.

## Procedure

1. Record environment, cluster, namespace, operator, backup identifier, and
   intended restore target.
2. Trigger managed restore (backup restore or PITR) using the provider
   workflow.
3. Capture restore start and completion timestamps.
4. Re-point staging services or temporary validation tooling to the restored
   database target.
5. Run migration status check to ensure schema consistency:

   ```bash
   cd gitrank
   DATABASE_URL=postgres://... ./scripts/migrate.sh status
   ```

6. Run critical post-restore checks:
   - OAuth callback endpoint responds as expected.
   - Authenticated profile fetch succeeds.
   - Sync trigger endpoint returns accepted or controlled throttling.
   - Leaderboard/profile read models return parsable payloads.
7. Record observed errors and follow-up actions.

## Evidence Record

Start from:

```bash
cp docs/evidence/database-restore-drill-template.txt docs/evidence/database-restore-drill-YYYY-MM-DD.txt
```

Validate before marking restore-drill completion:

```bash
make verify-database-restore-drill-evidence EVIDENCE_FILE=docs/evidence/database-restore-drill-YYYY-MM-DD.txt
```

Attach the completed record to release notes or maintainer operations notes.
