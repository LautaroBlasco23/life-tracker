# Getting Started

Each project is self-contained; see its README for setup.

Run modes from the repository root (one at a time; `make stop` stops whichever is running):

| Command | Mode | What runs | URLs |
|---|---|---|---|
| `make dev` | Fast lane (host) | air hot-reload on the host (`:8080`) + postgres + mongodb in compose + `next dev` (`:3000`). No app containers, no floci, no observability. | API `:8080/api`, app `:3000` |
| `make dev-container` | Container | API container + postgres + mongodb + frontend (nginx proxies `/api` → `:8080`). No floci, no observability. | API `:8080/api`, app `:3000` |
| `make dev-emulator` | AWS-emulated | floci + provisioned RDS/DocumentDB + API as a Lambda behind API Gateway v2 + frontend (nginx proxies `/api` → gateway). This is the pre-deploy test of the real-AWS path. | Gateway `:4566/execute-api/lifetracker-api/dev/`, app `:3000` |
| `make dev-full` | Container + observability | Same as `make dev-container` plus Prometheus, Grafana, Loki, Promtail, node-exporter. | + Prometheus `:9090`, Grafana `:3001`, Loki `:3100` |

All of them are idempotent — re-running a mode's command redeploys the backend and frontend with the latest code, so it doubles as the restart command (`make dev` needs no restart at all: air and `next dev` pick up changes live). See [Deployment Modes](./deployment-modes.md) for the full description of each mode.

- `make stop` tears down everything (compose down ignores profiles, so it removes every running service of the project, including floci, observability, and the frontend container).
- Note: in emulator mode the API runs as a Lambda because the floci-provisioned databases are only reachable from the emulator's docker network (see `infra/scripts/migrate.sh`). The legacy Postgres/Mongo compose path (`docker-compose.db.yml`) is optional rollback tooling; CI and `make dev-emulator` do not use it.
- **Backend**: [`backend/README.md`](../backend/README.md) — `make backend-dev` runs the API with databases (air hot reload). For the AWS-shaped path: `make floci-up` / `floci-provision` / `floci-dev` / `floci-deploy`.
- **Infrastructure**: the root `Makefile` (`make help`) owns every docker compose command. Compose files: `docker-compose.yml` (all services; floci and the monitoring stack are compose *profiles* — `emulator` and `observability` — so the plain `dev` lanes never start them), `docker-compose.db.yml` (legacy DBs), `docker-compose.frontend.yml` (frontend container; the `.override` variant points nginx at the API container instead of the gateway).
- **Frontend**: [`frontend/README.md`](../frontend/README.md) — install dependencies and run the Next.js dev server. The static export is served at `http://localhost:3000` via `make frontend-up` (nginx; the local stand-in for CloudFront, since floci's CloudFront data-plane has parity gaps) and synced to S3 as a deploy artifact via `make deploy-frontend` (set `DEPLOY_S3=0` to skip the S3/CloudFront steps in container mode — the `make dev-container` / `dev-full` lanes do this automatically).
- **Chrome Extension**: [`chrome-extension/README.md`](../chrome-extension/README.md) — load as an unpacked extension pointing at a local backend.
