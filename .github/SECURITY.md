# Security Policy

## Supported versions

Only the latest release (and `main`) receives security fixes.

## Reporting a vulnerability

This is a personal, self-hosted project — there is no bug bounty. If you find a
security issue, please **do not open a public issue or PR with details**:

1. Email the owner via a GitHub security advisory
   ("Report a vulnerability" button on the repository's Security tab), or
2. Open a GitHub issue titled only "security: please contact me" and the owner
   will reach out.

Please include reproduction steps and affected component (backend / frontend /
mobile / infra). Fixes are prioritized for issues affecting
the deployed API and the published Docker images.

## Scope notes

- The backend never stores plaintext credentials; refresh tokens are hashed at
  rest and revocable server-side.
- Web clients currently keep JWTs in `localStorage`; a migration to
  `httpOnly` cookies is planned. XSS hardening (CSP) is tracked alongside it.
- Dev/docker-compose lanes are not hardened for hostile networks: database and
  observability ports are bound to loopback by design. If you expose them, you
  do so at your own risk.
