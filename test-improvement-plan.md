# Test Improvement Plan — Implementation Log

Working log for the test-improvement effort (analysis → implementation).
Updated as work progresses; "Issues found" section grows live.

Status legend: [x] done · [~] in progress · [ ] pending · [!] blocked

## Phase 1 — path-aware CI restructure

Status: executed as dependency-aware triggering (decision locked with user —
reviewed & confirmed 2026-10-07). Sealed decision: shared-package changes
(`packages/shared/**`) trigger BOTH frontend and mobile suites (not backend);
bidirectional "safety mode" cross-triggering was offered and declined.

- [x] Backend CI: removed duplicated `pull_request:` trigger block (real YAML
      bug found in `.github/workflows/backend-ci.yml`; the block was pasted
      twice verbatim — GitHub tolerated it but it masked edits).
- [x] Backend CI: Go version drift fixed — workflow pinned 1.24, go.mod says
      1.25, Dockerfile golang:1.25-alpine, CLAUDE.md says 1.26.2 (three stds).
      Bumped workflow env to 1.25 to match go.mod + Dockerfile; CLAUDE.md
      version claim is written down for the user to reconcile separately.
- [x] Coverage (report-only, decision locked): `test-floci-coverage` Makefile
      target added; CI prints total to `$GITHUB_STEP_SUMMARY`, uploads
      `coverage.out` artifact (retention 7).
- [~] Path-abstraction debt: repo currently uses per-workflow static `paths:`
      filters instead of a shared dorny/paths-filter changes job. Decision:
      keep per-workflow static filters (Phase 1 minimal) because the existing
      filters already encode the dependency rule (shared → both frontend and
      mobile workflows); dorny moved to backlog as a follow-up, not blocking.
- [x] New `chrome-extension-ci.yml` (job: npm ci, vitest, manifest sanity test).
- [x] New `nightly-loadtest.yml` (k6 full suite on cron + workflow_dispatch,
      observability off, thresholds gate via k6 exit codes).

## Phase 2 — backend essential E2E + coverage fills

Status: [x] (verified green; see per-item notes)

- [x] Extracted `newRouter` from `cmd/main/main.go` into
      `backend/internal/server/router.go` (exported `server.NewRouter`) so the
      E2E suite can boot the production router with real JWT middleware.
      Moved verbatim; zero behavior change (build + full suite verified).
- [x] New `backend/tests/e2e/e2e_test.go`, build tag `e2e`; TestMain boots
      router + DBs; 7 tests: health, register/login/refresh (real JWT
      issuance), 401 on anonymous protected route, /users/me +
      /activities/today, activity+note lifecycle (incl. cross-user 404),
      CORS preflight 204, register validation 400. All green with -race,
      both DB orders (e2e-first-on-fresh-migrations and after-unit-AutoMigrate)
      verified. **Fix by main agent: the E2E agent claimed but never wrote the
      `//go:build e2e` line — added it; default `./...` now excludes e2e
      (865 default tests + 7 e2e).**
- [x] Real migration bootstrap hardened (order-independence): the E2E TestMain
      now drops and recreates the `public` schema before running migrations.
      Without it, running e2e AFTER the unit suite on the compose test DBs
      failed with "Dirty database version 1" (unit suites AutoMigrate tables
      without recording schema_migrations; migration 1 then collides). With
      the reset, e2e always applies migrations v1..vN to a clean slate —
      same as the CI/floci lane. FINAL VERIFICATION: full unit suite
      (870 tests, -race, fresh DB) → e2e right after → 7/7 green.
- [x] Makefile targets added: `test-e2e` (compose test DBs), `test-e2e-floci`
      (CI path), `test-floci-coverage`, `loadtest-stack-up/down` delegations.
- [x] `social` domain now tested: 42 tests green (follow lifecycle incl.
      private-target pending→accept/reject, visibility rules matrix,
      public-profile shape + private guard, subscriptions for activity +
      routine with clone semantics).
- [x] `note` controller test added: 18 tests green (all 5 routes, envelope,
      filters, 404/400 paths). Surfaced REAL bugs — see issues below.
- [x] Pre-existing golangci-lint failures on committed main FIXED (they were
      red for any backend PR): gocyclo/govet/gocritic across
      `activity/streak/streak.go` (extracted buildSchedules/dueOn/dayStatus),
      `finance/service/finance_service.go` (extracted collectMovements +
      movement builders), `routine/service/routine_service.go` (extracted
      routineUpdates), `social/service/profile_service.go` (extracted
      resolveProfileTarget/decorateFollowStatus/ownerLocation/
      viewerSubscriptionMap/buildRoutineCards/buildActivityCards/
      profileContent). Full backend: `golangci-lint run ./...` → 0 issues,
      865 tests green (-race, fresh).
- [ ] Routine/Reminder/Data controller tests — NOT done in this pass
      (note controller was the representative coverage; more valuable now
      given the missing-auth-guard finding).

## Phase 3 — frontend suites + Playwright E2E

Status: [x] (verified green locally; feature-level unit tests deferred)

- [x] Playwright scaffold in `frontend/` (chromium-only project, `PLAYWRIGHT_BASE_URL`
      env, workers=1, retries in CI, 1280×720 desktop viewport), dev-dep
      install inside `frontend/` (outside npm workspaces), `test:e2e` script.
      Specs: auth guard redirect, seeded-auth shell, UI login, notes CRUD,
      deploy-lane canary (`/env-config.js` + title). **All 5 verified passing
      locally (2s total) against the full-stack lane.**
- [x] Auth seeding verified against source: the shared auth-service persists
      exactly `accessToken`, `refreshToken`, `currentUser` in localStorage and
      hydrates at module import — specs seed via `page.addInitScript`
      (runs before the bundle; survives reloads).
- [x] frontend-ci.yml: coverage report step (`vitest --coverage` v8, totals to
      step summary + html artifact; baseline **98.24% statements** but only 3
      files under test) + the `e2e` job (spins `make dev-container`, waits for
      API + frontend health, runs essential specs, uploads Playwright HTML
      report on failure; timeout 40m).
- [x] Local verification workaround (user's `make dev` occupies :3000):
      equivalent lane = static export + disposable nginx (proxy /api → fresh
      API container on the compose network) on :3100; torn down afterwards.
- [x] Fix applied to the REAL deploy config (production-relevant): nginx
      directory redirects dropped the published port — see issue #13.
- [ ] Frontend feature-level unit coverage (finance, auth views, activities,
      notes) — deferred to a follow-up PR (independent, large).

## Phase 4 — mobile & chrome extension

Status: [~]

- [x] chrome-extension made testable: pure logic extracted to
      `chrome-extension/lib/tracker.js` (`buildApiUrl`, `matchDomain`,
      `isTrackedHost`, `normalizeDomainInput`), vitest (node env) +
      package.json in the extension dir; 23 tests incl. manifest sanity
      (MV3, module service worker, referenced files exist, ESM import smoke).
      Verified green locally.
- [x] Real bug found & fixed: `background.js` used
      `url.hostname.endsWith(d)` — matches false positives ("notsocial.com"
      endswith "social.com"). Now boundary-aware matching. Visits for every
      non-tracked site would have been silently dropped OR wrongly sent —
      the false-positive case was sends for untracked hosts. **The same
      suffix-match bug existed in `popup.js`'s track-banner check too** — both
      call sites now share the fixed helper.
- [x] `.github/workflows/chrome-extension-ci.yml` — node 22, `npm ci` + vitest
      as single gate. The `type: module` service worker already existed in
      manifest.json (verified), so no manifest change was needed.
- [ ] Mobile feature-screen jest coverage (mocked services) — deferred;
      NativeWind/jest interop gotchas documented in docs/testing.md make this a
      larger effort; independent follow-up.

## Phase 5 — k6 in CI

Status: [x]

- [x] `api-perf-smoke` job added to backend-ci: k6 `smoke.js` against the
      deployed floci gateway on every backend PR; k6 thresholds (p95<5s,
      error<10%) fail the PR on breach without needing a live Prometheus.
      Verified: smoke.js needs no user pool (registers a unique fresh user)
      and no Prometheus (no remote-write env/output passed).
- [x] `nightly-loadtest.yml`: full k6 suite (smoke, read/write-heavy,
      auth-storm, mixed-rhythms, features) on a daily cron (`0 3 * * *`) +
      `workflow_dispatch`; `REMOTE_WRITE=0`; `loadtest/reports/` artifact
      (retention 14); stack stopped after run.
- [ ] Pin `grafana/k6:latest` (unpinned, matches loadtest/Makefile today).

## Phase 6 — test-target namespace + docs restructure

Status: [x] (Makefile renames, CI call sites, docs/tests.md — executed
2026-10-25; decided in plan session: `make test` = all unit suites (no E2E),
component vocabulary is `web` over `frontend`, full list via `make tests`
+ docs, chrome extension stays outside the Makefile).

- [x] Consistent `test-<component>[-<kind>]` namespace in the root Makefile:
      `test-backend[-only|-coverage|-e2e]` (renames of test/test-only/
      test-coverage/test-e2e), `test-web[-e2e|-e2e-ui]` (renames of
      test-frontend/test-e2e-ui), `test-shared`/`test-mobile` unchanged.
      `test` redefined as the aggregate `test-shared test-web test-mobile
      test-backend` (unit-first ordering so failures surface before the slow
      backend suite). `test-js` dropped (superseded by the aggregate); no
      old-name aliases kept — clean cut.
- [x] New `test-web-e2e` target: headless Playwright against the container
      lane (the frontend-ci `e2e` job's lane), fail-fast curl guards (must see
      `/env-config.js`, not just a listener on :3000 — a dev server doesn't
      count; plus API health through the `/api` proxy).
- [x] New `tests` target: full printed list of every test command (pattern of
      `make components`); `make help` TEST section slimmed to test /
      test-backend / test-web / tests / loadtest.
- [x] CI call sites: `backend-ci.yml` now runs `make test-backend-coverage`
      and `make test-backend-e2e`. frontend-ci unchanged (manages its own
      lane around inline `npm run test:e2e`; switching it to `make
      test-web-e2e` left as a possible follow-up).
- [x] Docs restructured: `docs/testing.md` → `docs/tests.md` (title "Tests"),
      new top matter: approach + navigation, per-project "test kinds" matrix,
      per-project lead-ins explaining what each suite kind is/covers; all
      command names updated. References updated: `docs/build.js` (list + nav),
      `docs/getting-started.md`, `docs/frontend.md`, `docs/ci-cd.md`,
      `AGENTS.md`, `README.md`. `CHANGELOG.md` untouched (release-please).
- [x] `make docs` regenerated `docs/index.html`.

## Coverage gates

Decision locked with user: report-only everywhere (backend Go coverage in
backend-ci step-summary + artifact; frontend Vitest coverage in frontend-ci
step-summary + artifact). Ratchet (fail PR if total drops) consciously deferred
until suites mature; revisit when baseline stabilizes.

## Issues found during implementation

> (Items 13–21 were added during the integration/verification pass; the
> numbered list is append-only. Item numbering matches the text below.)
22. **Parallel actor in the repo during implementation**: two commits landed
    mid-session that I did not author — `b23c0c6 feat(security): revocable
    sessions, rate limiting and endpoint hardening` and `b5de183 test:
    repo-wide test hardening` (the latter includes this work's changes).
    b23c0c6 explains the intermittent auth/refresh-token test failures chased
    during verification (code changed under running suites) and part of the
    docker container churn. It also hardened the chrome extension's
    `buildApiUrl` (https for remote hosts) without updating its tests — 2
    failures surfaced in the final green-check; tests aligned to the new
    behavior (23/23 green).
23. **Final green-check of the committed tree** (post b5de183): backend 870
    tests + 7 e2e green (-race, fresh DB), shared 16, mobile 14, frontend 8,
    chrome 23 — all passing; `make code-check` → 0 issues; prettier clean.

1. **`backend-ci.yml` had a duplicated `pull_request:` trigger block** — the
   identical trigger pasted twice; GitHub accepted it, but it duplicated the
   path filters (masked edit risk).
2. **Go version drift (three sources of truth)**: backend-ci env `1.24`, go.mod
   `1.25`, Dockerfile `golang:1.25-alpine`, `backend/CLAUDE.md` claims 1.26.2,
   local toolchain is 1.26.8. CI now matches go.mod/Dockerfile (1.25); CLAUDE.md
   needs a one-line reconciliation (left for the user or a later commit).
3. **Local uncommitted work in the working tree** (frontend/mobile unit tests,
   vitest/jest configs, `frontend-ci` add-test steps, testing docs) is present
   as uncommitted changes. Our changes build ON TOP of it; a careless `git
   checkout .` would lose existing work. Nothing was overwritten.
4. **`backend/CLAUDE.md` type-drift note**: says Go 1.26.2 — doesn't match
   go.mod (1.25). Trivial doc fix, left out of scope here (report separately).
5. **`backend/coverage.out` stale committed file** present in working tree from
   previous runs — reported, not touched (CI artifact now replaces ad-hoc
   files; `.gitignore` already ignores coverage.out, so it's just local dirt).
6. **Chrome-extension `background.js` domain-matching false positives**
   (`endsWith` without boundary) — fixed during extraction with boundary-aware
   `isTrackedHost`. (Detail in Phase 4 above.)
7. **Migration-schema vs AutoMigrate drift** in backend tests: unit/repo test
   packages AutoMigrate exact models, but the real schema (SQL migrations) can
   lack columns/tables those models expect. Investigated by the E2E agent:
   the real migration schema (v15) IS sufficient for all essential flows —
   no AutoMigrate fallback was needed. Remaining difference is cosmetic
   (GORM uniqueIndex vs named migration indexes on auths).
8. **`docs/testing.md` said Playwright E2E and Maestro are "planned"** —
   Playwright now exists and gates PRs; docs updated (docs/testing.md +
   docs/ci-cd.md refreshed to match reality).
9. **`infra/` has no CI-testable compose lane for the frontend e2e** out of the
   box — the frontend e2e CI job assembles the full-stack lane itself; if a
   dedicated `docker-compose.e2e.yml` is wanted, it is follow-up work.
10. **k6 smoke lane in CI was not wired at all** — `'make loadtest'`-only docs,
    no `.github/workflows` reference (found during analysis; fixed by
    api-perf-smoke + nightly-loadtest).
11. **chrome-extension was fully outside CI/release automation** (no tests, no
    workflow, no paths filter, hardcoded `1.0`, not in release-please
    extra-files) — first CI step added; release automation remains open.
12. **Reminder domain**: only service tests exist; no controller, no repository
    tests, and its routes are untested at the route-registration level.
13. **REAL BUG (production-relevant), fixed: nginx dropped the published port
    in directory redirects.** `try_files $uri $uri/` makes nginx 301
    `/login` → `Location: http://host/login/` using the container's INTERNAL
    port (80). curl reuses the original port (so the existing CI smoke job
    never caught it), but browsers/fetch/undici go to port 80 →
    `ERR_CONNECTION_REFUSED` whenever the lane runs on a nonstandard port
    (compose web = :3000, CI e2e lane, any non-80 deploy). Root cause of the
    flaky E2E run during verification. Fixed with `absolute_redirect off;`
    in `infra/nginx/nginx.conf` (safe for prod: relative redirects are
    spec-correct).
14. **REAL BUG: note controller has no auth guard.** `ctx.GetUint("userID")`
    silently returns 0 when middleware is absent (activity/social use
    `middleware.GetUserIDFromContext` → 401). NOT fixed (behavior change;
    needs a product decision, and the regression test must enshrine the FIX,
    not the bug). Check whether routine/reminder/data share the pattern.
15. **Dirty test-DB migration state caught by the new E2E suite**: the test
    Postgres had `schema_migrations version=1, dirty=t` while later-migration
    tables existed (an interrupted migration from an earlier session). E2E
    fails fast on it (correct behavior — the suite catching infra drift).
    Surgical fix applied: recreate `life_tracker_test` + drop the test Mongo
    database.
16. **`make db-test-remove` is dangerous**: `docker-compose.db.yml` declares
    BOTH dev and test volumes in the same compose project, so `down -v` with
    `--env-file backend/.env.test` would also wipe DEV DB volumes. Do not use
    as-is; needs a compose split (follow-up).
17. **Old `golang_api_server` container**: an orphan running a pre-validation
    build; after rebuilding with current code it crash-loops because the
    compose env carries the placeholder JWT secret that the new config.Load
    rejects. Left `Exited` (dev mode runs air on the host; this container
    isn't part of `make dev`). Regenerate a real `JWT_SECRET` in `.env`
    before using container mode.
18. **Pre-existing lint failures on committed main** (now fixed — see Phase 2):
    `gocyclo 31` on `ProfileService.GetPublicProfile`, err-shadows in
    profile_service/routine_service, gocritic ifElseChain in streak.go.
19. **Subagent reliability (process finding)**: the backend E2E agent claimed
    the `//go:build e2e` tag but never wrote it; the frontend agent finished
    without writing the CI job / coverage steps its config referenced. Both
    gaps caught and fixed in the integration pass — agent claims must be
    re-verified against the actual tree.
20. **Local `.env` placeholder `JWT_SECRET` breaks the dev lane (pre-existing,
    confirmed)**: `make dev`'s air was crash-looping for hours BEFORE this
    session ("exit status 1" ×18 in `backend/tmp/build-errors.log`, server
    down on :8080) because the committed config validation rejects insecure
    placeholder secrets. One-time fix applied without reading the file:
    appended a generated `JWT_SECRET=$(openssl rand -hex 32)` to `.env`
    (godotenv takes the last value). **User action still needed: restart
    `make dev`** (Ctrl-C + re-run) — the running air watcher is wedged and
    only picks up the fix on a fresh start.
21. **Environmental instability during verification**: test DB containers
    were stopped/removed mid-run several times (traced to stale `make test`
    processes from a previous session whose teardown finally fired, plus
    overlapping agent DB operations). Final verification was re-run in
    isolated steps with container checks between stages; all green.

## Open questions / deferred items

- Mobile Maestro device E2E — unchanged, still deferred (documented).
- Coverage ratchet (fail PR when total drops) — deferred by decision.
- dorny/paths-filter shared changes-job — follow-up; static filters suffice.
- Frontend feature-level unit tests (finance/activities/notes views/hooks) —
  not started; recommend a dedicated follow-up PR.
- Mobile feature-screen tests — same.
- chrome-extension release automation (version stamping, workspace/repo
  release-please wiring) — open.
- `reminder` repository tests — open.
- Document the backend e2e build-tag invocation — done: docs/tests.md
  documents `make test-backend-e2e` and `make tests` lists it (Phase 6).
