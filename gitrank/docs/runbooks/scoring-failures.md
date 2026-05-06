# Scoring Failures Runbook

Use this runbook when:

- `GitRankScoringServiceErrorsHigh` fires
- `GitRankSuspiciousScoresSpike` fires

## Immediate Checks

1. Inspect `scoring-engine /metrics` for:
   - `gitrank_http_errors_total`
   - `gitrank_score_computations_total`
   - `gitrank_score_suspicious_total`
2. Check recent scorer logs for:
   - invalid analysis envelopes
   - category or validation rejections
   - unexpected request-shape changes from upstream services

## Triage

- If 5xx responses are rising:
  - inspect the most recent scoring requests and verify the analysis envelope still matches the shared contract
  - confirm the calling service did not bypass validation or send a partial artifact
- If suspicious score volume spikes:
  - check whether the analyzer started classifying many tiny docs-only or near-identical changes
  - compare the shift against recent repository or sync cohorts before changing formulas

## Mitigation

- Roll back the most recent scoring or analyzer contract change if failures began immediately after deploy.
- Prefer rejecting bad inputs over silently computing questionable scores.
- If suspicious results are isolated to one repository or sync cohort, pause downstream refreshes for that scope while investigating.

## Exit Criteria

- scoring-engine 5xx rate returns below the alert threshold
- suspicious score rate returns to the normal baseline
- score explanations for fresh requests look coherent again
