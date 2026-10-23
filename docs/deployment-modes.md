# Deployment Modes

The stack runs in three container/host modes plus the mobile dev loop, one diagram each. All are started from the repository root (`make dev`, `make dev-container`, `make dev-full`, `make mobile`) and stopped with `make stop`; see [Getting Started](./getting-started.md) for details.

## 1. `make dev` — fast lane (host-run, hot reload)

`next dev` serves the app on `:3000` with HMR and the API hot-reloads on the host with air (`:8080`), so a save is live in seconds — no image rebuild, no static export. Only the databases run in compose (`:5432`, `:27017`); the frontend talks to the API directly and the backend's CORS middleware allows it in dev. Migrations run from the API on every (re)start. Ctrl-C stops air and the frontend; the databases stay up until `make stop` / `make db-down`.

Use this for the daily edit loop. It does not exercise the prod Dockerfile, the static export, or the nginx proxy — that's what the container lane is for.

## 2. `make dev-container` — container mode

```
  Browser                                 Mobile app / Chrome extension
      |                                       |
      | :3000                                 | :8080 (direct, bypasses nginx)
      v                                       v
  +------------------+  /api/* proxy    +------------------------------------+
  | lifetracker-web  |                  |      api (golang_api_server)       |
  |   nginx:alpine   |----------------->|            Go API (Gin)            |
  |  static export   |                  | embedded migrations on each start  |
  +------------------+                  +-------+-----------------+----------+
                                                |                 |
                                                v                 v
                                         +-------------+   +-------------+
                                         |  postgres   |   |   mongodb   |
                                         |    :5432    |   |   :27017    |
                                         | (loopback)  |   | (loopback)  |
                                         +-------------+   +-------------+

  (all containers on the compose network: infra_golang_api_network)
```

Everything is a plain Docker container on a single compose network (`infra_golang_api_network`): the Go API (`:8080`), PostgreSQL (`:5432`), MongoDB (`:27017`), and the frontend. nginx serves the static Next.js export on `:3000` and proxies `/api/*` to the API container, so the browser talks same-origin and CORS never enters the picture. The mobile app and Chrome extension bypass nginx and hit the API directly on `:8080`. Migrations are **embedded in the API** and run automatically on every API (re)start; `make dev-container` additionally runs an explicit standalone migrate step (`scripts/migrate.sh`) inside the network after `compose up`.

This is the classic "compose up" deployment and the parity check that the prod-built image and export still work — the same command deploys the app on any host with Docker. Re-run it after changes (nothing watches files here).

## 3. `make dev-full` — container mode + observability

```
  +------------------+ scrapes +----------------+ queries +--------------+
  |    api :8080     |<--------|   prometheus   |<--------|   grafana    |
  |     /metrics     |         |     :9090      |         |    :3001     |
  +------------------+         +--------+-------+         +----------+---+
                                        |                            ^
                                        | scrapes                    |
  +------------------+                  |                            |
  |  node-exporter   |<-----------------+                            |
  |  (host metrics)  |                                               |
  +------------------+                                               |
                                                                     |
                                                             queries |
  +--------------+  ships logs +----------------+                    |
  |   promtail   |------------>|      loki      |--------------------+
  |              |             |     :3100      |
  +--------------+             +----------------+

  (publishes on 127.0.0.1 only — SSH tunnel from outside the box)
```

Identical to container mode, plus the `observability` compose profile: Prometheus (`:9090`) scrapes the API's `/metrics` endpoint and node-exporter; Grafana (`:3001`) dashboards over Prometheus metrics and Loki logs; Promtail ships container logs into Loki (`:3100`). Use it when you want metrics, logs, and dashboards locally — typically while running the k6 load tests in [`loadtest/`](../loadtest/).

_Diagrams are ASCII — regenerate `docs/index.html` with `make docs` after editing._
