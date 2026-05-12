# Sync Backlog Runbook

Use this runbook when:

- `GitRankSyncBacklogHigh` fires
- `GitRankSchedulerDeadLettersPresent` fires
- `GitRankWebhookFailuresPresent` fires

## Immediate Checks

1. Inspect `github-ingestor /metrics` for:
   - `gitrank_queue_depth`
   - `gitrank_queue_dead_letters`
   - `gitrank_webhook_deliveries_tracked`
2. Inspect `scheduler-worker /metrics` for:
   - `gitrank_scheduler_queue_depth`
   - `gitrank_scheduler_dead_letters`
   - `gitrank_scheduler_job_failures_total`
3. Confirm whether the pressure is new work, stuck work, or repeated poison jobs.

## Triage

- If backlog is growing but dead letters stay flat:
  - increase worker attention on the scheduler side
  - check whether manual syncs or recurring backfills were recently enabled
- If dead letters are growing:
  - inspect failing job payloads via scheduler queue inspection
  - replay only after identifying whether the failure is transient or deterministic
- If webhook failures are present:
  - confirm GitHub signature validation and payload parsing are still succeeding
  - verify the delivery store is writable if PostgreSQL delivery persistence is enabled

## Mitigation

- Pause noisy recurring backfill plans if they are starving fresher work.
- Replay dead letters after the root cause is fixed, using
  `docs/runbooks/dead-letter-replay.md` for stage-specific checks.
- Requeue failed webhook deliveries using the ingestor recovery route.

## Exit Criteria

- queue depth trends back toward normal
- dead-letter count stabilizes or drops
- no new failed webhook deliveries appear for one alert window
