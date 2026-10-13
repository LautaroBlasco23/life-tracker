# Architecture (plain Docker containers)

The application is a single docker compose stack defined at the repo root in
[`docker-compose.yml`](../docker-compose.yml): the Go API, PostgreSQL, MongoDB,
and an nginx container serving the Next.js static export. Deployment is plain
`docker compose up -d` — no cloud provider, no emulator, no orchestration layer.

## Services

| Service | Container | Role |
|---|---|---|
| `api` | `golang_api_server` (:8080) | The REST API (Gin, prod-built image from `backend/Dockerfile`); runs its embedded migrations on every (re)start |
| `web` | `lifetracker-web` (:3000) | nginx serving the static Next.js export from a named volume; proxies `/api/*` to the api container on the same origin |
| `postgres` | `golang_api_postgres` (:5432, loopback) | Relational data: users, activities, notes, time, routines, social |
| `mongodb` | `golang_api_mongodb` (:27017, loopback) | Document data: activity records, transactions, payments, screen time |

Compose *profiles* (never started by a plain `docker compose up -d`):

- `observability` — node-exporter, Prometheus (:9090), Grafana (:3001), Loki (:3100), Promtail. Prometheus scrapes the API's `/metrics` endpoint and node-exporter; Promtail ships container logs into Loki.
- `loadtest` — `loadtest-api` + `loadtest-postgres` + `loadtest-mongodb`: the same API and databases with pinned credentials and their own volumes, so the load-test lane works regardless of `.env` and never touches dev DB data (see [`loadtest.md`](./loadtest.md)).

Test databases reuse the same `postgres`/`mongodb` definitions with different env values (`backend/.env.test`: :5433/:27018, `_test` volumes, separate network) — see the `db-test-*` make targets.

The compose project name is pinned to `infra` in the compose file, which keeps the historical volume/network names (`infra_postgres_data`, `infra_golang_api_network`, …) — no data migration when the stack moved from `infra/` to the repo root.

## Request flow

```
Browser
  │
  ▼  http://localhost:3000
nginx (lifetracker-web) ── serves the Next.js static export
  │
  └─ /api/*  →  api:8080/api/*   (same-origin proxy, no CORS preflights)
                 │
                 ▼
              PostgreSQL + MongoDB
              (on the compose network)

Mobile app / Chrome extension
  └─ direct to http://<host>:8080/api  (bypass nginx)
```

The nginx proxy keeps API calls same-origin for the browser. The Next.js export uses root-relative asset paths (`/_next/...`), so it must be served at the domain root — nginx on :3000 does exactly that, with the runtime API URL injected via `/env-config.js` (see [`frontend.md`](./frontend.md)).

## Deployment & migrations

- `docker compose up -d --build` (or `make dev-container`) — build + start everything.
- `scripts/deploy-frontend.sh` — `next build` (static export), bakes the runtime `env-config.js`, and copies the output into the nginx volume. The build output lives in a named volume rather than a host bind mount because `next build` deletes and recreates `out/`, which breaks host bind mounts under Docker Desktop's WSL integration.
- `scripts/migrate.sh` — executes the migrate binary inside a container attached to the compose network (host-side tools cannot always reach bridge IPs, e.g. Docker Desktop WSL2). The API container also runs its embedded migrations on every start, so this is the explicit standalone equivalent.
- `nginx/nginx.tls.conf.example` — template for host-side TLS termination (certbot) when deploying beyond localhost; the in-stack nginx stays plain HTTP.

_Diagrams authored in Excalidraw._
