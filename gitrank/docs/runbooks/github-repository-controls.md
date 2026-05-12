# GitHub Repository Controls Runbook

This runbook converts the v1 repository-admin decision into live GitHub settings.
These controls cannot be fully represented by committed files, so they remain
unchecked in `CONTRIBUTING.md` until they are applied and verified against the
actual repository.

Official references:

- GitHub protected branches: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- GitHub branch protection REST API: https://docs.github.com/en/rest/branches/branch-protection
- GitHub Dependabot alerts: https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configuring-dependabot-alerts
- GitHub vulnerability-alerts REST API: https://docs.github.com/en/rest/repos/repos#enable-vulnerability-alerts
- GitHub dependency graph SBOM API: https://docs.github.com/en/rest/dependency-graph/sboms

## Required State

Apply these settings to the default branch, currently `main`:

- protect `main` or apply an equivalent repository ruleset
- require pull requests before merge
- require at least one approving pull request review before merge
- require status checks before merge
- disable force pushes
- disable branch deletion
- enable dependency graph
- enable Dependabot alerts
- keep `CODEOWNERS` available, but do not require CODEOWNERS approval in v1

Required checks should include at least the critical root gates:

- `go-checks`
- `frontend-checks`
- `gitleaks`
- `filesystem-scan`
- `analyze (go)`
- `analyze (javascript-typescript)`
- `Scorecard analysis`
- every `docker-builds (...)` matrix entry
- every `service-image-scan (...)` matrix entry

If GitHub displays different check names, use the exact names shown on the most
recent successful pull request for this repository.

You can discover current check names from the latest default-branch commit:

```bash
cd gitrank
GITHUB_REPOSITORY=OWNER/REPO \
GITHUB_TOKEN=... \
make discover-github-required-status-checks
```

For public repositories, discovery can run without a token but is rate-limited.

## Apply Through Script

Use this path only with a token that has repository administration write
permission. The script refuses to mutate live settings unless both the
confirmation flag and exact status check names are provided.

```bash
cd gitrank
GITHUB_REPOSITORY=OWNER/REPO \
GITHUB_TOKEN=... \
GITRANK_APPLY_REPOSITORY_CONTROLS=yes \
GITRANK_REQUIRED_STATUS_CHECKS="<paste output from discover-github-required-status-checks>" \
make apply-github-repository-controls
```

`GITHUB_REPOSITORY` can be omitted when running from a Git clone whose
`origin` points to `github.com/owner/repo(.git)`. `GH_TOKEN` is accepted as a
fallback to `GITHUB_TOKEN`.

Use the exact check names from GitHub's branch-protection UI or a recent
successful pull request. Incorrect names can block merging because GitHub will
wait for checks that never report.

### Optional: Bootstrap Token From GitHub App Credentials

If you do not want to use a personal access token, mint a short-lived
installation token first:

```bash
cd gitrank
GITHUB_APP_ID=... \
GITHUB_APP_INSTALLATION_ID=... \
GITHUB_APP_PRIVATE_KEY_FILE=/path/to/app-private-key.pem \
TOKEN_OUTPUT_FILE=/tmp/gitrank-app-token.txt \
make create-github-app-installation-token

GITHUB_REPOSITORY=OWNER/REPO \
GITHUB_TOKEN="$(cat /tmp/gitrank-app-token.txt)" \
GITRANK_APPLY_REPOSITORY_CONTROLS=yes \
make apply-github-repository-controls-auto
```

## Apply With Auto-Discovered Check Names

This path discovers status checks from the current default-branch head commit
and feeds them into the same live apply script.

```bash
cd gitrank
GITHUB_REPOSITORY=OWNER/REPO \
GITHUB_TOKEN=... \
GITRANK_APPLY_REPOSITORY_CONTROLS=yes \
make apply-github-repository-controls-auto
```

Use this only when the latest default-branch check set is the intended required
merge gate set.

## Apply Through GitHub UI

1. Open repository settings.
2. Enable the dependency graph under security and analysis settings.
3. Enable Dependabot alerts under security and analysis settings.
4. Open branch rules or repository rulesets.
5. Add a rule for `main`.
6. Require a pull request before merge.
7. Require at least one approving review.
8. Require status checks before merge and select the critical checks.
9. Leave CODEOWNERS approval disabled for v1.
10. Confirm force pushes and branch deletion are not allowed.

## Verify

Run this from the repo root with a token that can read repository
administration, branch protection, dependency graph, and Dependabot alert
state. The verifier checks branch protection first and falls back to branch
ruleset evaluation (`/rules/branches/{branch}`) when branch protection is not
present.

```bash
cd gitrank
GITHUB_REPOSITORY=OWNER/REPO \
GITHUB_TOKEN=... \
make verify-github-repository-controls
```

`GITHUB_REPOSITORY` can be omitted when running from a Git clone whose `origin`
targets this repository. `GH_TOKEN` is accepted as a fallback to `GITHUB_TOKEN`.

The verifier intentionally fails closed if it cannot prove a required setting.
Do not check the repository-admin boxes in `CONTRIBUTING.md` from inspection
alone; use this verifier or an equivalent GitHub settings export.

Equivalent GitHub Actions path:

- run `.github/workflows/verify-live-v2-gates.yml` with
  `run_github_controls=true`, `GITRANK_REPO_ADMIN_TOKEN` configured, and
  `apply_github_controls=true` when you intend to mutate live settings

## Current Tooling Limitation

The available repository connector can confirm that the authenticated user has
admin permission on the target repository, but it does not expose branch
protection, repository ruleset, dependency graph, or Dependabot-alert mutation
endpoints. Use the scripted `curl` path above, the GitHub UI, or another
separately provisioned GitHub token workflow for the settings themselves.
