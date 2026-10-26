# CI/CD

GitHub Actions workflows live in `.github/workflows/` at the **repository root** (GitHub only auto-discovers workflows there — workflows nested inside sub-projects are ignored).

## `backend-ci.yml`

- **`test` job**: path-filtered on pushes (`backend/**` plus compose/nginx/scripts/`Makefile`); on PRs it runs unconditionally (required checks — see Merge ruleset). Runs the integration test suite against the compose test DBs (`make test-backend-coverage` — same suite with a coverage profile; the total goes to the job summary and `coverage.out` is uploaded as an artifact), **Lint (golangci-lint)** and **Vulnerability check (govulncheck)** in the same job, then runs the **essential E2E suite** (`make test-backend-e2e` — production router + real JWT middleware). Go 1.26.
- **`api-perf-smoke` job**: after `test`, boots the self-contained load-test stack (`make loadtest-stack-up`) and runs the k6 `smoke.js` lane (one fresh user, seconds) against the compose API on `:8080`. k6 thresholds (p95, error rate) fail the PR on breach. Heavy load-test lanes run nightly instead — see `nightly-loadtest.yml`.
- **`build-push` job**: runs **only on `vX.Y.Z` tags** — builds and pushes the backend image to Docker Hub (`*DOCKERHUB_USERNAME*/lifetracker-backend`) tagged `X.Y.Z`, `X.Y` and `latest`, and uploads the per-domain JSON endpoint files from `backend/endpoints/` as an artifact.

## `frontend-ci.yml`

- **`lint` job**: PR gate (unconditional — see Merge ruleset; path-filtered on pushes touching `frontend/**` + `packages/shared/**`) — prettier check, vitest unit tests, **coverage report** (totals to the job summary + html artifact; report-only), `tsc --noEmit`, and a **prod dependency audit** (`node scripts/audit-prod.mjs`).
- **`e2e` job**: spins up the full-stack container lane (`make dev-container`: postgres + mongodb + api + nginx static export with the `/api` proxy on :3000) and runs the Playwright essential suite (`frontend/e2e/` — auth guard, UI login, notes CRUD, deploy canary). Playwright HTML report uploaded on failure. Essential-only: deeper E2E is follow-up work.
- **`build-export` job**: runs `next build` with `output: 'export'`, asserting `out/index.html` is produced.
- **`build-and-push` job**: runs **only on `vX.Y.Z` tags** — builds and pushes the frontend image to Docker Hub (`lautaroblasco1998/lifetracker-frontend`) tagged `X.Y.Z`, `X.Y` and `latest`, then smoke-tests the pushed image.
- **`smoke` job**: after `build-and-push`, pulls `:latest` (the just-pushed release image) and verifies nginx serving, env injection, deep-link routes (`/notes`, `/finance/`), the `GATEWAY_UPSTREAM` nginx var and the `/api` proxy.

## `mobile-ci.yml`

- PR gate (unconditional on PRs; path-filtered on pushes for `apps/mobile/**` + `packages/shared/**` + `scripts/**` + the workflow file): type-check, jest-expo unit tests, shared package vitest tests, a prod dependency audit (`npm audit`), and expo Android export (bundle build as validation).

## `chrome-extension-ci.yml`

- PR gate on `chrome-extension/**`: `npm ci` + vitest (pure-logic unit tests + manifest sanity) + `node --check` parse of the extension scripts.

## `nightly-loadtest.yml`

- Full k6 suite (smoke → read/write-heavy → auth-storm → mixed-rhythms → features) via root `make loadtest` on a daily cron (`0 3 * * *`), also manual (`workflow_dispatch`). Each k6 script's thresholds gate the run; k6 JSON reports are uploaded as an artifact. Observability streaming disabled (`REMOTE_WRITE=0`).

## `security.yml`

- Secret scan (gitleaks) on every PR and every push to `main` (full history on the first run). `backend/.env.test` throwaway test fixtures are allowlisted in `.gitleaks.toml` — keep real credentials out of them anyway. Not in the required-checks list (advisory), but treat failures as must-fix.

## Repo automation

- **`.github/dependabot.yml`** — weekly updates for npm (root workspaces), gomod (backend), docker and GitHub Actions, with grouped minor/patch bumps.
- **`.github/CODEOWNERS`** — per-path code owners for review requests.

## `pr-title.yml`

- Validates every PR title against a conventional prefix (`feat:`, `fix:`, `chore:`, …). Required check **"Conventional title"** on `main` — release-please computes versions from squash-merged titles (see `release.yml`), so a wrongly-titled PR cannot merge.

## Merge ruleset (`main`)

Repository ruleset on `main`: PRs required (any merge method), branch deletion and force-push blocked, and the following required status checks. Backend/front/mobile CI have **no paths filters on `pull_request`** (unlike `chrome-extension-ci.yml`, which is path-scoped and not required) because the ruleset blocks merges while any required context is unreported:

| Required check | Workflow |
|---|---|
| `test`, `api-perf-smoke` | backend-ci.yml |
| `lint`, `build-export`, `e2e` | frontend-ci.yml |
| `type-check-and-export` | mobile-ci.yml |
| `Conventional title` | pr-title.yml |

`Secret scan (gitleaks)` is not required, and `release-please--branches--main` PRs run the exact same required checks (release-please PRs are exempted from nothing).

## `release.yml` — versioning workflow

Releases are **PR-driven** (release-please):

1. Every PR is squash-merged to `main`, so each PR title becomes one conventional commit. PR titles are validated by `pr-title.yml` (`feat:`, `fix:`, `chore:`, … — required).
2. After each merge to `main`, release-please inspects commits since the last release and opens/updates a **release PR** (`chore(main): release X.Y.Z`) that bumps `package.json` (root, frontend, shared), mobile `app.json` and `CHANGELOG.md` in one commit.
3. **Merging the release PR** creates the `vX.Y.Z` tag + GitHub Release, which triggers the Docker `build-push`/`build-and-push` jobs in both CI workflows. No other event builds images.
4. Bump rules: `feat!`/`fix!`/`BREAKING CHANGE` → **major**, `feat` → **minor**, `fix`/`perf` → **patch**, other types → no release.
5. Highest bump wins if several PRs merge before the release PR is merged (one version absorbs them all, `feat` beats `fix`).

The app version displayed in the web navbar is injected at build time from `frontend/package.json` (`next.config.mjs` → `NEXT_PUBLIC_APP_VERSION`), so navbar and release versions never drift.

> **Branch-protection note:** release-please commits via `RELEASE_PAT` (configured; falls back to `GITHUB_TOKEN` if unset). A PAT avoids the strict-branch-protection exemption problem — GITHUB_TOKEN-created release PRs can't pass a "require PRs" ruleset without an exemption.

## Repository Secrets

The workflows rely on Docker Hub credentials. Configure these in **Settings → Secrets and variables → Actions** of the `life-tracker` repository:

| Secret | Required by | Purpose |
|---|---|---|
| `DOCKERHUB_USERNAME` | backend-ci.yml, frontend-ci.yml | Docker Hub account used in image names and for login |
| `DOCKERHUB_TOKEN` | backend-ci.yml, frontend-ci.yml | Docker Hub access token for image push authentication |
| `RELEASE_PAT` | release.yml | PAT used by release-please so created tags trigger the Docker build/push workflows (GITHUB_TOKEN-created tags never trigger other workflows) |

> Note: secrets are per-repository and **do not** transfer from the old separate repos (`life-tracker-backend`, etc.). They must be added manually to this repo.
