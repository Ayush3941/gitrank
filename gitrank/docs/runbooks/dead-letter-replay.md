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
| PR analysis | `analysis.pull_request` scheduler job or direct `POST /v1/analyze/pull-request/execute` for emergency manual repair | Replay only after validating the normalized PR payload, analyzer version, prompt/model metadata, and size/cost limit result. | Analyzer persistence uses an advisory lock and updates the latest PR plus analyzer/prompt/model/source artifact. |
| Scoring | `score.replay_user` scheduler job or direct `POST /v1/score/users/{user_id}/replay` for emergency manual repair | Replay the failed score job after the analysis artifact exists; use the direct replay endpoint only when the scheduler path itself is unavailable. | `score_events.event_key` and replay-run linkage must prevent duplicate XP rows. |
| Profile refresh | `profile.refresh_user` scheduler job or direct `POST /v1/profile/users/{user_id}/refresh` for emergency manual repair | Replay the failed profile refresh job after score replay succeeds; use the direct refresh endpoint only when the scheduler path itself is unavailable. | Profile snapshots are rebuilt from persisted score and badge evidence and remain versioned by user, snapshot version, and source watermark. |
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
   - scoring: score replay run, score events, badges, and snapshot exist; scheduler run output includes `score_replay.replay_run_id`
   - profile: profile snapshot freshness is current; scheduler run output includes `profile_refresh.profile_snapshot_id`
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
