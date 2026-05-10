# GitHub Repository Controls Runbook

This runbook converts the v1 repository-admin decision into live GitHub settings.
These controls cannot be fully represented by committed files, so they remain
unchecked in `CONTRIBUTING.md` until they are applied and verified against the
actual repository.

Official references:

- GitHub protected branches: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- GitHub Dependabot alerts: https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configuring-dependabot-alerts
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

- `CI / go-checks`
- `CI / docker-builds`
- `CodeQL`
- `Dependency Review`
- `Gitleaks`
- `Trivy`
- `Scorecard`
- `DCO`

If GitHub displays different check names, use the exact names shown on the most
recent successful pull request for this repository.

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
state. This verifier checks the branch-protection API path. If GitHub rulesets
are used instead, export the ruleset and verify the same requirements manually.

```bash
cd gitrank
GITHUB_REPOSITORY=Ayush3941/gitrank \
GITHUB_TOKEN=... \
make verify-github-repository-controls
```

The verifier intentionally fails closed if it cannot prove a required setting.
Do not check the repository-admin boxes in `CONTRIBUTING.md` from inspection
alone; use this verifier or an equivalent GitHub settings export.

## Current Tooling Limitation

The available repository connector can confirm that the authenticated user has
admin permission on `Ayush3941/gitrank`, but it does not expose branch
protection, repository ruleset, dependency graph, or Dependabot-alert mutation
endpoints. Use the GitHub UI or a separately provisioned GitHub token for the
settings themselves.
