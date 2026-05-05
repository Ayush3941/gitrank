# Threat Model

## High-Value Assets

- GitHub OAuth credentials
- GitHub App private key material if the optional future App path is enabled
- session secrets and JWT signing keys
- user profile data
- score explanations and derived reputation data
- webhook endpoints
- release artifacts

## Primary Threats

- stolen GitHub or session credentials
- forged webhook deliveries
- replayed webhook payloads
- supply chain compromise in CI
- malicious dependency introduction
- prompt injection through PR content
- overexposure of raw code to AI providers
- abusive score inflation attempts

## Security Controls

- validate webhook signatures
- store secrets outside source control
- encrypt sensitive secrets at rest
- require reviews and status checks before merge
- use dependency review and code scanning
- validate and bound AI outputs
- redact secrets from logs
- keep release workflow traceable and auditable, with signing deferred until post-v1 hardening

## Required Follow-Up

- architecture-specific threat review after each major service is implemented
- incident response runbook
- secret rotation drill
