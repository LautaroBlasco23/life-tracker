# Getting Started

Life Tracker is a personal life-tracking platform — habits & activities, routines, reminders, notes, finances, time tracking, screen time, and a social layer — shipped as a set of apps over one Go API.

## The project at a glance

| App | What it is | Tech | More |
|---|---|---|---|
| Backend API | The REST API every client talks to | Go (Gin), PostgreSQL + MongoDB, JWT | [backend.md](./backend.md) |
| Web frontend | Browser app | Next.js 14 (static export), Tailwind v4, shadcn/ui | [frontend.md](./frontend.md) |
| Mobile (Android) | Native app | Expo / React Native, expo-router, NativeWind | [mobile.md](./mobile.md) |
| Shared packages | Business logic, services, types, i18n — reused by web + mobile | TypeScript (`packages/shared`) | — |

Each app is self-contained; its doc covers the setup details. For how the pieces fit together (compose services, request flow, deployment), see [Architecture](./architecture.md).

## Fast start

```bash
make setup   # copies .env.example → .env (repo root)
make dev     # databases in Docker + API (:8080) + web app (:3000), hot-reloading
make stop    # tear everything down
```

Open `http://localhost:3000` (API at `http://localhost:8080/api`). This is the daily loop: air and `next dev` pick up changes live, so re-running `make dev` doubles as the restart command.

## Run modes

Run modes from the repository root (one at a time; `make stop` stops whichever is running):

| Command | Mode | What runs | URLs |
|---|---|---|---|
| `make dev` | Fast lane (host) | air hot-reload on the host (`:8080`) + postgres + mongodb in compose + `next dev` (`:3000`). No app containers, no observability. | API `:8080/api`, app `:3000` |
| `make dev-container` | Container | API container + postgres + mongodb + frontend (nginx proxies `/api` → `:8080`). No observability. | API `:8080/api`, app `:3000` |
| `make dev-full` | Container + observability | Same as `make dev-container` plus Prometheus, Grafana, Loki, Promtail, node-exporter. | + Prometheus `:9090`, Grafana `:3001`, Loki `:3100` |
| `make mobile` | Mobile dev loop | Android emulator (Windows) + API (`:8080`) + Metro (`:8081`) + app launch; `[R]` rebuilds the native app. | app on emulator, API `:8080/api` |

All of them are idempotent — re-running a mode's command redeploys the backend and frontend with the latest code, so it doubles as the restart command (`make dev` needs no restart at all: air and `next dev` pick up changes live). See [Deployment Modes](./deployment-modes.md) for the full description of each mode, and [mobile.md](./mobile.md) for the mobile loop.

- `make stop` tears down everything (`docker compose down` with every profile passed, so it removes every running service of the project, including observability and the frontend container). For the mobile loop, `make mobile-stop` stops what `make mobile` started (API + Metro).
- **Setup**: `make setup` copies `.env.example` → `.env` (root). **`GRAFANA_ADMIN_PASSWORD` is mandatory for the observability stack** (`dev-full`) — compose fails loudly if unset; `.env.example` includes the key.
- **Tests**: `make test` (all unit suites: shared · web · mobile · backend),
  `make test-backend-e2e` / `make test-web-e2e` (E2E lanes), `make loadtest`
  — the full command list via `make tests`, details in
  [tests.md](./tests.md) and [loadtest.md](./loadtest.md).
- **Backend**: [`backend.md`](./backend.md) — `make backend-dev` runs the API with databases (air hot reload).
- **Infrastructure**: the root `Makefile` (`make help`) owns every docker compose command. Compose file: `docker-compose.yml` at the repo root (api + postgres + mongodb + web; the observability and load-test stacks are compose *profiles* — `observability` and `loadtest` — so the plain `up` never starts them). nginx configs in `nginx/`, deploy/migrate scripts in `scripts/`.
- **Frontend**: [`frontend.md`](./frontend.md) — install dependencies and run the Next.js dev server. The static export is served at `http://localhost:3000` via `make frontend-up` (nginx, `/api` proxied same-origin to the API container) and rebuilt into the web volume via `make deploy-frontend` (the `make dev-container` / `dev-full` lanes do this automatically).
