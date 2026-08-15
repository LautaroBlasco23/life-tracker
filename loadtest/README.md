# Load testing (k6)

Stress tests for the life-tracker API and frontend. Capable of hundreds of
requests per second against thousands of concurrent users, with per-user
rhythms. k6 runs inside Docker — no local install needed.

## Test lanes

| Lane | Target | Default base URL | What it exercises |
|---|---|---|---|
| A — backend direct | compose `api` container | `http://localhost:8080` | Go app + Postgres + Mongo, no proxy noise |
| B — full stack | nginx frontend proxy | `http://localhost:3000` | nginx static serving + `/api` proxy + backend (run `make loadtest-fe-up`) |
| C — static assets | nginx static export | `http://localhost:3000` | pure frontend serving capacity (`static.js`) |
| D — floci gateway (optional) | emulated Lambda | `http://localhost:4566/execute-api/lifetracker-api/dev` | production-shaped path; throughput is capped by the emulator, numbers are not app-true |

All scenario scripts take `LOADTEST_BASE_URL`, so one script runs against any lane.

## Quickstart — one command

```bash
# Full suite: stack up -> provision users -> smoke -> read/write/auth/mixed
# scenarios -> cleanup. ~5 minutes with defaults. Watch Grafana while it runs.
make loadtest
```

Override anything, it propagates to every step:

```bash
make loadtest USERS=500 RATE=600 DURATION=2m   # bigger pool, faster rate, longer scenarios
make loadtest BASE_URL=http://localhost:3000   # run the whole suite through nginx (needs fe-up)
make loadtest CLEANUP=0                        # keep the test users after the run
```

`make loadtest` = `make -C loadtest run` = stack up → provision → smoke →
read-heavy → write-heavy → auth-storm → mixed-rhythms → features → cleanup.

Individual targets still exist for fine-tuning (breakpoint, soak, static, tap,
provision, cleanup, stack-*, monitoring-up, fe-*) — see `make loadtest-help` or the tables below.

## Step-by-step (manual control)

The load-test stack is **self-contained** (`infra/docker-compose.loadtest.yml`):
pinned DB credentials and its own volumes, so it works regardless of
`backend/.env` and never touches dev DB data or the floci stack.

```bash
make loadtest-stack-up                 # api + postgres + mongodb + prometheus + grafana + node-exporter
make loadtest-provision USERS=500      # create users (pool: loadtest/users.json, always fresh)
make loadtest-smoke                    # sanity check
make loadtest-read-heavy RATE=600 DURATION=2m
make loadtest-mixed-rhythms            # readers/writers/financers/spike
make loadtest-breakpoint MAX_VUS=1000  # ramp until the app collapses
make loadtest-soak SOAK_RATE=200 SOAK_DURATION=30m
make loadtest-cleanup                  # delete every pool user
make loadtest-stack-down               # stop the load-test stack
```

> Docker Desktop / WSL: if `--network host` is unavailable, use
> `BASE_URL=http://host.docker.internal:8080` (and `:3000` for the full stack).

## Scenario matrix

| Script | Executor | Rhythm | What it measures |
|---|---|---|---|
| `provision.js` | shared-iterations | N parallel registers | register throughput (bcrypt is the server CPU cost) |
| `smoke.js` | per-vu-iterations | single pass | end-to-end correctness before scaling |
| `static.js` | constant-arrival-rate | flat req/s | nginx static serving ceiling |
| `auth-storm.js` | constant-arrival-rate (2 scenarios) | flat login + refresh | bcrypt compare cost, token issuance |
| `read-heavy.js` | constant-arrival-rate | flat req/s | read throughput; Postgres 10-conn pool cliff |
| `write-heavy.js` | constant-arrival-rate | flat req/s | write throughput; Mongo `MaxConnecting(2)` throttle |
| `mixed-rhythms.js` | ramping-vus + constant-vus | reader ~0.5–1.5s, writer ~4–8s, financer ~6–10s, spike burst | realistic multi-user traffic; per-VU identity via user pool |
| `features.js` | constant-vus | full CRUD lifecycle sweep per iteration | **complete API coverage**: activities (+records/stats/revert/streak), notes, time records, routines, finances (transactions/fixed/payments/movements/monthly-stats), gym (exercises/workouts/stats), nutrition, screen time, social (follows/pending/accept/subscriptions), users (search/update/checks), auth (password/email change) |
| `breakpoint.js` | ramping-vus (stepped) | ramp to collapse | documented ceiling + failure mode |
| `soak.js` | constant-arrival-rate | sustained minutes/hours | leaks, pool exhaustion, GC behavior |

## Key variables

| Variable | Default | Used by |
|---|---|---|
| `USERS` | 100 | provision |
| `PREFIX` | `u<timestamp>` | provision (fresh prefix per run avoids collisions) |
| `RATE` | 300 | read-heavy, write-heavy |
| `DURATION` | 1m | read/write/auth/static |
| `SOAK_RATE` / `SOAK_DURATION` | 200 / 30m | soak |
| `LOGIN_RATE` / `REFRESH_RATE` | 100 / 50 | auth-storm |
| `MAX_VUS` / `STEP` / `STEP_DUR` | 1000 / 200 / 1m | breakpoint |
| `SPIKE_VUS` | 250 | mixed-rhythms |
| `BASE_URL` | `http://localhost:8080` | all |
| `LOADTEST_USERS_FILE` | `users.json` | pool-using scripts |

## Live monitoring (watch the test as it runs)

The stack ships Prometheus + Grafana. Scenario runs stream k6 metrics to
Prometheus in real time (remote write), so Grafana shows both the load side and
the app side live while a test executes.

```bash
# 1. Start the stack — Prometheus + Grafana included (Grafana on :3001)
make loadtest-stack-up

# 2. Open http://localhost:3001 (admin / admin) and pick a dashboard:
#    - "Load Test"                -> merged view: k6 load + app latency/errors + host
#    - "k6 Prometheus (Native Histograms)" -> official k6 dashboard
#    - "LifeTracker - <domain>"   -> existing per-domain dashboards

# 3. Run any scenario — metrics appear live (~1s push, 5s scrape)
make loadtest-read-heavy RATE=600 DURATION=2m

# 4. Optional: watch raw API responses in the terminal while it runs
make tap                       # taps /api/activities/today every 1s
make tap TAP_PATH=/api/notes TAP_INTERVAL=2
```

Mechanics:
- k6 runs with `-o experimental-prometheus-rw` by default
  (`K6_PROMETHEUS_RW_SERVER_URL`, push every 1s, trend metrics as native
  histograms). Disable with `REMOTE_WRITE=0`.
- Prometheus must run with `--web.enable-remote-write-receiver` and
  `--enable-feature=native-histograms` — already set in `infra/docker-compose.yml`.
- App metrics (`lifetracker_http_*`, `lifetracker_db_connections_active`, ...)
  are scraped every 5s (`backend/monitoring/prometheus.yml`).

> The floci/Lambda path is NOT scraped — live dashboards cover the compose lane
> (`make loadtest-stack-up`), which is the lane the scenarios target by default.

## Reports & monitoring

- Scenario runs write raw k6 metrics to `loadtest/reports/<script>-<timestamp>.json`.
- The terminal summary already prints req/s, p50/p95/p99, and error rates.
- During a run, watch Grafana (`http://localhost:3001`, dashboards listed above)
  and optionally `make tap` for raw responses.
- Prometheus + Grafana run with the compose stack (`make loadtest-stack-up` or
  `make loadtest-monitoring-up`); the API exposes `/metrics`. Watch
  `http_req_duration`, pool waits, and Mongo connection saturation during runs.

## Known bottlenecks to look for

- **Postgres pool**: `SetMaxOpenConns(10)` — expect p99 to climb first under
  read/write concurrency. This is a tuning finding, not a test failure.
- **Mongo**: `SetMaxConnecting(2)` throttles connection ramp.
- **bcrypt**: every register/login does a `DefaultCost` hash/compare.
- **Tokens**: access tokens default to 24h expiry — pools are session-scoped;
  soaks longer than that need a refresh step or a fresh pool.

## Cleanup

`make loadtest-cleanup` deletes every user in `users.json` (each with its own
token). Rows created by write scenarios are removed with the users. For a hard
reset of the load-test stack (fresh DBs):

```bash
make loadtest-stack-down
docker compose -f infra/docker-compose.yml -f infra/docker-compose.loadtest.yml down -v
```
