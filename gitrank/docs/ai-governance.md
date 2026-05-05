# AI Governance

Last reviewed: May 5, 2026

This document defines the v1 AI governance baseline for GitRank.

## Purpose

AI is optional enrichment in GitRank v1.

AI may help with:

- contribution-type classification
- bounded PR summarization
- skill-area hints
- human-readable explanation enrichment

AI may not:

- assign final scores directly
- bypass deterministic validation
- analyze private repository code in v1

## Input Policy

Allowed AI inputs:

- bounded public PR diff hunks
- PR title and description
- changed file names
- labels
- review metadata
- deterministic derived features

Disallowed AI inputs:

- full repository file contents
- private repository code
- raw secrets or tokens
- unbounded public diff payloads

## Prompt Versioning

- every prompt family must have a stable version identifier such as `pr-analyzer.v1`
- prompt version must be stored with each AI-assisted analysis record
- prompt changes that can affect classification behavior require a version bump

## Structured Output Contract

AI output must validate against a versioned JSON schema before use.

Baseline schema fields:

- `schema_version`
- `classification`
- `confidence`
- `summary`
- `skill_signals`
- `risk_flags`
- `notes`

Classification must be one of the supported contribution categories already defined in the scoring model.

Confidence must be a bounded numeric field between `0.0` and `1.0`.

## Validation Rules

- reject output that does not parse as JSON
- reject output with unknown required fields missing
- reject output with unsupported categories
- reject output that exceeds size limits
- reject output that tries to emit a final score or score override

If validation fails:

1. retry once with the same bounded evidence
2. if validation fails again, fall back to deterministic-only analysis

## Fallback Behavior

Deterministic extraction remains the source of truth.

If AI is unavailable, rate-limited, over budget, or invalid:

- continue deterministic classification where available
- mark AI enrichment as unavailable
- keep the contribution score pipeline operational without AI

## Confidence and User Language

- low-confidence AI hints should not be rendered as certainty
- public profile language must remain evidence-backed and non-absolute
- AI confidence may influence explanatory wording, but not the deterministic score formula directly

Contributor-facing claim threshold:

- strong skill claims require deterministic corroboration from at least 3 scored contributions in the current snapshot window
- if AI-assisted wording is used for a strong claim, confidence should be at least `0.70`
- otherwise the UI should fall back to softer wording such as `recent signals` or `appears strongest in`

## Retention

- retain only prompt and response metadata needed for debugging, audit, and score explanation
- apply the retention targets defined in [privacy-and-data-handling.md](./privacy-and-data-handling.md)

## Budget Baseline

V1 operating caps:

- at most 12 diff hunks sent per PR
- at most 15,000 input tokens worth of diff and metadata per PR after truncation
- at most 2,000 output tokens per PR
- at most one retry after validation failure
- maintain a daily environment-level AI spend cap before background enrichment is paused

The exact daily spend threshold may differ by environment, but production must enforce one.

## Guardrails

- never trust AI output without schema validation
- never let AI emit the authoritative final score
- redact secrets before any outbound provider call
- record prompt version, model name, and fallback reason when AI is bypassed
