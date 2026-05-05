# Contributor Onboarding

## Read First

1. `README.md`
2. `CONTRIBUTING.md`
3. `gitrank/README.md`
4. `gitrank/docs/architecture.md`
5. `gitrank/docs/scoring-model.md`

## Setup

1. Install Go `1.26.2`.
2. Start PostgreSQL and Redis with `make compose-up`.
3. Copy `.env.example` to `.env`.
4. Replace placeholder secrets and API keys.
5. Run `make test`.

## Where To Start

- shared packages if you want foundational work
- docs if you want architecture or policy work
- service modules if you are implementing concrete features

## First Contribution Advice

- prefer bounded changes
- avoid changing scoring and storage in the same PR unless necessary
- update docs whenever behavior changes
