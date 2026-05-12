# Dead-Letter Replay Runbook

Use this runbook when `GitRankSchedulerDeadLettersPresent` fires or when a
V2 pipeline stage has stopped making progress after exhausting retries.

## Current Replay Endpoint

Scheduler dead letters are listed and replayed through `scheduler-worker`:

```sh
curl -sS "$SCHEDULER_WORKER_BASE_URL/v1/jobs/dead-letters"
curl -X POST "$SCHEDULER_WORKER_BASE_URL/v1/jobs/dead-letters/$RECORD_ID/replay"
```

Replay creates a new queued job from the dead-letter record. It must only be
used after the root cause has been identified, because deterministic payload
errors will dead-letter again.

## Pre-Replay Checklist

- Confirm the alerting service, job type, correlation ID, subject, repository,
  delivery ID, and last error from the dead-letter record.
- Check whether the failure is transient, deterministic, rate-limit driven, or
  caused by missing upstream evidence.
- Confirm the affected stage can be replayed idempotently without creating
  duplicate GitHub entities, score events, profile snapshots, quest rewards, or
  report rows.
- Prefer replaying the narrowest failed record over running a broad backfill.
- Preserve the original dead-letter record and include the replay request ID in
  the incident notes.

## Stage Matrix

| Stage | Current job or recovery target | Replay rule | Duplicate-safety check |
| --- | --- | --- | --- |
| GitHub sync | `sync.repository`, `sync.user_history`, `sync.installation`, `sync.issue`, `sync.commit` | Replay through the scheduler dead-letter endpoint after API credentials, rate limits, and database writes are healthy. | GitHub IDs and sync-run IDs must upsert idempotently. |
| PR file-feature extraction | `sync.pull_request` and `sync.review` | Replay the failed PR-surface job; bounded file metadata and diff features are extracted during direct PR sync. | `pull_request_files` must stay unique per PR/path and must not store full file contents. |
| PR analysis | Future `analysis.pull_request` worker stage | Replay only after validating the normalized PR payload, analyzer version, prompt/model metadata, and size/cost limit result. | `contribution_analyses` must key by PR plus analyzer/prompt/model/source version. |
| Scoring | Current manual `POST /v1/score/users/{user_id}/replay`; future `score.replay_user` job | Re-run score replay for the affected user/repository/date scope, or replay the future score job once the analysis artifact exists. | `score_events.event_key` and replay-run linkage must prevent duplicate XP rows. |
| Profile refresh | Current profile snapshot rebuild on read; future `profile.refresh` job | Force a profile read or replay the future profile-refresh job after scoring completes. | Profile snapshots must remain versioned by user, snapshot version, and source watermark. |
| Quest update | Current profile-owned quest read model; future `quest.update` job | Replay only after score history and quest evidence references are present. | Quest completion and reward grants must remain unique per user, quest, and evidence set. |
| PR report materialization | Current live profile-service report read model; future `report.materialize_pr` job | Replay after PR, analysis, score-event, badge, and quest evidence are all present. | Materialized reports must be replaceable from evidence and must expose stale or partial state when inputs are missing. |

## Replay Procedure

1. List dead letters and copy the target `record_id`.
2. Inspect `job_type`, `repository`, `subject`, `correlation_id`, `dedupe_key`,
   `attempts`, and `error_message`.
3. Fix the root cause, such as expired GitHub credentials, unavailable
   Postgres, invalid analyzer input, exhausted rate limit, or a missing
   upstream artifact.
4. Replay one record:

   ```sh
   curl -X POST "$SCHEDULER_WORKER_BASE_URL/v1/jobs/dead-letters/$RECORD_ID/replay"
   ```

5. Lease or run the job through the normal worker path. Do not manually mutate
   evidence rows to "fix" a replay.
6. Verify the downstream artifact for the stage:
   - sync: repository, PR, file, review, issue, or commit rows exist
   - analysis: `contribution_analyses` row exists with valid version metadata
   - scoring: score replay run, score events, badges, and snapshot exist
   - profile: profile snapshot freshness is current
   - quest: quest evidence references and reward grants are linked
   - report: PR report returns complete or explicitly partial evidence state
7. Close the incident only after dead-letter count stops increasing for one
   alert window.

## Escalation

- If replay creates a second dead letter with the same deterministic error,
  stop and fix the data or code path before retrying.
- If multiple stages are dead-lettered for the same PR, replay from the earliest
  missing evidence stage forward.
- If score or quest rewards duplicated, freeze further replays for that user and
  investigate idempotency before continuing.
