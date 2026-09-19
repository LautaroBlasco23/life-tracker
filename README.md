# Life Tracker

A personal life-tracking platform covering **habits & activities**, **finances**, **notes**, **time tracking**, and **screen time**. This repository is a monorepo that consolidates the previous separate projects (`life-tracker-backend`, `life-tracker-frontend`, `life-tracker-extension`) into a single codebase.

---

## Repository Structure

| Directory | Project | Stack | Purpose |
|---|---|---|---|
| [`backend/`](./backend/README.md) | Life Tracker API | Go, Gin, GORM, PostgreSQL, MongoDB, JWT | REST API with domain modules: auth, user, activity (habits), finance, note, time, routine, social, screentime |
| [`frontend/`](./frontend/README.md) | Life Tracker Web App | Next.js, TypeScript, shadcn/ui | Web application for tracking activities, finances, time, notes, and profile |
| [`chrome-extension/`](./chrome-extension/README.md) | Life Tracker Screen Time Extension | JavaScript, Manifest V3 | Chrome extension that records visits to configured sites into the backend |
| [`infra/`](./infra/) | Infrastructure | docker compose, floci (AWS emulator) | All compose definitions and commands for running the stack locally |
| [`loadtest/`](./loadtest/) | Load testing | k6 (Docker), Prometheus remote write, Grafana | Stress tests: hundreds of req/s, multi-user scenarios, live dashboards |

Each project has its own `README.md` with detailed documentation. This root README covers only the monorepo architecture and shared concerns.

### Conventions

- Each sub-project is fully self-contained (own dependencies, tests, Dockerfile).
- **Path-filtered CI**: workflows trigger only when files under their directory change (e.g., `backend/**`).
- The backend and frontend workflows push Docker images to Docker Hub using repository secrets (see [`docs/ci-cd.md`](./docs/ci-cd.md)).
- **All docker compose definitions live in `infra/`** (`infra/docker-compose*.yml`, `infra/scripts/`). **Every make command lives in the root `Makefile`** — run `make` (or `make help`) from the repo root for the main commands (run modes, stop, tests), and `make components` for the full backend/frontend/databases/infra list.

---

## Documentation

| Doc | Contents |
|---|---|
| [`docs/data-schemas.md`](./docs/data-schemas.md) | Domain data schemas with one diagram per domain (activities, finance, health, user, personal) |
| [`docs/getting-started.md`](./docs/getting-started.md) | Run modes from the repo root, how to start/stop the stack, per-project setup pointers |
| [`docs/deployment-modes.md`](./docs/deployment-modes.md) | The four deployment modes (`make dev`, `dev-container`, `dev-emulator`, `dev-full`) with architecture diagrams |
| [`docs/architecture.md`](./docs/architecture.md) | AWS-shaped architecture emulated locally with floci: service mapping, request flow, provisioning & deployment |
| [`docs/ci-cd.md`](./docs/ci-cd.md) | GitHub Actions workflows (backend/frontend CI) and the required repository secrets |
| [`docs/testing.md`](./docs/testing.md) | Backend integration tests and k6 load testing with live Grafana monitoring |
| [`docs/mobile.md`](./docs/mobile.md) | Android app: building the APK via EAS, local build, and development |
| [`docs/health-roadmap.md`](./docs/health-roadmap.md) | Health section roadmap (nutrition + gym): shipped features and improvement backlog |

---

## License

Per-project licensing applies (the backend is MIT-licensed; see `backend/LICENSE`).
