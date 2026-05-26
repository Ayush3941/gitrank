# GitRank Mermaid Flows

These diagrams describe the main GitRank product and platform flows. Each flow
includes the normal path plus the important degraded or failure paths that the
code and runbooks are designed to surface.

## 1. GitHub OAuth Login

```mermaid
sequenceDiagram
    autonumber
    participant User as User
    participant Frontend as Browser / Next.js
    participant Auth as auth-service
    participant GitHub as GitHub OAuth
    participant DB as PostgreSQL

    User->>Frontend: Open /login
    Frontend->>Auth: GET /oauth/github/start
    Auth->>DB: Store OAuth state + browser token
    Auth-->>Frontend: Authorize URL + OAuth browser cookie
    Frontend-->>User: Redirect to GitHub
    User->>GitHub: Authorize GitRank
    GitHub-->>Frontend: Redirect /oauth/github/callback?code&state
    Frontend->>Auth: GET /oauth/github/callback?code&state
    Auth->>DB: Validate state and mark used
    Auth->>GitHub: Exchange code for user token
    GitHub-->>Auth: Access token + identity scope
    Auth->>GitHub: Fetch user identity and email
    Auth->>DB: Upsert user, GitHub account, encrypted token, session
    Auth-->>Frontend: Session + CSRF cookies
    Frontend-->>User: Redirect to dashboard

    alt OAuth state invalid or expired
        Auth-->>Frontend: 401/400 auth error
        Frontend-->>User: Show login recovery state
    else GitHub denies or code exchange fails
        GitHub-->>Auth: Error or non-2xx token response
        Auth-->>Frontend: OAuth completion error
        Frontend-->>User: Ask user to retry GitHub login
    else Database write fails
        Auth-->>Frontend: 503/500 dependency error
        Frontend-->>User: Surface service unavailable state
    end
```

## 2. Authenticated Dashboard Load

```mermaid
sequenceDiagram
    autonumber
    participant User as User
    participant Frontend as Dashboard UI
    participant BFF as Next.js BFF
    participant Gateway as api-gateway
    participant Auth as auth-service
    participant Profile as profile-service
    participant Redis as Redis
    participant DB as PostgreSQL

    User->>Frontend: Open /dashboard
    Frontend->>BFF: GET /api/profile/me
    BFF->>Gateway: GET /v1/me/profile with cookies
    Gateway->>Auth: GET /v1/session/me
    Auth->>DB: Validate session token hash
    Auth-->>Gateway: Session principal + rotated cookies if needed
    Gateway->>Profile: GET /v1/me/profile
    Profile->>DB: Load user, settings, repo visibility, latest snapshot
    Profile->>Redis: Check private profile cache
    alt Cache hit and snapshot fresh
        Redis-->>Profile: Cached private profile
    else Cache miss or stale
        Profile->>DB: Build response from profile snapshot and recent reports
        Profile->>Redis: Write private profile cache
    end
    Profile-->>Gateway: Private profile response
    Gateway-->>BFF: Private no-store response
    BFF-->>Frontend: Profile JSON
    Frontend-->>User: Render dashboard cards

    alt Session missing or expired
        Auth-->>Gateway: 401 unauthorized
        Gateway-->>BFF: 401
        BFF-->>Frontend: Auth error
        Frontend-->>User: Redirect to /login
    else Profile snapshot cannot rebuild
        Profile-->>Gateway: Existing stale snapshot if available
        Gateway-->>BFF: Staleness metadata
        Frontend-->>User: Render partial/stale dashboard state
    else Profile service dependency fails
        Gateway-->>BFF: 502/503 dependency error
        Frontend-->>User: Render retryable error state
    end
```

## 3. Background Auto-Sync

```mermaid
sequenceDiagram
    autonumber
    participant Frontend as Dashboard UI
    participant BFF as Next.js BFF
    participant Gateway as api-gateway
    participant Ingestor as github-ingestor
    participant Scoring as scoring-engine
    participant Profile as profile-service
    participant GitHub as GitHub API
    participant DB as PostgreSQL

    Frontend->>Frontend: Detect stale authenticated profile
    Frontend->>BFF: POST /api/sync/user with CSRF
    BFF->>Gateway: POST /v1/sync/user/execute
    Gateway->>Gateway: Validate session, CSRF, and rate limit
    Gateway->>Ingestor: POST /v1/sync/user/execute
    Ingestor->>GitHub: Fetch bounded user repositories and authored PRs
    Ingestor->>DB: Persist repositories, PRs, reviews, comments, files
    Ingestor-->>Gateway: Completed sync execution metrics
    Gateway->>Scoring: POST /v1/score/users/{user_id}/replay
    Scoring->>DB: Persist score replay, events, snapshot, badges
    Gateway->>Profile: POST /v1/profile/users/{user_id}/refresh
    Profile->>DB: Persist fresh profile snapshot
    Gateway->>Profile: POST /v1/profile/users/{user_id}/pr-reports/backfill
    Profile->>DB: Materialize recent PR report snapshots
    Gateway->>Profile: POST /v1/profile/users/{user_id}/quests/backfill
    Profile->>DB: Materialize quest evidence
    Gateway-->>BFF: Sync execution response
    BFF-->>Frontend: Sync status
    Frontend->>Frontend: Invalidate dashboard/profile/quest/report caches

    alt CSRF or session validation fails
        Gateway-->>BFF: 403 or 401
        BFF-->>Frontend: Auth recovery state
    else GitHub API rate limited or times out
        GitHub-->>Ingestor: 403/429/timeout
        Ingestor-->>Gateway: Partial or failed sync metrics
        Gateway-->>Frontend: Explicit failure or partial state
    else Post-sync refresh step fails
        Gateway-->>Frontend: Sync completed with post_sync_refresh_failed marker
        Frontend-->>Frontend: Keep stale profile and retry opportunistically
    end
```

## 4. User GitHub Sync

```mermaid
sequenceDiagram
    autonumber
    participant Caller as Gateway or Scheduler
    participant Ingestor as github-ingestor
    participant GitHub as GitHub REST / Search / GraphQL
    participant DB as PostgreSQL

    Caller->>Ingestor: POST /v1/sync/user/execute
    Ingestor->>Ingestor: Normalize GitHub login and bounds
    Ingestor->>DB: Start github_sync_run
    Ingestor->>GitHub: Fetch user-owned repositories
    Ingestor->>GitHub: Search recent authored PRs
    Ingestor->>GitHub: Fetch selected repository and PR details
    Ingestor->>GitHub: Fetch PR reviews, comments, commits, files
    Ingestor->>DB: Upsert accounts, repositories, PR evidence, labels
    Ingestor->>DB: Finish github_sync_run with fetched/persisted metrics
    Ingestor-->>Caller: GitHubSyncExecutionResponse

    alt GitHub search incomplete
        GitHub-->>Ingestor: incomplete_results=true
        Ingestor->>DB: Mark sync metrics as bounded/incomplete
        Ingestor-->>Caller: Completed partial sync response
    else Repository is private or inaccessible
        GitHub-->>Ingestor: 404/403
        Ingestor->>DB: Record skipped or failed target
        Ingestor-->>Caller: Partial result with error context
    else Provider rate limited
        GitHub-->>Ingestor: 403 secondary limit or 429
        Ingestor->>DB: Persist failed sync run and retry metadata
        Ingestor-->>Caller: Retryable upstream failure
    end
```

## 5. Repository Sync

```mermaid
sequenceDiagram
    autonumber
    participant Caller as Gateway or Scheduler
    participant Ingestor as github-ingestor
    participant GitHub as GitHub API
    participant DB as PostgreSQL

    Caller->>Ingestor: POST /v1/sync/repository/execute
    Ingestor->>Ingestor: Validate owner/repo target
    Ingestor->>DB: Start repository sync run
    Ingestor->>GitHub: GET /repos/{owner}/{repo}
    GitHub-->>Ingestor: Repository metadata
    Ingestor->>GitHub: Fetch bounded pull requests
    Ingestor->>GitHub: Fetch reviews, comments, files, labels, issues, commits
    Ingestor->>DB: Upsert normalized repository evidence
    Ingestor->>DB: Finish sync run with metrics
    Ingestor-->>Caller: Completed repository sync

    alt Unsafe repository target
        Ingestor-->>Caller: 400 invalid repository target
    else Repository not found or unauthorized
        GitHub-->>Ingestor: 404/403
        Ingestor->>DB: Finish sync run as failed
        Ingestor-->>Caller: Upstream repository error
    else GraphQL batch fails
        GitHub-->>Ingestor: GraphQL error
        Ingestor->>GitHub: Fall back to REST fetches
        Ingestor->>DB: Persist REST-derived evidence
        Ingestor-->>Caller: Completed with fallback metrics
    end
```

## 6. PR Analysis

```mermaid
sequenceDiagram
    autonumber
    participant Caller as Gateway or Scheduler
    participant Analyzer as pr-analyzer
    participant DB as PostgreSQL

    Caller->>Analyzer: POST /v1/analyze/pull-request/execute
    Analyzer->>Analyzer: Normalize owner/repo + PR number
    Analyzer->>DB: Load synced PR, repository, files, reviews, labels
    DB-->>Analyzer: PullRequestAnalysisRequest
    Analyzer->>Analyzer: Enforce hard input limits
    Analyzer->>Analyzer: Classify file breakdown
    Analyzer->>Analyzer: Derive category, languages, issue refs, review cycles
    Analyzer->>Analyzer: Compute confidence, depth, review strength, skills, flags
    Analyzer->>Analyzer: Apply hallucination guardrails
    Analyzer->>DB: Persist contribution_analyses artifact
    Analyzer-->>Caller: PullRequestAnalysisResponse

    alt PR evidence missing
        DB-->>Analyzer: No matching synced PR
        Analyzer-->>Caller: 404 pull_request_not_found
    else Request exceeds hard limits
        Analyzer-->>Caller: 413 analysis limit exceeded
    else Guardrail or schema validation fails
        Analyzer-->>Caller: 500 analysis_validation_failed
    else Persistence fails
        DB-->>Analyzer: Write error
        Analyzer-->>Caller: 500 analysis_persistence_failed
    end
```

## 7. Gemini Summary Enrichment

```mermaid
sequenceDiagram
    autonumber
    participant Analyzer as pr-analyzer
    participant Gemini as Gemini OpenAI-compatible API
    participant DB as PostgreSQL

    Analyzer->>Analyzer: Build deterministic analysis baseline
    alt Gemini client configured
        Analyzer->>Gemini: POST /chat/completions with bounded PR evidence
        Gemini-->>Analyzer: One neutral summary sentence
        Analyzer->>Analyzer: Normalize summary
        Analyzer->>Analyzer: Re-run guardrails and response validation
        Analyzer->>DB: Persist hybrid analysis with prompt/model metadata
    else Gemini missing or disabled
        Analyzer->>Analyzer: Keep deterministic summary
        Analyzer->>DB: Persist deterministic analysis with fallback_reason=ai_not_enabled
    end

    alt Gemini rate limited or quota exhausted
        Gemini-->>Analyzer: 429 or quota error
        Analyzer->>Analyzer: Set fallback_reason=ai_rate_limited or ai_quota_exceeded
        Analyzer->>DB: Persist deterministic fallback analysis
    else Gemini returns invalid or empty response
        Gemini-->>Analyzer: Empty/invalid payload
        Analyzer->>Analyzer: Set fallback reason and keep baseline
        Analyzer->>DB: Persist deterministic fallback analysis
    else AI summary fails guardrails
        Analyzer->>Analyzer: Reject AI text and restore deterministic summary
        Analyzer->>DB: Persist fallback_reason=ai_guardrail_rejected
    end
```

## 8. Score Replay

```mermaid
sequenceDiagram
    autonumber
    participant Caller as Gateway or Scheduler
    participant Scoring as scoring-engine
    participant DB as PostgreSQL

    Caller->>Scoring: POST /v1/score/users/{user_id}/replay
    Scoring->>Scoring: Validate user_id and trigger_type
    Scoring->>DB: Load eligible PR + analysis replay candidates
    DB-->>Scoring: Persisted evidence candidates
    loop For each eligible PR
        Scoring->>Scoring: Exclude self-merged or invalid evidence
        Scoring->>Scoring: Apply deterministic score formula
        Scoring->>Scoring: Build score event and skill XP
    end
    Scoring->>Scoring: Aggregate XP, skills, rank tier, badges
    Scoring->>DB: Save replay run, score_events, score_snapshot, badge awards
    Scoring-->>Caller: ReplayUserScoresResponse

    alt No eligible PR evidence
        Scoring->>DB: Persist empty/zero replay snapshot
        Scoring-->>Caller: Completed replay with zero events
    else Invalid analysis envelope
        Scoring-->>Caller: 400 invalid scoring request
    else Duplicate event key during replay save
        DB-->>Scoring: Unique key conflict
        Scoring->>DB: Converge through idempotent save semantics
        Scoring-->>Caller: Stable replay result or persistence error
    else Database write fails
        DB-->>Scoring: Write error
        Scoring-->>Caller: 500 replay persistence failure
    end
```

## 9. Profile Snapshot Refresh

```mermaid
sequenceDiagram
    autonumber
    participant Caller as Gateway or Scheduler
    participant Profile as profile-service
    participant Redis as Redis
    participant DB as PostgreSQL

    Caller->>Profile: POST /v1/profile/users/{user_id}/refresh
    Profile->>Profile: Validate user_id
    Profile->>DB: Load user and latest score selection
    Profile->>DB: Load score rows and badge evidence
    Profile->>Profile: Build profile snapshot view model
    Profile->>DB: Insert profile_snapshots record
    Profile->>Profile: Build quest recommendations from snapshot
    Profile->>DB: Materialize quest board and rewards
    Profile->>Redis: Future reads can cache profile response
    Profile-->>Caller: ProfileRefreshResponse

    alt Latest score snapshot missing
        Profile-->>Caller: Error if no score evidence is available
    else Snapshot rebuild fails but older snapshot exists on read path
        Profile->>DB: Keep older snapshot available
        Profile-->>Caller: Refresh failure while reads may serve stale data
    else Quest materialization fails
        DB-->>Profile: Quest persistence error
        Profile-->>Caller: Refresh failure
    else Redis unavailable
        Redis-->>Profile: Cache ping/write warning
        Profile-->>Caller: Completed response using PostgreSQL source of truth
    end
```

## 10. Public Profile View

```mermaid
sequenceDiagram
    autonumber
    participant Visitor as Visitor
    participant Frontend as Public profile UI
    participant BFF as Next.js BFF
    participant Gateway as api-gateway
    participant Profile as profile-service
    participant Redis as Redis
    participant DB as PostgreSQL

    Visitor->>Frontend: Open /u/{username}
    Frontend->>BFF: GET /api/profile/public/{username}
    BFF->>Gateway: GET /v1/users/{username}
    Gateway->>Gateway: Validate handle path and public rate limit
    Gateway->>Profile: GET /v1/users/{username}
    Profile->>DB: Load user, privacy settings, repo visibility
    Profile->>DB: Load or rebuild latest profile snapshot
    Profile->>Redis: Check public cache
    alt Public cache hit
        Redis-->>Profile: Cached public profile
    else Cache miss
        Profile->>Profile: Filter hidden repos and AI summaries by privacy settings
        Profile->>Redis: Store public profile response
    end
    Profile-->>Gateway: Public profile response + staleness metadata
    Gateway-->>BFF: Public cache-control response
    BFF-->>Frontend: Profile JSON
    Frontend-->>Visitor: Render public profile

    alt Profile disabled or hidden
        Profile-->>Gateway: 404/403 profile hidden
        Gateway-->>BFF: Hidden profile response
        Frontend-->>Visitor: Render not found or private profile state
    else Handle not found
        Profile-->>Gateway: 404 not found
        Frontend-->>Visitor: Render not found
    else Snapshot stale or partial
        Profile-->>Frontend: Response with staleness flags
        Frontend-->>Visitor: Render profile with evidence-state messaging
    end
```

## 11. PR Battle Report

```mermaid
sequenceDiagram
    autonumber
    participant Visitor as Visitor
    participant Frontend as PR report UI
    participant BFF as Next.js BFF
    participant Gateway as api-gateway
    participant Profile as profile-service
    participant DB as PostgreSQL

    Visitor->>Frontend: Open /pr/{owner}/{repo}/{number}
    Frontend->>BFF: GET /api/pr/{owner}/{repo}/{number}/report
    BFF->>Gateway: GET /v1/pr/{owner}/{repo}/{number}/report
    Gateway->>Gateway: Validate PR report path and public rate limit
    Gateway->>Profile: GET /v1/pr/{owner}/{repo}/{number}/report
    Profile->>DB: Load latest pull_request_report_snapshot
    alt Snapshot exists and is fresh enough
        DB-->>Profile: Stored report JSON
    else Snapshot missing but evidence exists
        Profile->>DB: Load PR, analysis, score event, badge evidence
        Profile->>Profile: Build report with XP breakdown and evidence state
        Profile->>DB: Persist report snapshot
    end
    Profile-->>Gateway: PullRequestReportResponse
    Gateway-->>BFF: Public cache-control response
    BFF-->>Frontend: Report JSON
    Frontend-->>Visitor: Render PR battle report

    alt PR not synced
        DB-->>Profile: No PR evidence
        Profile-->>Gateway: 404 report not found
        Frontend-->>Visitor: Render report unavailable state
    else Analysis or score evidence missing
        Profile->>Profile: Mark evidence_status partial or stale
        Profile-->>Frontend: Report with missing evidence list
        Frontend-->>Visitor: Render partial report state
    else Materialization persistence fails
        DB-->>Profile: Write error
        Profile-->>Gateway: 500 materialization error
        Frontend-->>Visitor: Render retryable report error
    end
```

## 12. Scheduler And Backfill Job Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Queued: enqueue normalized job
    Queued --> Leased: worker leases ready job
    Leased --> Running: call target service
    Running --> Completed: target returns expected success
    Running --> RetryScheduled: target returns retryable failure
    RetryScheduled --> Queued: backoff expires
    Running --> DeadLettered: max attempts reached
    Leased --> Queued: lease expires before completion
    Queued --> Paused: operator pauses job or plan
    Paused --> Queued: operator resumes
    Queued --> Canceled: operator cancels job or latest plan run
    Leased --> Canceled: cancel wins before terminal completion
    DeadLettered --> Queued: operator replays dead letter
    Completed --> [*]
    Canceled --> [*]

    note right of Running
        Worker mode can call ingestor,
        analyzer, scoring, profile,
        report materialization, quests,
        and leaderboard endpoints.
    end note
```

## End-To-End Product Flow

```mermaid
flowchart LR
    Login[GitHub OAuth login]
    Sync[Bounded GitHub sync]
    Evidence[(Persisted PR evidence)]
    Analysis[PR analysis and optional Gemini summary]
    Score[Deterministic score replay]
    Profile[Profile, quest, badge, report snapshots]
    UI[Dashboard, public profile, PR report]

    Login --> Sync
    Sync --> Evidence
    Evidence --> Analysis
    Analysis --> Score
    Score --> Profile
    Profile --> UI

    Sync -. rate limit / timeout .-> Evidence
    Analysis -. AI unavailable .-> Analysis
    Score -. invalid evidence excluded .-> Score
    Profile -. stale snapshot fallback .-> UI
```
