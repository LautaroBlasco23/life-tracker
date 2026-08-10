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

Each project has its own `README.md` with detailed documentation. This root README covers only the monorepo architecture and shared concerns.

---

## Monorepo Layout

```
.
├── .github/workflows/     # CI/CD (root-level, GitHub Actions only detects workflows here)
│   ├── backend-ci.yml     # Backend tests + floci Lambda deploy smoke
│   └── frontend-ci.yml    # Frontend static export + Docker image build/push
├── backend/               # Go REST API
├── frontend/              # Next.js web application
├── infra/                 # All docker compose files + commands (docker/floci tooling)
├── chrome-extension/      # Chrome MV3 extension
└── README.md
```

### Conventions

- Each sub-project is fully self-contained (own dependencies, tests, Dockerfile, and Makefile).
- **Path-filtered CI**: workflows trigger only when files under their directory change (e.g., `backend/**`).
- The backend and frontend workflows push Docker images to Docker Hub using repository secrets (see below).
- **All docker compose definitions and commands live in `infra/`** (`infra/docker-compose*.yml`, `infra/Makefile`, `infra/scripts/`). The backend/frontend Makefiles delegate their compose targets there (`make -C infra <target>`).

---

## CI/CD

GitHub Actions workflows live in `.github/workflows/` at the **repository root** (GitHub only auto-discovers workflows there — workflows nested inside sub-projects are ignored).

### `backend-ci.yml`

- **`test` job**: runs on pushes/PRs touching `backend/**`. Starts the floci AWS emulator (Docker socket required), provisions S3/RDS/DocumentDB/Secrets Manager via `infra/scripts/provision.sh`, runs the integration test suite against the floci services, then deploys the API as a Lambda behind API Gateway v2 (`make floci-deploy`) and smoke-tests `/health` through the gateway. Go 1.24.
- **`build-push` job**: after tests pass, on `main` pushes only — builds and pushes the backend image to Docker Hub (`*DOCKERHUB_USERNAME*/lifetracker-backend`), and uploads Postman endpoint collections as an artifact.

### `frontend-ci.yml`

- **`build-export` job**: runs on pushes/PRs touching `frontend/**`. Installs dependencies and runs `next build` with `output: 'export'`, asserting `out/index.html` is produced.
- **`build-and-push` job**: builds and pushes the frontend image to Docker Hub (`lautaroblasco1998/lifetracker-frontend`). On PRs it builds without pushing.

---

## Repository Secrets

The workflows rely on Docker Hub credentials. Configure these in **Settings → Secrets and variables → Actions** of the `life-tracker` repository:

| Secret | Required by | Purpose |
|---|---|---|
| `DOCKERHUB_USERNAME` | backend-ci.yml, frontend-ci.yml | Docker Hub account used in image names and for login |
| `DOCKERHUB_TOKEN` | backend-ci.yml, frontend-ci.yml | Docker Hub access token for image push authentication |

> Note: secrets are per-repository and **do not** transfer from the old separate repos (`life-tracker-backend`, etc.). They must be added manually to this repo.

---

## Getting Started

Each project is self-contained; see its README for setup:

- **Backend**: [`backend/README.md`](./backend/README.md) — `make start` runs the API with databases (Docker Compose). For the AWS-shaped path: `make -C infra floci-up` / `floci-provision` / `floci-deploy`, or from `backend/`: `make floci-up` / `floci-provision` / `floci-dev` / `floci-deploy`.
- **Infrastructure**: [`infra/Makefile`](./infra/Makefile) — every docker compose command (`make -C infra help`). Compose files: `docker-compose.yml` (full stack), `docker-compose.db.yml` (legacy DBs), `docker-compose.frontend.yml` (frontend container).
- **Frontend**: [`frontend/README.md`](./frontend/README.md) — install dependencies and run the Next.js dev server. The static export is served at `http://localhost:3000` via `make -C infra frontend-up` (nginx; the local stand-in for CloudFront, since floci's CloudFront data-plane has parity gaps) and synced to S3 as a deploy artifact via `make -C infra deploy-frontend`.
- **Chrome Extension**: [`chrome-extension/README.md`](./chrome-extension/README.md) — load as an unpacked extension pointing at a local backend.

---

## License

Per-project licensing applies (the backend is MIT-licensed; see `backend/LICENSE`).
