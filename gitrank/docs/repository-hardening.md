# Repository Hardening

Some repository controls cannot be committed as code and must be configured manually in GitHub.

## Required GitHub Settings

- enable branch protection or repository rulesets on the default branch
- require pull request review before merge
- require status checks before merge
- require CODEOWNERS review for owned areas
- block direct pushes to the default branch
- enable dependency graph
- enable Dependabot alerts
- enable secret scanning where plan support allows it
- enable private vulnerability reporting or GitHub security advisories

## Recommended Ruleset

- two approving reviews for security-sensitive or scoring-sensitive changes
- dismissal of stale approvals on new commits
- linear history preferred
- signed commits encouraged if contributor workflow supports it

## Validation

Revisit these settings after any repository migration or default-branch change.
