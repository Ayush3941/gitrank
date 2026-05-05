# Maintainer Guide

This guide defines the expected maintainer workflow for GitRank v1.

## Maintainer Principles

- protect contributor trust before shipping speed
- prefer small reviewed changes over large speculative batches
- keep scoring and reputation changes documented and explainable
- do not use hidden score overrides in v1
- treat abuse, disputes, and security reports as operational work, not side conversations

## Issue Triage

Review new issues at least weekly and assign one of these buckets:

- `bug`: broken behavior or regression
- `security`: vulnerability, secret exposure, or auth concern
- `scoring`: fairness, anti-gaming, or score-dispute issue
- `product`: UX, analytics, onboarding, or profile behavior
- `ops`: deployment, CI, observability, or runtime operations
- `architecture`: contract, persistence, service-boundary, or infra-baseline work

Triage rules:

- acknowledge reproducible bugs quickly, even if no fix is scheduled yet
- route scoring disputes into an auditable issue thread rather than ad hoc chat
- convert broad ideas into scoped issues before implementation begins
- close or relabel stale issues only with an explicit explanation

## Pull Request Review

Review order:

1. correctness
2. security
3. operability
4. maintainability
5. product clarity

Required reviewer behavior:

- reject undocumented shortcuts, fake handlers, or silent fallbacks
- ask for `README.md` and `CONTRIBUTING.md` updates whenever production behavior changes
- require tests for new persistence, scoring, auth, or async-job behavior
- verify contributor-facing scoring or privacy changes against the decision register

The repository uses DCO, not CLA.

Contributors should sign commits with:

```bash
git commit -s -m "your commit message"
```

## Scoring Disputes

GitRank uses a light dispute path in v1.

When a scoring dispute arrives:

1. confirm the complaint is tied to a concrete profile, contribution, or formula version
2. capture the current score explanation, profile snapshot version, and relevant PR evidence
3. determine whether the issue is:
   - incorrect source evidence
   - analyzer misclassification
   - scoring-rule disagreement
   - abuse or gaming suspicion
4. respond in the issue with the current formula version and the evidence path used
5. if a fix is needed, open a follow-up issue or PR rather than changing data manually

V1 rule:

- no hidden manual score overrides

If a serious scoring bug affects many users:

- document the bug
- patch the rule or analysis path
- replay affected scores through the normal recomputation path

## Abuse and Moderation

GitRank uses a light abuse policy in v1.

Current approach:

- obvious abuse can be reviewed manually
- no automated moderation dashboard exists in v1
- no automatic abuse penalties should be applied without a documented rule change
- use the public abuse-report issue template for non-security abuse intake

Examples to escalate:

- suspicious self-merge farming
- repetitive micro-PR spam
- obvious cosmetic-churn inflation
- impersonation or account-link abuse

## Security Escalation

Use `SECURITY.md` for external intake and keep public issue threads free of exploit details until remediation is ready.

Maintainer expectations:

- acknowledge inbound security reports promptly
- minimize exposure of secrets, tokens, or reproducer payloads
- rotate affected credentials if compromise is suspected
- document remediation and follow-up hardening work

## Release Operations

V1 release baseline:

- tag reviewed commits
- build artifacts and images in CI
- publish GitHub Release notes and artifacts
- publish OCI images to the configured registry
- use SBOMs and checksums
- do not require signing or provenance in v1

Release review checklist:

- CI is green
- migrations are reviewed
- rollback notes exist
- operational risks are listed
- auth, ingestion, scoring, and profile changes are called out clearly
- two maintainers should review production release decisions before a public release is cut

## Maintainer Conduct

- explain decisions in public repo artifacts when possible
- avoid private score adjustments or undocumented exceptions
- keep disputes factual and evidence-based
- treat contributors respectfully, especially when scores are low or contested
