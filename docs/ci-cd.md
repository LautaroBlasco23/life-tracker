# CI/CD

GitHub Actions workflows live in `.github/workflows/` at the **repository root** (GitHub only auto-discovers workflows there — workflows nested inside sub-projects are ignored).

## `backend-ci.yml`

- **`test` job**: runs on pushes/PRs touching `backend/**`. Starts the floci AWS emulator (Docker socket required), provisions S3/RDS/DocumentDB/Secrets Manager via `infra/scripts/provision.sh`, runs the integration test suite against the floci services, then deploys the API as a Lambda behind API Gateway v2 (`make floci-deploy`) and smoke-tests `/health` through the gateway. Go 1.24.
- **`build-push` job**: after tests pass, on `main` pushes only — builds and pushes the backend image to Docker Hub (`*DOCKERHUB_USERNAME*/lifetracker-backend`), and uploads Postman endpoint collections as an artifact.

## `frontend-ci.yml`

- **`build-export` job**: runs on pushes/PRs touching `frontend/**`. Installs dependencies and runs `next build` with `output: 'export'`, asserting `out/index.html` is produced.
- **`build-and-push` job**: builds and pushes the frontend image to Docker Hub (`lautaroblasco1998/lifetracker-frontend`). On PRs it builds without pushing.

## Repository Secrets

The workflows rely on Docker Hub credentials. Configure these in **Settings → Secrets and variables → Actions** of the `life-tracker` repository:

| Secret | Required by | Purpose |
|---|---|---|
| `DOCKERHUB_USERNAME` | backend-ci.yml, frontend-ci.yml | Docker Hub account used in image names and for login |
| `DOCKERHUB_TOKEN` | backend-ci.yml, frontend-ci.yml | Docker Hub access token for image push authentication |

> Note: secrets are per-repository and **do not** transfer from the old separate repos (`life-tracker-backend`, etc.). They must be added manually to this repo.
