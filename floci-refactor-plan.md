# Life Tracker — AWS Refactor Plan (floci)

Status: Draft — decisions locked, execution pending.

## Objective

Transform life-tracker (Go/Gin + Postgres + Mongo, Next.js 14, custom JWT, gRPC imagestore) into an AWS-shaped stack that runs fully locally in Docker via **floci** (`floci/floci`, port 4566): backend as a Go Lambda behind API Gateway v2, data on RDS + DocumentDB, images on S3, secrets in Secrets Manager, frontend as a static export on S3 + CloudFront — while preserving the existing API contracts and the ability to run the old container path for rollback.

## Locked decisions

| Topic | Decision |
|---|---|
| AWS emulator | floci (`floci/floci`, port 4566, MIT, no auth tokens, no feature gates) |
| Backend runtime | Single Go Lambda (Gin via `aws-lambda-go-api-proxy`) behind API Gateway v2 |
| Postgres | RDS (floci runs real `postgres:16-alpine`) — config-only change |
| MongoDB | DocumentDB (floci runs real `mongo:7.0`, wire protocol port 27017) — config-only change |
| Image storage | S3 — replaces the private gRPC imagestore |
| Secrets | JWT secret → Secrets Manager (Cognito later, optional) |
| Auth | Keep custom JWT for now; Cognito is a later optional phase |
| Frontend | Next.js static export (`output: 'export'`) on S3 + CloudFront |
| CI | Run floci in GitHub Actions; bump Go to 1.24 |

## Service mapping

| Current component | Floci equivalent | Fidelity | Code impact |
|---|---|---|---|
| PostgreSQL via GORM | RDS — real `postgres:16-alpine`, IAM auth, JDBC-compatible | Real Docker | Config-only (DSN endpoint) |
| MongoDB via mongo-driver | DocumentDB — real `mongo:7.0`, MongoDB wire protocol on 27017 | Real Docker | Config-only (MONGO_URI) |
| Custom gRPC imagestore | S3 — presigned URLs, multipart, versioning | In-process | Medium: replace `internal/infrastructure/imagestore` with aws-sdk-go-v2 S3 |
| Custom JWT auth | Cognito — user pools, auth flows, JWKS + OpenID well-known endpoints | In-process | Later, optional |
| JWT_SECRET env | Secrets Manager | In-process | Small |
| Prometheus/Grafana | CloudWatch Logs + Metrics | In-process | Later, optional |
| Gin server | Lambda (real Docker) + API Gateway v2 (JWT authorizers) | Real Docker | Medium: wrapper, no route changes |
| Next.js frontend | S3 static + CloudFront | In-process | Medium, needs export spike |

## Feasibility notes

- Floci is a drop-in LocalStack replacement (same port 4566, init scripts under `/etc/localstack/init/`, health endpoint, `FLOCI_*` env equivalents).
- Container-backed services (RDS, DocumentDB, Lambda) require the Docker socket: `-v /var/run/docker.sock:/var/run/docker.sock -u root`.
- In-process services (S3, Secrets Manager, API Gateway, CloudFront, Cognito) are emulations with possible parity gaps vs real AWS.
- Floci is young (v1.5.x) — pin the image tag for reproducibility.

---

## Approach — 8 phases, each independently shippable and revertible

### Phase 0 — Prerequisites + floci foundation

- Fix repo blockers first (nothing builds otherwise):
  - Standardize Go to 1.24 (local `go1.22.2` and CI `GO_VERSION: "1.23"` both disagree with `go.mod`).
  - Fix `.env.example` drift (`SERVER_PORT` / `REFRESH_TOKEN_EXPIRY` are dead keys; actual keys are `PORT` / `JWT_REFRESH_EXPIRY`).
  - Create missing `frontend/.env.example` and `frontend/Dockerfile.dev`, or delete the Make targets referencing them.
- Add `floci` service to `backend/docker-compose.yml`:
  - Image `floci/floci:latest-compat` (bundles AWS CLI for provisioning), port `4566`.
  - Mount `/var/run/docker.sock` with `-u root` (required by RDS, DocumentDB, Lambda).
  - `FLOCI_HOSTNAME=floci` so returned URLs resolve inside compose.
  - `FLOCI_STORAGE_MODE=hybrid` for dev persistence.
- Provisioning script `backend/scripts/provision.sh` (aws CLI v2 against `--endpoint-url http://localhost:4566`, idempotent):
  - S3 bucket `lifetracker-images`.
  - RDS Postgres instance.
  - DocumentDB cluster.
  - Secrets Manager secret `life-tracker/jwt-secret`.
  - Wait-for-ready loops (RDS/DocumentDB spin up real containers — slow).
- New Make targets: `floci-up`, `floci-provision`, `floci-status`, `floci-down`.
- Old `docker-compose.db.yml` path stays untouched as rollback.

### Phase 1 — AWS plumbing in the backend

- Add `aws-sdk-go-v2` modules: `config`, `credentials`, `service/s3`, `service/secretsmanager` (later `aws-lambda-go` + `aws-lambda-go-api-proxy`).
- New `internal/aws/aws.go`: single SDK-config builder reading `AWS_ENDPOINT_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (defaults `test` / `test` / `us-east-1`). Endpoint empty ⇒ real AWS — the same code runs against both floci and production.
- Extend `internal/config/config.go`: `AWS_ENDPOINT_URL`, `S3_BUCKET`, `SECRETS_JWT_NAME`, runtime mode.

### Phase 2 — Storage: imagestore gRPC → S3 (independent, high value)

- Replace `internal/infrastructure/imagestore/client.go` with an S3-backed repository:
  - Upload validated image (≤10MB, jpg/jpeg/png/webp — validation moves into the new repo).
  - Store under `users/{id}/avatar`.
  - Return `url` / `thumbnailUrl` (path-style floci URL or presigned).
  - Delete-on-remove maps to S3 delete.
- Delete the `github.com/lautaroblasco23/imagestore` dependency — also fixes the current gap where compose can't boot without the external gRPC service.
- API contract (`POST` / `DELETE /api/users/me/image`) unchanged ⇒ frontend untouched by this phase.

### Phase 3 — Databases: RDS + DocumentDB (config-only)

- Postgres → RDS: provision `create-db-instance --engine postgres` (real `postgres:16-alpine`). Point `DB_HOST` / `DB_PORT` / `DB_PASSWORD` / `DB_NAME` at the RDS endpoint. GORM DSN, migrations, retry logic unchanged.
- Mongo → DocumentDB: provision DocumentDB cluster (real `mongo:7.0`, wire protocol port 27017). Point `MONGO_URI` at it. mongo-driver code, indexes, queries unchanged.
- **Validation spike (before Phase 5)**: run the existing 23 integration test files against floci RDS + DocumentDB (`ENVIRONMENT=test` endpoints) — this is the proof that DocumentDB parity holds for the actual queries.
- Rollback: flip env vars back to the standalone DB containers.

### Phase 4 — Secrets: JWT secret → Secrets Manager

- On startup, load `JWT_SECRET` from Secrets Manager (fallback to env in local dev; keep the existing hard-fail-on-default pattern for prod). DB passwords can move later if desired.

### Phase 5 — Serverless: single Lambda + API Gateway v2 (the big one)

- Wrap, don't split: keep the entire Gin router as one Lambda via `aws-lambda-go-api-proxy/gin`. Zero route/service changes.
- `main.go` dual mode: `APP_RUNTIME=serverless` ⇒ `lambda.Start(ginadapter.New(r).ProxyWithContext)`; otherwise the current `r.Run(":" + port)` for `make start` / hot-reload dev.
- Move migrations out of the Lambda path: extract standalone `cmd/migrate` reusing the existing `database.Initialize` / migrator; run at provision time, not per cold start.
- Connections: manage GORM/Mongo connections per warm container (sync.Once, short idle timeout) — the current single-initialize pattern is wrong for Lambda. This is forward-correct for real AWS too.
- Deploy script `scripts/deploy-lambda.sh`:
  - `GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o bootstrap`.
  - `lambda create-function` (runtime `provided.al2`, handler `bootstrap`).
  - API Gateway v2 HTTP API, route `ANY /{proxy+}` with Lambda proxy integration, deploy stage.
  - If zip exceeds limits (GORM + mongo-driver + SDKs is a large binary), fall back to floci ECR image-backed Lambda (real `registry:2`).
- Verify: curl API Gateway endpoint for `/health`, register/login, full CRUD, image upload (S3), then run the frontend against it.
- **Risk to spike first**: Lambda containers (real Docker) reaching RDS/DocumentDB containers through floci's network wiring. If floci can't route Lambda → DB, fallback is keeping DBs reachable via a shared Docker network. Verify with one hello-world function before committing to this phase.

### Phase 6 — Frontend: S3 + CloudFront static export

- Export spike first: add `output: 'export'` to `next.config.mjs` (already has `images.unoptimized: true` — good sign), run `next build`, fix any server-only API usage in `app/`. The app is client-heavy (localStorage auth, client fetch services, `auth-guard`), so export is expected to fit.
- Deploy script: `aws s3 sync out/ s3://lifetracker-web` → create CloudFront distribution (in-process in floci) with the bucket as origin → serve at the distribution URL.
- `env-config.js` (runtime `NEXT_PUBLIC_API_URL`) is generated at deploy time pointing at the API Gateway endpoint instead of container-entrypoint injection.
- Update `CORS_ALLOWED_ORIGINS` to the CloudFront origin; set `chrome-extension/config.js` `API_BASE` to the gateway URL (one line).

### Phase 7 — CI

- `backend-ci.yml`: replace Postgres/Mongo service containers with a floci container (needs Docker socket on the runner), `provision.sh`, run `make test` against floci services; add a Lambda build + API Gateway smoke job. Bump `GO_VERSION` to 1.24.
- `frontend-ci.yml`: add `next build` export + optional floci S3 deploy smoke test.

### Phase 8 — Optional follow-ups (not in this refactor)

- Cognito (JWKS-validating middleware + API Gateway v2 JWT authorizer; frontend auth flows) — floci supports user pools and JWKS well-known endpoints; staged separately because it touches the auth domain + frontend.
- CloudWatch logs/metrics replacing Prometheus/Grafana.
- ECR-image Lambda packaging.

---

## Tradeoffs

- **Monolith-Lambda, not microservices**: one Lambda wrapping the whole Gin app preserves code but forfeits per-route scaling — acceptable now, split later if ever justified.
- **Lambda cold starts + per-invocation connections**: correct for real AWS, but adds latency and complexity vs the current long-lived server.
- **Static export loses SSR** — the app doesn't use server rendering today; verified by spike.
- **floci in-process services are emulations** (S3, Secrets Manager, API Gateway, CloudFront): good for dev/CI, parity gaps vs real AWS are possible.
- **Config-only DB migration keeps non-AWS idioms** (DSN creds instead of IAM auth) — fine locally, note for prod hardening.

## Risks

- **floci Lambda → RDS/DocumentDB connectivity** — highest-risk item; verified early in Phase 5, has fallback (shared Docker network).
- **DocumentDB parity for your queries** — de-risked by running the existing test suite against floci in Phase 3 before the Lambda rewrite.
- **RDS/DocumentDB startup latency and floci's young age** (v1.5.x) — provisioning scripts must wait for readiness; pin the image tag for reproducibility.
- **Next.js export incompatibilities** — checked in the Phase 6 spike before any frontend work.
- **Go toolchain mismatch (1.22.2 local / 1.23 CI / 1.24 go.mod)** blocks everything — fixed first in Phase 0.
- **Large Lambda binary** (GORM + mongo-driver + SDKs) — ECR image path as fallback.

## Alternatives (awareness only)

- **DynamoDB instead of DocumentDB** — more AWS-native, but a full repository rewrite for zero user-visible benefit right now; revisit if DocumentDB parity fails.
- **ECS via floci instead of Lambda** — avoids the connection/migration rework but keeps a server model and adds fragile emulation plumbing.
- **Cognito now instead of later** — more AWS-native sooner, but it's the riskiest component and would block the whole refactor; current sequencing de-risks it.
