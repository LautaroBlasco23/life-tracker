# Tests

What each suite in the repo covers, and the one command that runs it. The
root Makefile is the single entry point for all of them:

- `make test` — every unit/component suite in one go (shared · web · mobile ·
  backend). No E2E inside it.
- `make tests` — prints every test command with a one-liner each.
- E2E and performance are separate targets (`make test-backend-e2e`,
  `make test-web-e2e`, `make loadtest`): they need extra infrastructure
  (isolated test DBs, the full-stack container lane, the k6 stack) and run
  slower — opt in deliberately.

Details and conventions: see the per-project sections below (this file is
the source of truth; `docs/index.html` is generated from it by `make docs`).

## Test kinds per project

| Project | Unit | Component | Integration | E2E | Performance |
|---|---|---|---|---|---|
| backend | service logic, table-driven | — | repositories/controllers against the real compose test DBs — **one suite with unit, no tag split** | `tests/e2e` (`e2e` build tag): production router + real JWT | k6: smoke on PRs, full suite nightly |
| web (`frontend/`) | pure logic: calendar libs, palette parity | components/contexts with RTL + jsdom; `@shared` services mocked | — | Playwright (chromium) on the full-stack container lane | — |
| shared (`packages/shared/`) | pure TS logic: theme tokens, i18n en/es parity, auth service — protects both consumers at once | — | — | — | — |
| mobile (`apps/mobile/`) | pure logic: dates, input formatting | RNTL components; `className` is inert under jest, so tests assert behavior, not styling | — | none yet (Maestro deferred) | — |
| chrome-extension | manifest sanity + tracker logic | — | — | — | — |

## Backend tests

`make test-backend` — unit and integration as one suite
(`gotestsum --format=short-verbose`, testify inside).
Service logic is table-driven (`internal/domain/<name>/service`); repositories
and controllers run against isolated Docker test databases — mocking GORM is
worse than the isolation the compose DBs give — and controller tests build
their own routers with inline auth fakes.

| Command | What it does |
|---|---|
| `make test-backend` | Starts test DBs (`docker-compose.yml` with `backend/.env.test`), runs `gotestsum -race`, stops DBs |
| `make test-backend-only` | Runs the suite against already-running test DBs |
| `make test-backend-coverage` | Same suite + coverage profile (report-only) |
| `make code-check` | Format + lint (`golangci-lint`) |
| `make db-test-up` / `make db-test-down` / `make db-test-remove` | Manage the test databases manually (up / stop / remove + volumes) |

Coverage is report-only for now — no threshold yet; a ratchet (fail PR if the total drops) is planned once suites mature. Baseline (Oct 2026): **49.1% of statements** across 805 tests.

### Essential E2E suite (build tag `e2e`)

`make test-backend-e2e` — `backend/tests/e2e/` exercises the **production router** (real route registry, real JWT auth middleware, full middleware chain) against the real test DBs — unlike the controller tests, which build their own routers with inline auth fakes.

- Run locally and in CI (compose test DBs).
- Runs in CI inside the backend `test` job.
- Excluded from the default suite by the `//go:build e2e` tag, so `make test-backend` (and the `make test` aggregate) stays fast.
- Scope (deliberately small): health, register → login → refresh (real JWT issuance), anonymous call to a protected route → 401, `/users/me` + `/activities/today`, activity + note create/list lifecycle with the issued token.
- Data strategy: unique usernames per run (`e2e_<timestamp>`), no truncation — coexists with the unit suite on the same DBs.

## Shared package tests (Vitest)

`make test-shared` — pure-TS unit tests in a node environment (no DOM).
`packages/shared` is consumed from source by web and mobile, so this suite
protects both clients at once.

| Command | What it does |
|---|---|
| `make test-shared` | `npm test -w @life-tracker/shared` (`vitest run`) |
| `npm test:watch -w @life-tracker/shared` | watch mode |

- Config: `packages/shared/vitest.config.ts`; tests live next to the source (`src/**/*.test.ts`).
- Current coverage: theme token contract (`theme-colors`), i18n en/es key parity, `auth-service` (login/register error mapping, token refresh, authenticated-request retry + logout on refresh failure).
- Conventions: mock `fetch` with `vi.stubGlobal`; install a storage adapter with `setStorageAdapter` before importing the singleton `authService`; reset service state via `authService.logout()` in `afterEach`.

## Web tests (Vitest + Testing Library)

`make test-web` — component tests under jsdom: `frontend/` has its own npm
install (outside the workspaces) with Vitest + `@testing-library/react`.
Tests run against components, never the network: `@shared` services are
replaced with `vi.mock`. What they cover: rendering, interaction
(localStorage persistence, redirects, toggles) and cross-framework contracts
(palette parity) — the pieces you can verify cheaply, in milliseconds.

| Command | What it does |
|---|---|
| `make test-web` | `npm test` in `frontend/` (`vitest run`) |
| `npm run test:watch` | watch mode |

- Config: `frontend/vitest.config.ts` (jsdom, `globals: true`, `@shared` → `../packages/shared/src` alias mirroring tsconfig); setup file `frontend/test/setup.ts` (jest-dom).
- Current coverage: `ThemeProvider`/`useTheme` (localStorage persistence, CSS variable application), `ThemeToggle` (shadcn render + interaction), `AuthGuard` (auth service mocking + redirect), and `globals-parity` (frontend palette hex must exactly match `theme-colors.ts`), plus calendar components/lib logic.
- Conventions: mock `@shared/services/*` with `vi.mock('<module>', factory)` — never import the real service into a component test; mock `next/navigation`'s `useRouter`; RTL cleans up automatically (`globals: true`).

Coverage is report-only: `npm run test:coverage` (Vitest v8 provider, text + html in `coverage/`). CI prints the totals line to the job summary and uploads the html report as an artifact. Baseline (Oct 2026): **98.24% statements** — but only 4 files are under test (theme context, theme toggle, auth guard, globals parity); feature folders have zero unit coverage yet.

### Web E2E (Playwright, essential suite)

`make test-web-e2e` — the critical user paths driven through a **real
browser** against the **full-stack container lane** (static export served by
nginx with the `/api` proxy — the deploy lane, not a dev server), with real
API, real DBs and real auth: exactly what the component tests deliberately
mock out. Specs: auth-guard redirect + authenticated shell, real UI login,
notes CRUD through the UI, deploy-lane canary (`/env-config.js` + app title).

| Command | What it does |
|---|---|
| `make test-web-e2e` | Playwright, headless (chromium), against the container lane — fails fast if `make dev-container` isn't up |
| `make test-web-e2e-ui` | headed, prompts for lane (containers/dev), local-dev only; `E2E_SLOWMO_MS=<ms>` to make the flow watchable |
| `make dev-container` | Bring up the lane the specs target (postgres + mongodb + api + nginx static export; run `make stop` first if a different mode is up) |

- Config: `frontend/playwright.config.ts` — chromium only (opt into firefox/webkit with `E2E_ALL_BROWSERS=1`), `workers: 1` (specs share backend state), `retries: 2` in CI, trace `retain-on-failure`. `npx playwright test` in `frontend/` also works directly.
- Auth seeding: `e2e/helpers.ts` registers a fresh user through the API (unique username per run) and seeds the exact localStorage keys the shared auth-service hydrates (`accessToken`, `refreshToken`, `currentUser`) via `page.addInitScript` — survives reloads.
- CI: `frontend-ci.yml` `e2e` job brings up the lane (`make dev-container`), waits for API/frontend health, runs the suite headless, uploads the HTML report on failure.

## Mobile tests (jest-expo + React Native Testing Library)

`make test-mobile` — unit tests for pure logic (dates, input formatting) and
component tests with `@testing-library/react-native`: a component renders in
a lightweight in-process tree and assertions check its behavior (labels,
tiers, visibility). `className` is inert under jest, so styling is never
asserted — visual/runtime-vs-native behavior is what device testing would
cover, and is deferred.

| Command | What it does |
|---|---|
| `make test-mobile` | `npm run test -w apps/mobile` |

- Config: `apps/mobile/jest.config.js` (preset `jest-expo`, `@shared/*` mapped to source); `apps/mobile/jest.setup.js` stubs `react-native-svg` and `lucide-react-native` (native/ESM modules with no jest bridge; icons are not under test).
- `babel.config.js` compiles jest runs with the plain react JSX runtime (`api.caller` detection) instead of NativeWind's interop runtime — the interop transform rewrites every `createElement` and breaks jest mock factories. Consequence: `className` is inert under jest, so unit tests assert behaviour, not styling.
- Current coverage: `StreakBadge` (tiers, zero/hide), input formatting + date round-trips (local thousands/date-input utilities, incl. `@shared/utils/format`), calendar week logic.
- Conventions: import test globals from `@jest/globals` (explicit imports); `render` is **async** in RNTL v14 — always `await render(...)` before querying via `screen`.

Device E2E (Maestro) is deferred; when it exists it will be `make test-mobile-e2e`.

## CI

PR CI is dependency-aware: each workflow's `paths:` filter triggers only the suites that could be affected.

- `frontend-ci.yml` → prettier, `npm test` (vitest), **coverage report (artifact + job summary)**, `tsc --noEmit`, and the **`e2e` job** (Playwright essential suite on the full-stack container lane). Triggers on `frontend/**` + `packages/shared/**`.
- `mobile-ci.yml` → type-check, `npm test` (jest-expo), shared package tests (vitest), expo export. Triggers on `apps/mobile/**` + `packages/shared/**` — so a shared-package change exercises both JS consumers.
- `backend-ci.yml` → golangci-lint, integration suite **with coverage** against the compose test DBs (summary + artifact), **essential E2E suite** (build tag `e2e`), and the **`api-perf-smoke` job** (k6 `smoke.js` against the load-test stack's API; thresholds fail the PR). Triggers on `backend/**`, the compose/nginx/scripts files, `Makefile` — including the Makefile's test-target names.
- `chrome-extension-ci.yml` → `npm ci` + vitest (unit + manifest sanity) + `node --check` parse of the extension scripts. Triggers on `chrome-extension/**`.
- `nightly-loadtest.yml` → full k6 suite on a daily cron (`0 3 * * *`) + manual dispatch (`REMOTE_WRITE=0`, reports artifact). Heavy lanes are nightly-only; PRs get the smoke lane only.
- `release.yml` / `pr-title.yml` unchanged (release-please + Conventional Commits enforcement).

## Load testing (k6)

Stress tests live in [`loadtest/`](../loadtest/) — k6 scenarios that fire hundreds of requests per second across hundreds of users at different rhythms, with **live metrics in Grafana while a test runs**. k6 runs in Docker, so no local install is needed.

**Test lanes** — the same scripts target any lane via `BASE_URL`:

| Lane | Target | Default URL |
|---|---|---|
| Backend direct | compose `api` container | `http://localhost:8080` |
| Full stack | nginx frontend proxy (`make loadtest-fe-up`) | `http://localhost:3000` |
| Static assets | nginx static export (frontend serving) | `http://localhost:3000` |

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

Notes: disable live streaming with `REMOTE_WRITE=0`. The load-test stack is self-contained (the `loadtest` profile services in `docker-compose.yml` — pinned credentials, their own volumes), so it works regardless of `.env` and never touches dev DB data. Prometheus runs with remote-write receiver + native histograms enabled (`docker-compose.yml`), and app metrics are scraped every 5s (`backend/monitoring/prometheus.yml`). Dashboards are provisioned automatically from `backend/monitoring/grafana/provisioning/dashboards/`.

**In CI**: PRs touching the backend run only `smoke.js` (one user, seconds, thresholds gate the PR) against the load-test stack's API — see the `api-perf-smoke` job in `backend-ci.yml`. The full suite runs nightly via `nightly-loadtest.yml` (cron `0 3 * * *`, also manual via workflow_dispatch; results artifact in `loadtest/reports/`). Heavy lanes are deliberately kept out of PRs.
