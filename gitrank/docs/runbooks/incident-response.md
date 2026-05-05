# Incident Response Runbook

## Trigger Conditions

Use this runbook for:

- security incidents
- webhook ingestion failures at scale
- corrupted scores or bad bulk re-scoring
- broken auth or session flows

## First Steps

1. Identify blast radius.
2. Stop further damage.
3. Preserve evidence.
4. Communicate status.

## Service-Specific Immediate Actions

### Webhook abuse or replay suspicion

- disable or isolate the webhook consumer
- preserve recent delivery IDs and request logs
- rotate the webhook secret if compromise is possible

### OAuth or session compromise suspicion

- rotate session or JWT signing material
- invalidate active sessions if required
- audit recent auth events

### Scoring corruption

- pause score recomputation jobs
- identify affected score version or deployment
- restore from score events or snapshots after root-cause analysis

## After Action

- write a timeline
- document root cause
- add tests or controls to prevent recurrence
- update this runbook if it was incomplete
