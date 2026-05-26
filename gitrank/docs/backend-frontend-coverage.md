# Backend to Frontend Coverage Matrix

This document tracks parity between backend routes and frontend real-data usage.

Scope:
- Backend entrypoint: `services/api-gateway` public/authenticated routes.
- Frontend entrypoint: `frontend/app/api` BFF routes + dashboard/settings UI consumers.

## Coverage Rules

- Every user-facing backend route in `api-gateway` must have a BFF mapping in `frontend/app/api`.
- Every BFF proxy route must be covered by `frontend/tests/bff-route-contract.test.ts`.
- Critical frontend features must read/write through BFF routes only (no mock payloads in production flows).

## Route Matrix

| Backend Route | Frontend BFF Route | UI/Consumer |
|---|---|---|
| `GET /v1/meta/manifest` | `GET /api/meta/manifest` | Settings → Backend capability panel |
| `GET /v1/meta/dependencies` | `GET /api/meta/dependencies` | Settings → Backend capability panel |
| `GET /v1/profile/schema` | `GET /api/profile/schema` | Settings → Profile schema panel |
| `GET /v1/leaderboard` | `GET /api/leaderboard` | Leaderboard page, Dashboard rank context |
| `GET /v1/pr/{owner}/{repo}/{number}/report` | `GET /api/pr/[owner]/[repo]/[number]/report` | PR battle report pages |
| `POST /v1/analytics/events` | `POST /api/analytics/events` | Frontend analytics event emission |
| `POST /v1/sync` | `POST /api/sync` | Settings sync queue controls (installation/user/repository/PR/review/issue/commit) |
| `GET /v1/sync/runs` | `GET /api/sync/runs` | Settings sync activity |
| `POST /v1/sync/user/execute` | `POST /api/sync/user` | Settings sync execution controls, auto-sync |
| `POST /v1/sync/installation/execute` | `POST /api/sync/installation` | Settings sync execution controls |
| `POST /v1/sync/repository/execute` | `POST /api/sync/repository` | Settings sync execution controls |
| `POST /v1/sync/pull-request/execute` | `POST /api/sync/pull-request` | Settings sync execution controls |
| `POST /v1/sync/review/execute` | `POST /api/sync/review` | Settings sync execution controls |
| `POST /v1/sync/issue/execute` | `POST /api/sync/issue` | Settings sync execution controls |
| `POST /v1/sync/commit/execute` | `POST /api/sync/commit` | Settings sync execution controls |
| `POST /v1/me/account/unlink` | `POST /api/account/unlink` | Settings account controls |
| `POST /v1/me/account/delete` | `POST /api/account/delete` | Settings data controls |
| `GET /v1/me/profile` | `GET /api/profile/me` | Dashboard/Contributions/Badges/Quests/Settings |
| `PATCH /v1/me/profile` | `PATCH /api/profile/me` | Settings privacy/display toggles |
| `GET /v1/me/quests` | `GET /api/profile/me/quests` | Dashboard quests lane |
| `GET /v1/me/account/export` | `GET /api/account/export` | Settings export action |
| `PATCH /v1/me/profile/repositories/{owner}/{repo}` | `PATCH /api/profile/me/repositories/[owner]/[repo]` | Settings repository visibility |
| `GET /v1/users/{handle}` | `GET /api/profile/public/[username]` | Public profile route |
| `GET /v1/users/{handle}/card` | `GET /api/profile/public/[username]/card` | Shareable profile card |

### Auth-Service Routes Proxied by Frontend

| Backend Route | Frontend BFF Route | UI/Consumer |
|---|---|---|
| `POST /v1/account/link/start` | `POST /api/account/link/start` | Settings reconnect GitHub |
| `GET /v1/session/me` | `GET /api/session/me` | Settings session identity panel |
| `POST /v1/session/refresh` | `POST /api/session/refresh` | Settings refresh session action |
| `POST /v1/session/logout` | `POST /api/session/logout` | Settings sign out |
| `GET /oauth/github/install` | `GET /oauth/github/install` | GitHub App install entry |
| `GET /oauth/github/start` | `GET /oauth/github/start` | Login/OAuth entry |
| `GET /oauth/github/callback` | `GET /oauth/github/callback` | OAuth completion and session bootstrap |

### Backend Operational Routes (not frontend product routes)

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`

These are intentionally infrastructure/ops routes and are excluded from product BFF mapping requirements.

## Verification Commands

```bash
npm --prefix frontend run check:backend-gateway-route-parity
npm --prefix frontend run check:bff-route-contract-coverage
npm --prefix frontend run test:contracts -- tests/bff-route-contract.test.ts
npx --prefix frontend vitest run frontend/tests/oauth-auth-proxy-routes.test.ts frontend/tests/session-api.test.ts frontend/tests/account-api-sync-errors.test.ts frontend/tests/profile-schema-api.test.ts
go test ./services/api-gateway/internal/httpapi ./services/api-gateway/internal/app
```
