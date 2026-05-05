# Contracts Package

`packages/contracts` is the canonical home for transport-facing request and response DTOs that cross service boundaries.

## Versioning Policy

HTTP contract changes follow these rules:

- Public and gateway-facing endpoints are versioned in the path, currently `v1`.
- Additive response fields are allowed within a version.
- New optional request fields are allowed within a version.
- Removing fields, changing field meaning, or changing required fields requires a new major API path version.
- Error envelope shape is stable within a major API version.

Event contract changes follow these rules:

- `packages/events` owns the event envelope schema version.
- New event types may be added without changing the envelope version.
- Breaking envelope changes require incrementing the event schema version.

Repository rule:

- If a service changes a contract, the implementation, tests, and docs must be updated in the same change set.
