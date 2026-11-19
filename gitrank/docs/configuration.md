# Configuration

The root [local run guide](../../README.md#local-run-recommended) uses one
`gitrank/.env`. Start from [.env.example](../.env.example), fill the deployment
values and credentials, and omit settings whose defaults are suitable. Advanced
settings below go into the same file only when an environment needs an override.
There is no second runtime env file.

## Fixed Product Policy

- [Scoring policy](../packages/config/scoring_policy.go) owns the `v1alpha1`
  formula, rank labels and thresholds, badge rules, and progression rules.
  Default awards are unchanged. A rule change requires a policy-version change
  and replay regression review. Previous score events keep their stored version
  and components; this change does not introduce an older-formula registry.
- Formula environment overrides are removed. Startup rejects non-empty retired
  scoring overrides with an explicit removal message, so a stale deployment
  cannot silently select different rules under the same score version.
- [Analyzer policy](../services/pr-analyzer/internal/analyzer/policy.go) owns
  deterministic classification. AI summary length and path-count bounds belong
  to the [summary implementation](../services/pr-analyzer/internal/analyzer/ai_summary.go).
- Frontend [rank labels](../../frontend/lib/runtime/rank-tier-policy.ts),
  [leaderboard fallbacks](../../frontend/lib/runtime/leaderboard-season-policy.ts),
  [contribution display](../../frontend/lib/runtime/contribution-display-config.ts),
  and [polling presets](../../frontend/lib/runtime/sync-polling-policy.ts) are
  shared code policies. API-provided score and leaderboard metadata retain
  authority over presentation fallbacks.
- Unused GitHub integration reminders and moderation/embedding model settings
  are removed. Configure App permissions and subscribed events in GitHub using
  the [integration policy](./github-integration-policy.md).

## Migration From The Expanded Env Template

Remove formula overrides, analyzer JSON policy overrides, and public frontend
display/polling/retry overrides. Non-empty analyzer JSON overrides also fail
startup with an explicit removal message.
Preserve credentials, deployment addresses, and intentional operating overrides.
Only the browser sync deadline, CSRF cookie-name coordination, and web-vitals
sampling remain public frontend environment controls. The default sync deadline
is 180 seconds, matching the former template; explicit deadlines still use the
existing 90-second to 600-second bounds.

When changing backend CSRF cookie naming, set the frontend CSRF cookie name to
match. Public browser variables are embedded during the Next.js build; changing
one requires rebuilding the frontend. Secrets remain server-side.

## Supported Environment Variables

The table includes non-secret defaults and advanced overrides. A blank default
means unset; credential placeholders identify values the operator must supply.
The template is the starting configuration, while this table is the complete
reference for supported overrides. Frontend env-coverage checks accept keys from
both sources.

| Variable | Default |
| --- | --- |
| `GITRANK_ENV` | `development` |
| `GITRANK_SERVICE_NAME` | `service command name` |
| `GITRANK_LOG_LEVEL` | `info` |
| `GITRANK_LOG_FORMAT` | `text` |
| `GITRANK_SHUTDOWN_TIMEOUT` | `10s` |
| `GITRANK_ENV_FILE` | `automatic discovery` |
| `GITRANK_PUBLIC_BASE_URL` | `http://localhost:3000` |
| `GITRANK_API_BASE_URL` | `http://localhost:8080` |
| `GITRANK_CSP_MODE` | `report-only` |
| `API_GATEWAY_ADDR` | `:8080` |
| `AUTH_SERVICE_ADDR` | `:8081` |
| `GITHUB_INGESTOR_ADDR` | `:8082` |
| `PR_ANALYZER_ADDR` | `:8083` |
| `PROFILE_SERVICE_ADDR` | `:8084` |
| `SCORING_ENGINE_ADDR` | `:8085` |
| `SCHEDULER_WORKER_ADDR` | `:8086` |
| `AUTH_SERVICE_BASE_URL` | `http://localhost:8081` |
| `GITRANK_AUTH_BASE_URL` | `http://localhost:8081` |
| `GITHUB_INGESTOR_BASE_URL` | `http://localhost:8082` |
| `PR_ANALYZER_BASE_URL` | `http://localhost:8083` |
| `PROFILE_SERVICE_BASE_URL` | `http://localhost:8084` |
| `SCORING_ENGINE_BASE_URL` | `http://localhost:8085` |
| `SCHEDULER_WORKER_BASE_URL` | `http://localhost:8086` |
| `INTERNAL_API_REQUEST_TIMEOUT` | `5s` |
| `PROFILE_PUBLIC_CACHE_TTL` | `5m` |
| `PROFILE_PRIVATE_CACHE_TTL` | `2m` |
| `PROFILE_SNAPSHOT_STALE_TTL` | `15m` |
| `PROFILE_RECENT_REPORTS_DEFAULT_LIMIT` | `4` |
| `PROFILE_RECENT_REPORTS_MAX_LIMIT` | `10` |
| `PROFILE_REPORT_BACKFILL_DEFAULT_LIMIT` | `50` |
| `PROFILE_REPORT_BACKFILL_MAX_LIMIT` | `200` |
| `PROFILE_ACCOUNT_EXPORT_AUDIT_LIMIT` | `200` |
| `DATABASE_URL` | `postgres://localhost:55432/gitrank?sslmode=disable` |
| `REDIS_URL` | `redis://localhost:6379/0` |
| `ALLOW_LOCAL_SEED` | `0` |
| `GITRANK_SESSION_SECRET` | `replace-with-a-long-random-secret` |
| `GITRANK_PREVIOUS_SESSION_SECRETS` | |
| `GITRANK_JWT_SIGNING_KEY` | `replace-with-a-long-random-signing-key` |
| `AUTH_SESSION_COOKIE_NAME` | `gitrank_session` |
| `AUTH_CSRF_COOKIE_NAME` | `gitrank_csrf` |
| `AUTH_COOKIE_DOMAIN` | |
| `AUTH_COOKIE_SECURE` | `false` |
| `AUTH_COOKIE_SAME_SITE` | `lax` |
| `AUTH_SESSION_TTL` | `720h` |
| `AUTH_SESSION_IDLE_TTL` | `72h` |
| `AUTH_SESSION_ROTATION_INTERVAL` | `24h` |
| `AUTH_OAUTH_STATE_TTL` | `10m` |
| `AUTH_ADMIN_GITHUB_LOGINS` | |
| `AUTH_MAINTAINER_GITHUB_LOGINS` | |
| `AUTH_RATE_LIMIT_WINDOW` | `1m` |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | `30` |
| `GITHUB_CLIENT_ID` | `replace-me` |
| `GITHUB_CLIENT_SECRET` | `replace-me` |
| `GITHUB_OAUTH_AUTHORIZE_URL` | `https://github.com/login/oauth/authorize` |
| `GITHUB_OAUTH_EXCHANGE_URL` | `https://github.com/login/oauth/access_token` |
| `GITHUB_OAUTH_TOKEN_URL` | `https://github.com/login/oauth/access_token` |
| `GITHUB_OAUTH_DEVICE_URL` | `https://github.com/login/device/code` |
| `GITHUB_OAUTH_REDIRECT_URL` | `http://localhost:3000/oauth/github/callback` |
| `GITHUB_OAUTH_SCOPES` | `read:user,user:email` |
| `GITHUB_APP_ID` | `0` |
| `GITHUB_APP_SLUG` | `replace-me` |
| `GITHUB_APP_INSTALL_URL` | |
| `GITHUB_APP_CLIENT_ID` | `replace-me` |
| `GITHUB_APP_CLIENT_SECRET` | `replace-me` |
| `GITHUB_APP_PRIVATE_KEY_PEM_PATH` | `./secrets/github-app-private-key.pem` |
| `GITHUB_WEBHOOK_SECRET` | `replace-me` |
| `GITHUB_API_BASE_URL` | `https://api.github.com` |
| `GITHUB_GRAPHQL_URL` | `https://api.github.com/graphql` |
| `GITHUB_API_VERSION` | `2026-03-10` |
| `GITHUB_USER_AGENT` | `GitRank/dev` |
| `GITHUB_REQUEST_TIMEOUT` | `20s` |
| `GITHUB_MAX_PAGE_SIZE` | `100` |
| `GITHUB_GRAPHQL_PAGE_SIZE` | `100` |
| `GITHUB_REPOSITORY_SYNC_PAGE_SIZE` | `10` |
| `GITHUB_PULL_REQUEST_REVIEW_PAGE_SIZE` | `10` |
| `GITHUB_COMMIT_SYNC_PAGE_SIZE` | `50` |
| `GITHUB_USER_REPOSITORY_SYNC_LIMIT` | `100` |
| `GITHUB_INSTALLATION_REPOSITORY_PAGE_SIZE` | `50` |
| `GITHUB_INSTALLATION_REPOSITORY_MAX_PAGES` | `10` |
| `GITHUB_AUTHORED_PR_SEARCH_LIMIT` | `100` |
| `GITHUB_AUTHORED_PR_SYNC_LIMIT` | `25` |
| `GITHUB_SYNC_RUN_DEFAULT_LIMIT` | `50` |
| `GITHUB_SYNC_RUN_MAX_LIMIT` | `200` |
| `GITHUB_USER_PR_SYNC_TIMEOUT_DEFAULT` | `45s` |
| `GITHUB_USER_PR_SYNC_TIMEOUT_MIN` | `20s` |
| `GITHUB_USER_PR_SYNC_TIMEOUT_MAX` | `90s` |
| `GITHUB_WEBHOOK_MAX_BODY_BYTES` | `1048576` |
| `GITHUB_WEBHOOK_DEDUPE_TTL` | `168h` |
| `GITHUB_INSTALLATION_REFRESH_SKEW` | `5m` |
| `GITHUB_SECONDARY_RATE_LIMIT_BACKOFF` | `1m` |
| `GITHUB_REPOSITORY_CACHE_TTL` | `10m` |
| `GITHUB_MAX_CONCURRENT_REQUESTS` | `8` |
| `GITHUB_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `5` |
| `GITHUB_CIRCUIT_BREAKER_OPEN_INTERVAL` | `30s` |
| `GITHUB_CIRCUIT_BREAKER_HALF_OPEN_MAX_REQUESTS` | `1` |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | `replace-with-32-byte-base64-key` |
| `GITHUB_PREVIOUS_TOKEN_ENCRYPTION_KEYS` | |
| `AI_PROVIDER` | `openai` |
| `OPENAI_API_KEY` | |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| `AI_REQUEST_TIMEOUT` | `20s` |
| `GEMINI_API_KEY` | |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| `AI_PR_MAX_CHANGED_FILES` | `100` |
| `AI_PR_MAX_FILE_RECORDS` | `100` |
| `AI_PR_MAX_DIFF_LINES` | `5000` |
| `AI_PR_MAX_INPUT_CHARS` | `120000` |
| `AI_PR_MAX_ESTIMATED_TOKENS` | `30000` |
| `AI_PR_MAX_ESTIMATED_COST_USD` | `0.25` |
| `AI_ESTIMATED_INPUT_TOKEN_COST_USD` | `0.000005` |
| `OTEL_ENABLED` | `false` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` |
| `OTEL_SERVICE_NAMESPACE` | `gitrank` |
| `OTEL_METRICS_ENABLED` | `true` |
| `OTEL_TRACES_ENABLED` | `true` |
| `SCHEDULER_RUN_MODE` | `combined` |
| `SCHEDULER_SYNC_CRON` | `0 */6 * * *` |
| `JOB_MAX_ATTEMPTS` | `10` |
| `JOB_RETRY_BACKOFF` | `30s` |
| `JOB_WORKER_CONCURRENCY` | `4` |
| `JOB_LEASE_TTL` | `2m` |
| `JOB_POLL_INTERVAL` | `5s` |
| `JOB_DEAD_LETTER_QUEUE` | `github-sync-dead-letter` |
| `JOB_PER_USER_RATE_WINDOW` | `15m` |
| `JOB_PER_USER_RATE_MAX` | `6` |
| `JOB_PER_INSTALLATION_RATE_WINDOW` | `15m` |
| `JOB_PER_INSTALLATION_RATE_MAX` | `18` |
| `NEXT_PUBLIC_GITRANK_USER_SYNC_EXECUTION_TIMEOUT_MS` | `180000` |
| `NEXT_PUBLIC_GITRANK_CSRF_COOKIE_NAME` | `gitrank_csrf` |
| `NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE` | `0.35` |
| `SCORING_PROFILE_SCORE_HISTORY_LIMIT` | `100` |
| `SCORING_LEADERBOARD_DEFAULT_LIMIT` | `50` |
| `SCORING_LEADERBOARD_MAX_LIMIT` | `100` |
| `SCORING_LEADERBOARD_BACKFILL_DEFAULT_WEEKS` | `26` |
| `SCORING_LEADERBOARD_BACKFILL_MAX_WEEKS` | `156` |
| `AI_API_KEY` | |
| `AI_MODEL` | |
| `AI_BASE_URL` | |
| `GITHUB_INSTALLATION_TOKEN_REFRESH_SKEW` | |

`GITHUB_OAUTH_DEVICE_URL` is used by the operator device-flow bootstrap script,
not the browser sign-in service. The frontend auth proxy accepts either the
GitRank-specific auth base URL or the auth-service base URL. Generic AI aliases
have priority over provider-specific values; explicit provider selection keeps
credentials scoped to the selected provider.

Local insecure development secret defaults, placeholder App credentials, and
provider-neutral Kubernetes example hosts remain development/setup aids. They
must be replaced before deployment; service validation and the existing secret
policy checks remain in place.
