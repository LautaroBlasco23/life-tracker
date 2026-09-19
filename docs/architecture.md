# Architecture (AWS-shaped, emulated locally with floci)

The application is architected against AWS managed services rather than bare Docker containers: the API runs as a **Lambda function behind API Gateway v2**, data lives in **RDS PostgreSQL** and **DocumentDB**, user images and the frontend artifact live in **S3**, and the JWT signing key comes from **Secrets Manager**. Locally, **floci** (an AWS emulator, `floci/floci:1.6.0-compat`) stands in for AWS so the exact same deployment path runs on a developer machine.

floci runs as a container with the **Docker socket mounted**, which lets it spawn *real* containers for the data services and the Lambda — not mocks. Everything floci creates shares the emulator's docker network (`infra_golang_api_network`). This is also why the API cannot run as a host process: the provisioned databases are only reachable from inside that network (see `infra/scripts/migrate.sh`).

## Service mapping

| AWS service | Local equivalent | Role |
|---|---|---|
| AWS Lambda | Go binary (`bootstrap`, runtime `provided.al2`, `APP_RUNTIME=serverless`) uploaded by `floci-deploy` | The REST API (Gin) |
| API Gateway v2 | HTTP API pinned as `lifetracker-api`, stage `dev`, route `ANY /{proxy+}` | Public entrypoint for `/api/*` |
| RDS PostgreSQL | Real `postgres:16-alpine` container (`lifetracker-postgres`) spawned by floci | Relational data: users, activities, notes, time, routines, social |
| DocumentDB | Real `mongo:7.0` container (`lifetracker-docdb`) spawned by floci | Document data: activity records, transactions, payments, screen time |
| S3 | Buckets `lifetracker-images` (user images) and `lifetracker-web` (frontend artifact) | Object storage |
| Secrets Manager | Secret `life-tracker/jwt-secret` | JWT signing key |
| CloudFront | nginx container `lifetracker-web` on :3000 | Serves the static frontend export |

> floci's CloudFront data-plane has parity gaps, so the local stand-in for CloudFront is an nginx container. The S3 `lifetracker-web` bucket remains the deploy artifact: CI asserts the export is produced and `deploy-frontend.sh` syncs it there.

## Request flow

```
Browser
  │
  ▼  http://localhost:3000
nginx (lifetracker-web) ── serves the Next.js static export
  │
  └─ /api/*  →  floci API Gateway        (same-origin proxy, no CORS preflights)
                 │
                 ▼  /execute-api/lifetracker-api/dev/api/*
              Lambda (Gin API, APP_RUNTIME=serverless)
                 │
                 ▼
              RDS PostgreSQL + DocumentDB + S3 + Secrets Manager
              (all on the emulator network)
```

The nginx proxy keeps API calls same-origin because floci's gateway does not answer CORS preflights — cross-origin browser calls would fail. Migrations run at provision time (not per Lambda cold start) via `infra/scripts/migrate.sh`, which executes the migrate binary inside a container on the emulator network.

## Provisioning & deployment

- `infra/scripts/provision.sh` — idempotent. Creates the S3 buckets, Secrets Manager secret, RDS instance, and DocumentDB cluster, then writes `infra/.floci.env` (machine-specific endpoints; gitignored).
- `infra/scripts/deploy-lambda.sh` — runs migrations, builds the Go Lambda, and creates/updates the function plus the API Gateway route.
- `infra/scripts/deploy-frontend.sh` — `next build` (static export), bakes the runtime `env-config.js`, syncs to S3, and copies the output into the nginx volume.

`make dev-emulator` (repo root) runs all three against the current source, so re-running it is the "restart with the latest code" command.
