# CI/CD

GitHub Actions workflows live in `.github/workflows/` at the **repository root** (GitHub only auto-discovers workflows there — workflows nested inside sub-projects are ignored).

## `backend-ci.yml`

- **`test` job**: runs on pushes/PRs touching `backend/**` (plus `infra/**`, `Makefile`). Starts the floci AWS emulator (Docker socket required), provisions S3/RDS/DocumentDB/Secrets Manager via `infra/scripts/provision.sh`, runs the integration test suite against the floci services (`make test-floci-coverage` — same suite with a coverage profile; the total goes to the job summary and `coverage.out` is uploaded as an artifact), then runs the **essential E2E suite** (`make test-e2e-floci` — production router + real JWT middleware), then deploys the API as a Lambda behind API Gateway v2 (`make floci-deploy`) and smoke-tests `/health` through the gateway. Go 1.25.
- **`api-perf-smoke` job**: after `test`, runs the k6 `smoke.js` lane (one fresh user, seconds) against the deployed floci gateway. k6 thresholds (p95, error rate) fail the PR on breach. Heavy load-test lanes run nightly instead — see `nightly-loadtest.yml`.
- **`build-push` job**: runs **only on `vX.Y.Z` tags** — builds and pushes the backend image to Docker Hub (`*DOCKERHUB_USERNAME*/lifetracker-backend`) tagged `X.Y.Z`, `X.Y` and `latest`, and uploads Postman endpoint collections as an artifact.

## `frontend-ci.yml`

- **`lint` job**: PR gate on pushes/PRs touching `frontend/**` (plus `packages/shared/**`) — prettier check, vitest unit tests, **coverage report** (totals to the job summary + html artifact; report-only), `tsc --noEmit`.
- **`e2e` job**: spins up the full-stack container lane (`make dev-container`: postgres + mongodb + api + nginx static export with the `/api` proxy on :3000) and runs the Playwright essential suite (`frontend/e2e/` — auth guard, UI login, notes CRUD, deploy canary). Playwright HTML report uploaded on failure. Essential-only: deeper E2E is follow-up work.
- **`build-export` job**: runs `next build` with `output: 'export'`, asserting `out/index.html` is produced.
- **`build-and-push` job**: runs **only on `vX.Y.Z` tags** — builds and pushes the frontend image to Docker Hub (`lautaroblasco1998/lifetracker-frontend`) tagged `X.Y.Z`, `X.Y` and `latest`, then smoke-tests the pushed image.
- **`smoke` job**: after `build-and-push`, pulls `:latest` (the just-pushed release image) and verifies nginx serving, env injection and the `/api` proxy.

## `mobile-ci.yml`

- PR gate on `apps/mobile/**` + `packages/shared/**`: type-check, jest-expo unit tests, shared package vitest tests, expo Android export (bundle build as validation).

## `chrome-extension-ci.yml`

- PR gate on `chrome-extension/**`: `npm ci` + vitest (pure-logic unit tests + manifest sanity) + `node --check` parse of the extension scripts.

## `nightly-loadtest.yml`

- Full k6 suite (smoke → read/write-heavy → auth-storm → mixed-rhythms → features) via root `make loadtest` on a daily cron (`0 3 * * *`), also manual (`workflow_dispatch`). Each k6 script's thresholds gate the run; k6 JSON reports are uploaded as an artifact. Observability streaming disabled (`REMOTE_WRITE=0`).

## `release.yml` — versioning workflow

Releases are **PR-driven** (release-please):

1. Every PR is squash-merged to `main`, so each PR title becomes one conventional commit. PR titles are validated by `pr-title.yml` (`feat:`, `fix:`, `chore:`, … — required).
2. After each merge to `main`, release-please inspects commits since the last release and opens/updates a **release PR** (`chore(main): release X.Y.Z`) that bumps `package.json` (root, frontend, shared), mobile `app.json` and `CHANGELOG.md` in one commit.
3. **Merging the release PR** creates the `vX.Y.Z` tag + GitHub Release, which triggers the Docker `build-push`/`build-and-push` jobs in both CI workflows. No other event builds images.
4. Bump rules: `feat!`/`fix!`/`BREAKING CHANGE` → **major**, `feat` → **minor**, `fix`/`perf` → **patch**, other types → no release.
5. Highest bump wins if several PRs merge before the release PR is merged (one version absorbs them all, `feat` beats `fix`).

The app version displayed in the web navbar is injected at build time from `frontend/package.json` (`next.config.mjs` → `NEXT_PUBLIC_APP_VERSION`), so navbar and release versions never drift.

> **Branch-protection note:** release-please commits via `GITHUB_TOKEN`. If strict branch protection ("require PRs") is enabled on `main`, add an exemption for that actor or a PAT in the release job, or release PRs can't be created/updated.

## Repository Secrets

The workflows rely on Docker Hub credentials. Configure these in **Settings → Secrets and variables → Actions** of the `life-tracker` repository:

| Secret | Required by | Purpose |
|---|---|---|
| `DOCKERHUB_USERNAME` | backend-ci.yml, frontend-ci.yml | Docker Hub account used in image names and for login |
| `DOCKERHUB_TOKEN` | backend-ci.yml, frontend-ci.yml | Docker Hub access token for image push authentication |

> Note: secrets are per-repository and **do not** transfer from the old separate repos (`life-tracker-backend`, etc.). They must be added manually to this repo.
