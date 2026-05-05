# Troubleshooting

## `go test ./...` fails from `gitrank/`

That is expected for this workspace layout. The repository root under `gitrank/` is a Go workspace, not a single Go module. Use:

```bash
find . -name go.mod -execdir sh -c 'go test ./...' \;
```

or:

```bash
make test
```

## Local race tests fail with `no space left on device`

Use the repo-local temp and cache directories:

```bash
make race
```

The Makefile already sets `TMPDIR` and `GOCACHE` inside the repo.

## GitHub OAuth callback mismatch

- verify `GITHUB_OAUTH_REDIRECT_URL`
- verify the GitHub OAuth app callback setting matches exactly

## GitHub App webhook signature errors

- verify `GITHUB_WEBHOOK_SECRET`
- verify no proxy is rewriting the request body before verification

## `govulncheck` missing

Install it with:

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
```
