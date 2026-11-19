# AI Explanations

AI explains PR evidence on request. Deterministic code owns classification,
confidence, skill signals, XP, ranks, and badges.

## Generation flow

The PR report's **Generate AI summary** action requires a signed-in session and
valid CSRF token. The gateway applies a generation rate limit and checks profile,
repository, exact-PR, and AI-summary visibility before the analyzer contacts the
provider. Authors retain access to their own reports.

The analyzer loads the stored PR description, metadata, file paths, review
states, and deterministic signals. Existing input, token, estimated-cost, and
request-time limits apply. The provider output is capped at 2,200 tokens and
streams to the browser. Closing the page or stopping generation cancels it.

Ordinary extraction, analysis, grading, and score replay never generate AI text.
Generation does not sync GitHub, refresh profiles, or write analysis records.

## Writing and evidence

The prompt lives in
[`ai_summary.go`](../services/pr-analyzer/internal/analyzer/ai_summary.go).
It asks for engaging, plain-language paragraphs of up to 1,000 words, scaled to
the available evidence. It explains unfamiliar terms, the change, and its
supported practical significance. Small changes should receive short explanations.

GitHub text is untrusted evidence, not instructions. The model must distinguish
open proposals from implemented or released behavior. It must not invent measured
benefits, deployment results, code behavior, or business impact. The current
request contains metadata and descriptions rather than full code diffs; the
explanation must not imply that full diffs were inspected.

The browser renders provider output as plain text. Provider errors and incomplete
streams appear only in the generation panel. They do not mark a PR as rate
limited, change report completeness, or alter deterministic scores.

## Storage

Generated PR explanations exist only in the active request and browser component
state. They are never saved in PostgreSQL, score events, report snapshots, browser
storage, or an automatic retry queue. Generating again makes another provider
request and may produce different wording.

Migration 0022 removes stored summaries and provider provenance from analysis
rows and clears old report snapshots that copied the text. Deterministic source
evidence, classifications, confidence, score history, and privacy settings remain.
Other profile-storytelling features use the separate frontend ABRA path; they do
not grant AI authority over scores.
