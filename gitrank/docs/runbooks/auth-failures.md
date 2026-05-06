# Auth Failures Runbook

Use this runbook when:

- `GitRankAuthServiceErrorsHigh` fires
- `GitRankGitHubRateLimitLow` fires

## Immediate Checks

1. Inspect `auth-service /metrics` for:
   - `gitrank_http_errors_total`
   - `gitrank_github_rate_limit_remaining`
   - `gitrank_github_rate_limit_reset_at_unix`
2. Inspect recent auth-service logs for:
   - token exchange failures
   - callback validation failures
   - database readiness or write failures

## Triage

- If 5xx errors rose without GitHub rate-limit pressure:
  - check database connectivity and migration drift
  - inspect session rotation or cookie-setting regressions
- If GitHub rate-limit remaining is low:
  - pause non-essential auth-side GitHub calls
  - prefer existing session refreshes over new login churn if user impact allows

## Mitigation

- If OAuth callbacks are failing due to config drift, roll back to the last known-good OAuth client settings.
- If rate limits are exhausted, reduce retry pressure and allow the reset window to pass before resuming normal traffic.
- If a session secret or token-encryption issue is suspected, follow the broader incident response runbook.

## Exit Criteria

- auth-service 5xx rate falls below the alert threshold
- GitHub core rate-limit remaining returns to a healthy floor
- login, refresh, unlink, and delete-account smoke paths succeed
