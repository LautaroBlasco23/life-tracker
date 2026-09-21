# Testing

## Backend tests

The Go test suite (testify + httptest) runs against isolated Docker databases. From the repo root:

| Command | What it does |
|---|---|
| `make test` | Starts test DBs (`docker-compose.db.yml`), runs `gotestsum -race`, stops DBs |
| `make test-only` | Runs the suite against already-running test DBs |
| `make code-check` | Format + lint (`golangci-lint`) |
| `make db-test-up` / `make db-test-down` | Manage the test databases manually |

`make test-floci` runs the suite against the floci-provisioned services instead of the compose test DBs (the path CI uses).

## Load testing (k6)

Stress tests live in [`loadtest/`](../loadtest/) — k6 scenarios that fire hundreds of requests per second across hundreds of users at different rhythms, with **live metrics in Grafana while a test runs**. k6 runs in Docker, so no local install is needed.

**Test lanes** — the same scripts target any lane via `BASE_URL`:

| Lane | Target | Default URL |
|---|---|---|
| Backend direct | compose `api` container | `http://localhost:8080` |
| Full stack | nginx frontend proxy (`make loadtest-fe-up`) | `http://localhost:3000` |
| Static assets | nginx static export (frontend serving) | `http://localhost:3000` |
| floci gateway (optional) | emulated Lambda | `http://localhost:4566/execute-api/lifetracker-api/dev` |

**One command — the full suite**:

```bash
make loadtest                  # stack up -> provision users -> smoke -> read/write/auth/mixed
                               # -> features (full API coverage) -> cleanup.
                               # Watch Grafana (:3001) while it runs.
```

Overrides propagate to every step: `make loadtest USERS=500 RATE=600 DURATION=2m` (full list in [`loadtest.md`](./loadtest.md)). Skip the final user cleanup with `CLEANUP=0`.

**Advanced runs** (fine-tuning / specialized):

```bash
make loadtest-breakpoint       # ramp VUs until the app collapses
make loadtest-soak SOAK_RATE=200 SOAK_DURATION=30m
make loadtest-static           # frontend serving lane (needs fe-up)
make loadtest-tap              # live API responses in the terminal
make loadtest-provision USERS=500   # just create users
make loadtest-cleanup          # just delete test users
```

Every scenario streams its metrics live to Prometheus and stops on error-rate/p95 thresholds. Key overrides: `USERS`, `PREFIX`, `RATE`, `DURATION`, `BASE_URL`, `MAX_VUS`, `SOAK_*`, `LOGIN_RATE` (full table in [`loadtest.md`](./loadtest.md)).

**Live monitoring** — k6 pushes metrics to the compose Prometheus every 1s (remote write), so Grafana (`http://localhost:3001`, default `admin/admin`) shows the load side and the app side while a test runs:

- **Load Test** dashboard — merged view: VUs, req/s, error rate, p50/p95/p99, checks, plus app latency/errors by endpoint, DB connections, host CPU/mem.
- **k6 Prometheus (Native Histograms)** — official Grafana k6 dashboard.
- Existing per-domain dashboards (Activities, Finance, Notes, Time, Users & Auth, Nginx).

```bash
make loadtest-stack-up                 # Prometheus + Grafana included
make loadtest-read-heavy RATE=600 DURATION=2m   # watch it live on :3001
make loadtest-tap                      # raw API responses in the terminal
make loadtest-tap TAP_PATH=/api/notes TAP_INTERVAL=2   # time | status | latency | body
```

Notes: disable live streaming with `REMOTE_WRITE=0`; the floci/Lambda path is not scraped (separate docker network), so dashboards cover the compose lane. The load-test stack is self-contained (`infra/docker-compose.loadtest.yml` — pinned credentials, its own volumes), so it works regardless of `.env` and never touches dev DB data or floci. Prometheus runs with remote-write receiver + native histograms enabled (`infra/docker-compose.yml`), and app metrics are scraped every 5s (`backend/monitoring/prometheus.yml`). Dashboards are provisioned automatically from `backend/monitoring/grafana/provisioning/dashboards/`.
