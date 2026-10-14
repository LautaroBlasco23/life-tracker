# Getting Started

Each project is self-contained; see its doc in `docs/` for setup.

Run modes from the repository root (one at a time; `make stop` stops whichever is running):

| Command | Mode | What runs | URLs |
|---|---|---|---|
| `make dev` | Fast lane (host) | air hot-reload on the host (`:8080`) + postgres + mongodb in compose + `next dev` (`:3000`). No app containers, no observability. | API `:8080/api`, app `:3000` |
| `make dev-container` | Container | API container + postgres + mongodb + frontend (nginx proxies `/api` → `:8080`). No observability. | API `:8080/api`, app `:3000` |
| `make dev-full` | Container + observability | Same as `make dev-container` plus Prometheus, Grafana, Loki, Promtail, node-exporter. | + Prometheus `:9090`, Grafana `:3001`, Loki `:3100` |

All of them are idempotent — re-running a mode's command redeploys the backend and frontend with the latest code, so it doubles as the restart command (`make dev` needs no restart at all: air and `next dev` pick up changes live). See [Deployment Modes](./deployment-modes.md) for the full description of each mode.

- `make stop` tears down everything (`docker compose down` with every profile passed, so it removes every running service of the project, including observability and the frontend container).
- **Backend**: [`backend.md`](./backend.md) — `make backend-dev` runs the API with databases (air hot reload).
- **Infrastructure**: the root `Makefile` (`make help`) owns every docker compose command. Compose file: `docker-compose.yml` at the repo root (api + postgres + mongodb + web; the observability and load-test stacks are compose *profiles* — `observability` and `loadtest` — so the plain `up` never starts them). nginx configs in `nginx/`, deploy/migrate scripts in `scripts/`.
- **Frontend**: [`frontend.md`](./frontend.md) — install dependencies and run the Next.js dev server. The static export is served at `http://localhost:3000` via `make frontend-up` (nginx, `/api` proxied same-origin to the API container) and rebuilt into the web volume via `make deploy-frontend` (the `make dev-container` / `dev-full` lanes do this automatically).
- **Chrome Extension**: [`chrome-extension.md`](./chrome-extension.md) — load as an unpacked extension pointing at a local backend.
