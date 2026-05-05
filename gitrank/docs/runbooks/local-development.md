# Local Development Runbook

## Start the local dependencies

```bash
cd gitrank/deployments/compose
docker compose up -d
```

## Prepare environment

```bash
cd gitrank
cp .env.example .env
```

Then replace placeholder secrets and API keys.

## Basic verification

```bash
cd gitrank
go work sync
find . -name go.mod -execdir sh -c 'go test ./...' \;
```

## Common problems

### PostgreSQL not reachable

- verify Docker is running
- verify `DATABASE_URL`
- verify port `5432` is available

### Redis not reachable

- verify `REDIS_URL`
- verify port `6379` is available

### OAuth callback mismatch

- verify `GITHUB_OAUTH_REDIRECT_URL`
- update the GitHub OAuth app settings to match exactly
