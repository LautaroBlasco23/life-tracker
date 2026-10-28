# Root Makefile — the single entry point for the life-tracker repo.
#
# Deployment is plain docker compose at the repo root (docker-compose.yml +
# nginx/ + scripts/); `make` / `make help` shows the main commands only;
# `make components` lists the backend/frontend/databases/docker commands and
# `make tests` lists every test command.
#
# The run modes (see docker-compose.yml + scripts/ for the details). One mode
# at a time; stop before switching (ports overlap):
#   make dev           - fast lane: air hot-reload on the host (:8080) +
#                        compose postgres + mongodb + `next dev` (:3000).
#                        No app containers; fastest feedback loop.
#   make dev-container - container mode: API as a plain container (:8080) +
#                        postgres + mongodb + frontend on :3000. Prod-built
#                        image + static export; parity check.
#   make dev-full      - container mode + observability (Prometheus, Grafana,
#                        Loki, Promtail, node-exporter).
#
# Recipe convention: backend tooling runs inside `cd backend`; compose and
# scripts run from the repo root. The compose project name is pinned to
# `infra` inside docker-compose.yml (keeps the historical volume/network
# names, so no dev-data migration).

# Host-run Go tooling (air, gotestsum, ...) is installed via `make
# install-tools` into GOPATH/bin, which is often not on PATH — expose it to
# every recipe shell so `air` etc. resolve without shell config changes.
GOPATH_BIN := $(shell go env GOPATH 2>/dev/null)/bin
export PATH := $(GOPATH_BIN):$(PATH)

# The mobile key loop uses bash-only `read -n 1` (single keypress); the rest
# of the recipes are POSIX-compatible, so this is safe globally.
SHELL := /bin/bash

GREEN := \033[1;32m
DIM   := \033[2m
RST   := \033[0m

# Fixed dev JWT secret: every worktree points at the same compose `infra`
# databases, so a token signed in one checkout must verify in all the others.
# A per-worktree openssl value silently logs everyone out on worktree switch.
# Value is intentionally NOT in backend's insecureSecrets; prod deployments
# set their own secret and never source this file path.
DEV_JWT_SECRET := dev-jwt-life-tracker-6b3f9c2e7d4a8150b2e6c9f3a7d1e5b0

# Env file for docker commands: root .env when present, else .env.example (dev
# defaults). Absolute so it survives recipe shells; consumed via --env-file
# (variable substitution) and by scripts/migrate.sh.
ENV_FILE := $(if $(wildcard $(CURDIR)/.env),$(CURDIR)/.env,$(CURDIR)/.env.example)

# Compose wrapper (project name pinned in docker-compose.yml).
COMPOSE := docker compose -f docker-compose.yml

.PHONY: help components docs tests dev dev-container dev-full stop test \
	test-backend test-backend-only test-backend-coverage test-backend-e2e \
	test-web test-web-e2e test-web-e2e-ui test-shared test-mobile \
	loadtest loadtest-% loadtest-stack-up loadtest-stack-down \
	backend-dev backend-start setup install-tools code-check hooks \
	fe-run-dev fe-build-dev fe-logs-dev fe-shell-dev fe-clean \
	fe-docker-up fe-docker-down fe-docker-restart \
	db-up db-down db-remove db-test-up db-test-down db-test-remove \
	frontend-up frontend-down \
	mobile mobile-rebuild mobile-logs mobile-stop \
	monitoring-up monitoring-down dev-migrate deploy-frontend

.DEFAULT_GOAL := help

help:
	@printf "$(GREEN)  Life Tracker$(RST)\n"
	@printf "  Run from the repo root.\n"
	@printf "\n"
	@printf "$(GREEN)  RUN$(RST) — one mode at a time; stop before switching\n"
	@printf "    make dev            fast lane: air (api :8080) · next dev (web :3000) · compose db\n"
	@printf "    make dev-container  container mode: API :8080 · postgres · mongo · web :3000\n"
	@printf "    make dev-full       container mode + observability: Prometheus :9090 · Grafana :3001\n"
	@printf "    make mobile         mobile dev loop: emulator + API + Metro · [R] rebuilds native app\n"
	@printf "\n"
	@printf "$(GREEN)  STOP$(RST)\n"
	@printf "    make stop           stops EVERYTHING, whichever mode is running\n"
	@printf "\n"
	@printf "$(GREEN)  TEST$(RST)\n"
	@printf "    make test           all unit suites: backend · shared · web · mobile\n"
	@printf "    make test-backend   backend unit/integration — full list: make tests\n"
	@printf "    make test-web       web component tests — full list: make tests\n"
	@printf "    make tests          every test command (unit · e2e · coverage)\n"
	@printf "    make loadtest       k6 full suite — also: loadtest-breakpoint / -soak / -tap\n"
	@printf "\n"
	@printf "$(GREEN)  DOCS$(RST)\n"
	@printf "    make docs           build + open the docs page (docs/index.html, self-contained)\n"
	@printf "\n"
	@printf "$(DIM)  ── component-level ──────────────────────────────────────────────$(RST)\n"
	@printf "\n"
	@printf "    Components: 🧠 backend · 🖥️  frontend · 🗄️  databases · 🐳 docker\n"
	@printf "    Run $(GREEN)%s$(RST) to see the full list\n" "make components"
	@printf "    Run $(GREEN)%s$(RST) for every test command (details: docs/tests.md)\n" "make tests"

components:
	@printf "\n"
	@printf "$(GREEN)  🧠 Backend only$(RST)\n"
	@printf "    make %-18s %s\n" "backend-dev"      "hot-reload Go app with air (starts dev databases)"
	@printf "    make %-18s %s\n" "backend-start"    "setup + backend-dev"
	@printf "    make %-18s %s\n" "setup"            "create .env from .env.example"
	@printf "    make %-18s %s\n" "code-check"       "gofumpt + golangci-lint (with --fix)"
	@printf "    make %-18s %s\n" "install-tools"    "gofumpt, golangci-lint, air, gotestsum"
	@printf "    make %-18s %s\n" "hooks"            "install git hooks (backend/.githooks)"
	@printf "\n"
	@printf "$(GREEN)  🖥️  Frontend only$(RST)\n"
	@printf "    make %-18s %s\n" "fe-run-dev"       "dev container with hot reload on :3000"
	@printf "    make %-18s %s\n" "fe-build-dev"     "build the dev image"
	@printf "    make %-18s %s\n" "fe-logs-dev"      "follow dev container logs"
	@printf "    make %-18s %s\n" "fe-shell-dev"     "shell into the dev container"
	@printf "    make %-18s %s\n" "fe-docker-up"     "prod-build container on :3000 (bakes prod API URL)"
	@printf "    make %-18s %s\n" "fe-docker-down"   "stop/remove the prod-build container"
	@printf "    make %-18s %s\n" "fe-docker-restart" "fe-docker-down + fe-docker-up"
	@printf "    make %-18s %s\n" "fe-clean"         "remove containers + images + docker prune"
	@printf "\n"
	@printf "$(GREEN)  🗄️  Databases (the run modes manage their own)$(RST)\n"
	@printf "    make %-18s %s\n" "db-up"            "start dev databases"
	@printf "    make %-18s %s\n" "db-down"          "stop dev databases"
	@printf "    make %-18s %s\n" "db-remove"        "remove dev databases and volumes"
	@printf "    make %-18s %s\n" "db-test-up"       "start test databases"
	@printf "    make %-18s %s\n" "db-test-down"     "stop test databases"
	@printf "    make %-18s %s\n" "db-test-remove"   "remove test databases and volumes"
	@printf "\n"
	@printf "$(GREEN)  🐳 Docker$(RST)\n"
	@printf "    make %-18s %s\n" "frontend-up"      "serve static export at :3000 (nginx; /api -> api:8080)"
	@printf "    make %-18s %s\n" "frontend-down"    "stop the frontend container"
	@printf "    make %-18s %s\n" "deploy-frontend"  "build static export, copy into the web volume"
	@printf "    make %-18s %s\n" "monitoring-up"    "Prometheus, Grafana, Loki, Promtail, node-exporter"
	@printf "    make %-18s %s\n" "monitoring-down"  "stop the monitoring stack"
	@printf "\n"
	@printf "$(GREEN)  📱 Mobile (emulator on Windows, build in WSL)$(RST)\n"
	@printf "    make %-18s %s\n" "mobile" "one command dev loop: emulator + build + API + Metro + launch"
	@printf "    %-24s %s\n" "" "then stays open: [R] rebuild+reinstall · Enter relaunch · q quit"
	@printf "    make %-18s %s\n" "mobile-rebuild" "rebuild the native app + reinstall (same as the [R] key)"
	@printf "    make %-18s %s\n" "mobile-logs"      "tail API + Metro logs"
	@printf "    make %-18s %s\n" "mobile-stop"      "stop what make mobile started (pidfiles)"

# --- Docs ---
#
# docs/ markdown files are the source of truth; docs/build.js inlines them
# (+ the vendored marked parser) into a single self-contained docs/index.html
# that works over file://, styled like the app (see styles.md). Re-run `make
# docs` after editing any markdown to regenerate and open the page.
docs:
	node docs/build.js
	@xdg-open docs/index.html >/dev/null 2>&1 || \
		explorer.exe "$$(wslpath -w docs/index.html)" >/dev/null 2>&1 || \
		echo "✓ built docs/index.html — open it in a browser"

# --- Run modes ---

# Fast lane: backend hot-reloads with air on the host (config.Load() walks up
# from backend/ and picks up the root .env, which points at localhost hosts);
# frontend hot-reloads with `next dev` hitting the API directly on :8080 (the
# backend's CORS middleware allows it in dev). Databases run in compose via
# db-up; the API runs its embedded migrations on every (re)start, so no
# explicit migrate step is needed. Ctrl-C stops air + the frontend; the
# databases stay up (make stop / make db-down to stop them).
# Air (and other Go tooling) lives in GOPATH/bin via `make install-tools`.
# Fail fast with the fix instead of starting the frontend and erroring later.
CHECK_AIR = command -v air >/dev/null 2>&1 || { echo "air not found — run 'make install-tools'"; exit 1; };
# Air dies at startup ('Process Exit with Code 1') before binding :8080 when
# JWT_SECRET is a placeholder — the frontend would build fine and then fail
# every fetch. Known-weak values are defined in backend/internal/config
# (insecureSecrets); the ($(...)? form also matches an empty/missing value so
# .env files seeded straight from .env.example are caught before air spawns.
CHECK_ENV = grep -Eq '^JWT_SECRET=(your-secret-key-here|default-secret-change-this|dev-secret-change-me|changeme|secret)?$$' $(ENV_FILE) 2>/dev/null && { \
		echo "JWT_SECRET is an insecure placeholder in $(notdir $(ENV_FILE)) — fix with:"; \
		echo '  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=dev-jwt-life-tracker-6b3f9c2e7d4a8150b2e6c9f3a7d1e5b0|" .env'; \
		exit 1; \
	} || true

dev: setup db-up
	@echo "==> fast lane: air (api :8080) + next dev (web :3000) + compose databases"
	$(CHECK_AIR)
	@echo "==> env file: $(notdir $(ENV_FILE))"
	@[ -f "$(ENV_FILE)" ] || (echo ".env/.env.example not found — run 'make setup'"; exit 1)
	$(CHECK_ENV)
	@until docker exec golang_api_postgres pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
	@[ -d frontend/node_modules ] || (echo "==> installing frontend deps"; cd frontend && npm install)
	@echo "==> frontend: next dev on :3000 (NEXT_PUBLIC_API_URL -> :8080/api)"
# setsid gives the frontend its own process group so the cleanup kill
# (`kill -- -$$fe_pid`) takes down the whole npm -> node -> next-server tree;
# killing just the npm pid leaves next-server orphaned, holding :3000.
	setsid sh -c 'cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8080/api exec npm run dev' & \
	fe_pid=$$!; \
	trap 'kill -- -$$fe_pid 2>/dev/null' EXIT INT; \
	echo "==> backend: air on :8080 (Ctrl-C stops both)"; \
	cd backend && air -c .air.toml; \
	status=$$?; kill -- -$$fe_pid 2>/dev/null; exit $$status

# Container mode: api + databases + frontend, no observability.
dev-container:
	@echo "==> container mode: api + postgres + mongodb + frontend"
	@echo "==> env file: $(notdir $(ENV_FILE))"
	@[ -f "$(ENV_FILE)" ] || (echo ".env/.env.example not found — run 'make setup'"; exit 1)
	$(COMPOSE) --env-file $(ENV_FILE) up -d --build
	@echo "==> migrations"
	@$(MAKE) --no-print-directory dev-migrate
	@echo "==> frontend (nginx /api -> api:8080)"
	bash scripts/deploy-frontend.sh
	@echo ""
	@echo "Container mode ready:"
	@echo "  API:      http://localhost:8080/api"
	@echo "  Frontend: http://localhost:3000  (proxies /api to :8080)"

# Container mode + observability (Prometheus, Grafana, Loki, Promtail,
# node-exporter). Prometheus scrapes api:8080; Grafana on :3001.
dev-full:
	@echo "==> container mode + observability"
	@echo "==> env file: $(notdir $(ENV_FILE))"
	@[ -f "$(ENV_FILE)" ] || (echo ".env/.env.example not found — run 'make setup'"; exit 1)
	$(COMPOSE) --env-file $(ENV_FILE) --profile observability up -d --build
	@echo "==> migrations"
	@$(MAKE) --no-print-directory dev-migrate
	@echo "==> frontend (nginx /api -> api:8080)"
	bash scripts/deploy-frontend.sh
	@echo ""
	@echo "Container mode + observability ready:"
	@echo "  API:         http://localhost:8080/api"
	@echo "  Frontend:    http://localhost:3000  (proxies /api to :8080)"
	@echo "  Prometheus:  http://localhost:9090  (targets: api:8080, node-exporter)"
	@echo "  Grafana:     http://localhost:3001  (admin/admin by default)"
	@echo "  Loki:        http://localhost:3100"

# Stops whichever mode is up: compose down ignores profiles only when they are
# passed — pass them all explicitly so every service of the project (including
# observability + loadtest) is removed, plus the running web container.
stop:
	$(COMPOSE) --profile observability --profile loadtest down
	@# `make dev`'s frontend runs on the host, not in compose — compose down
	@# can't stop it. Kill any next dev / next-server belonging to this repo
	@# (next-server retitles its cmdline, so match it via /proc cwd instead).
	@pkill -f "$(CURDIR)/frontend/node_modules/.bin/[n]ext" 2>/dev/null; \
	for pid in $$(pgrep -f '[n]ext-server' 2>/dev/null); do \
		[ "$$(readlink /proc/$$pid/cwd 2>/dev/null)" = "$(CURDIR)/frontend" ] && kill "$$pid" 2>/dev/null; \
	done; true

# Migrations for the container-mode lanes (runs inside a container attached to
# the compose network; the API container also runs its embedded migrations on
# every start, so this is an explicit standalone equivalent).
dev-migrate:
	ENV_FILE='$(ENV_FILE)' bash scripts/migrate.sh

# --- Backend ---

setup:
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
		sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(DEV_JWT_SECRET)|" .env; \
		echo "✓ .env created (JWT_SECRET set to the shared dev value). Review and update configuration if needed."; \
	else \
		echo "✓ .env already exists"; \
	fi

backend-start: setup backend-dev

install-tools:
	cd backend && go install mvdan.cc/gofumpt@latest
	cd backend && go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.7.2
	cd backend && go install github.com/air-verse/air@latest
	cd backend && go install gotest.tools/gotestsum@latest

code-check:
	cd backend && gofumpt -l -w .
	cd backend && golangci-lint run --fix ./...

hooks:
	cd backend && git config core.hooksPath .githooks
	cd backend && chmod +x .githooks/*

backend-dev: hooks db-up
	$(CHECK_AIR)
	$(CHECK_ENV)
	@until docker exec golang_api_postgres pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
	# config.Load() walks up from backend/ and picks up the root .env.
	cd backend && air -c .air.toml

# Essential E2E: production router + real JWT auth middleware against the
# compose test DBs. Guarded by the `e2e` build tag, so the regular suite
# (`make test-backend`, part of the `make test` aggregate) stays fast. Does
# not truncate shared tables — uses unique users per run, so it coexists with
# unit/integration runs on the same DBs.
test-backend-e2e: db-test-up
	cd backend && ENVIRONMENT=test gotestsum --format=short-verbose -- -race -tags=e2e ./tests/e2e/...; \
	TEST_EXIT=$$?; \
	$(MAKE) -C $(CURDIR) db-test-down; \
	exit $$TEST_EXIT

# Browser E2E (Playwright, headed chromium). Prompts for the lane to target:
#   [1] container lane (`make dev-container` — nginx static export on :3000
#       proxying /api to the backend; what CI runs), or
#   [2] dev lane (`make dev` — next dev on :3000, API on :8080 directly).
# Runs headed so the browser is visible. CI keeps the headless container lane
# (`npm run test:e2e`, also wrapped by `make test-web-e2e`); this target is
# local-dev only.
# E2E_SLOWMO_MS=<ms> delays every browser operation so the flow is watchable.
test-web-e2e-ui:
	@echo "E2E UI lane:"; \
	echo "  [1] containers  make dev-container — nginx :3000 with /api proxy (what CI runs)"; \
	echo "  [2] dev         make dev — next dev :3000, API on :8080 directly"; \
	echo "  (slow it down: make test-web-e2e-ui E2E_SLOWMO_MS=400)"; \
	printf "Select lane [1/2] (default 1): "; \
	lane=$$(IFS= read -r l </dev/tty 2>/dev/null && echo "$$l" || echo 1); \
	lane=$${lane:-1}; \
	CHROME=$$(cd frontend && node -e "try{process.stdout.write(require('@playwright/test').chromium.executablePath())}catch(e){process.exit(1)}" 2>/dev/null); \
	if [ -z "$$CHROME" ] || [ ! -f "$$CHROME" ]; then \
		echo "chromium not installed for Playwright."; \
		echo "run: cd frontend && npx playwright install chromium"; \
		exit 1; \
	fi; \
	if [ "$$lane" = "2" ]; then \
		curl -sf http://localhost:3000 >/dev/null || { echo "dev server not up on :3000 — run 'make dev' first"; exit 1; }; \
		curl -sf http://localhost:8080/health >/dev/null || { echo "API not up on :8080 — run 'make dev' first"; exit 1; }; \
		echo "==> dev lane: next dev :3000, API :8080 (direct, CORS wildcard)"; \
		cd frontend && E2E_SLOWMO_MS=$(E2E_SLOWMO_MS) PLAYWRIGHT_API_URL=http://localhost:8080/api npx playwright test --headed; \
	else \
		curl -sf http://localhost:3000/env-config.js >/dev/null || { echo "container lane not up on :3000 (a dev server doesn't count) — run 'make dev-container' first"; exit 1; }; \
		echo "==> container lane: nginx :3000 with /api proxy"; \
		cd frontend && E2E_SLOWMO_MS=$(E2E_SLOWMO_MS) npx playwright test --headed; \
	fi

# --- Tests ---
#
# Naming convention: test-<component>[-<kind>], e.g. test-backend-e2e.
# `make test` is the aggregate of every unit/component suite (no E2E — the
# E2E/performance lanes need infrastructure and run slower; make lists them
# all). The full command list: `make tests` or docs/tests.md.

# Unit-first ordering so failures surface before the slower backend suite
# (which boots isolated Docker test DBs). No E2E inside — see `tests`.
test: test-shared test-web test-mobile test-backend

# Backend unit + integration suite against the isolated compose test DBs
# (postgres :5433 / mongodb :27018 via backend/.env.test) + race detector.
# Renamed from `test` so `test` could become the all-suites aggregate.
test-backend: db-test-up
	cd backend && ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 ./...; \
	TEST_EXIT=$$?; \
	$(MAKE) -C $(CURDIR) db-test-down; \
	exit $$TEST_EXIT

# Same suite against already-running test DBs (no up/down dance) — for a
# fast loop next to a manual `make db-test-up`.
test-backend-only:
	cd backend && ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 ./...

# Same suite plus a coverage profile (report-only; thresholds are ratcheted
# against this baseline later).
test-backend-coverage: db-test-up
	cd backend && ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 -coverprofile=./coverage.out ./...; \
	TEST_EXIT=$$?; \
	$(MAKE) -C $(CURDIR) db-test-down; \
	go tool cover -func=./coverage.out | tail -1; \
	exit $$TEST_EXIT

# Shared package unit tests (vitest, node env): pure TS consumed from source
# by web and mobile, so one suite protects both consumers.
test-shared:
	npm test -w @life-tracker/shared

# Web component tests: vitest + Testing Library under jsdom; the network is
# never hit — @shared services are vi.mocked. Renamed from `test-frontend`
# (user-facing names now match the test-web* family).
test-web:
	cd frontend && npm test

# Web E2E, headless — the lane frontend-ci.yml runs. Playwright specs against
# the full-stack container lane (nginx :3000 static export proxying /api to
# the api container). Needs `make dev-container` up: a bare `next dev` server
# on :3000 is NOT enough (no /env-config.js, no /api proxy). For a headed run
# with lane selection, use `make test-web-e2e-ui`.
test-web-e2e:
	@curl -sf http://localhost:3000/env-config.js >/dev/null || (echo "container lane not up on :3000 (a dev server doesn't count) — run 'make dev-container' first"; exit 1)
	@# A protected route must return 401 through the /api proxy: proves nginx is
	@# proxying AND the backend is alive (the retry lane guards in CI use the
	@# compose network; here everything must work from the host).
	@code=$$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/users/me); \
	[ "$$code" = "401" ] || (echo "API not reachable through the /api proxy on :3000 (HTTP $$code) — check the containers ('docker ps', 'make dev-container' logs)"; exit 1)
	cd frontend && npx playwright test

# Mobile unit + component tests: jest-expo + React Native Testing Library.
test-mobile:
	npm run test -w apps/mobile

# The full test command list that `make help` only samples. Printed here so
# discovery doesn't require opening docs; docs/tests.md is the detailed
# source of truth (commands, what each suite covers, conventions).
tests:
	@printf "\n"
	@printf "$(GREEN)  Tests — every command$(RST)  (details in docs/tests.md)\n"
	@printf "    make %-24s %s\n" "test" "all unit suites: shared · web · mobile · backend (no E2E)"
	@printf "    make %-24s %s\n" "test-backend" "backend unit/integration — isolated test DBs + race detector"
	@printf "    make %-24s %s\n" "test-backend-only" "backend suite against already-running test DBs (no up/down)"
	@printf "    make %-24s %s\n" "test-backend-coverage" "backend suite + coverage profile (report-only)"
	@printf "    make %-24s %s\n" "test-backend-e2e" "backend E2E — production router + real JWT (build tag e2e)"
	@printf "    make %-24s %s\n" "test-web" "web component tests (vitest + Testing Library)"
	@printf "    make %-24s %s\n" "test-web-e2e" "web E2E headless (Playwright) — needs 'make dev-container' up"
	@printf "    make %-24s %s\n" "test-web-e2e-ui" "web E2E headed (Playwright) — prompts for lane, local only"
	@printf "    make %-24s %s\n" "test-shared" "shared package unit tests (vitest, node env)"
	@printf "    make %-24s %s\n" "test-mobile" "mobile unit + component tests (jest-expo + RNTL)"
	@printf "    make %-24s %s\n" "loadtest" "k6 full suite (also loadtest-<scenario>) — see loadtest.md"
	@printf "    make %-24s %s\n" "db-test-up/down/remove" "manage the backend test databases manually"

# --- Load testing in CI ---

# Backend service + test DBs only (no observability, no Prometheus): the lane
# the nightly k6 suite runs against. Heavy scenarios stay out of PRs entirely.
loadtest-stack-up:
	$(MAKE) -C loadtest stack-up

loadtest-stack-down:
	$(MAKE) -C loadtest stack-down

# Delegate every `make loadtest-<target>` to loadtest/Makefile, forwarding
# command-line variables (USERS=500, RATE=600, BASE_URL=..., ...).
# Plain `make loadtest` runs the full suite (see loadtest/Makefile `run`).
loadtest:
	$(MAKE) -C loadtest run

loadtest-%:
	$(MAKE) -C loadtest $*

# --- Frontend (local docker, outside the compose stack) ---

fe-docker-up:
	cd frontend && docker build \
		--build-arg NEXT_PUBLIC_API_URL=https://api-lifetracker.lautaroblasco.com/api \
		-t nextjs-app:latest .
	cd frontend && docker run -d \
		--name nextjs-app \
		-p 3000:3000 \
		--restart unless-stopped \
		nextjs-app:latest
	@echo "App running at http://localhost:3000"

fe-docker-down:
	-docker stop nextjs-app
	-docker rm nextjs-app

fe-docker-restart: fe-docker-down fe-docker-up

fe-build-dev:
	cd frontend && docker build -f Dockerfile.dev -t nextjs-app-dev:latest .

fe-run-dev: fe-build-dev
	cd frontend && docker run -d \
		--name nextjs-app-dev \
		-p 3000:3000 \
		-v $(CURDIR)/frontend:/app \
		-v /app/node_modules \
		nextjs-app-dev:latest
	@echo "Development container running at http://localhost:3000"

fe-clean: fe-docker-down
	-docker stop nextjs-app-dev
	-docker rm nextjs-app-dev
	-docker rmi nextjs-app:latest
	-docker rmi nextjs-app-dev:latest
	docker system prune -f

fe-logs-dev:
	docker logs -f nextjs-app-dev

fe-shell-dev:
	docker exec -it nextjs-app-dev /bin/sh

# --- Databases (postgres + mongodb via the root compose file) ---
# Dev and test DBs are the same services with different env files (.env vs
# backend/.env.test): separate containers, ports (:5432/:27017 vs
# :5433/:27018), volumes and network (see docker-compose.yml).

db-up:
	@[ -f "$(ENV_FILE)" ] || (echo ".env/.env.example not found — run 'make setup'"; exit 1)
	$(COMPOSE) --env-file $(ENV_FILE) up -d postgres mongodb

db-down:
	$(COMPOSE) --env-file $(ENV_FILE) stop postgres mongodb

db-remove:
	$(COMPOSE) --env-file $(ENV_FILE) rm -sf postgres mongodb
	docker volume rm -f infra_postgres_data infra_mongodb_data infra_mongodb_config

# db-test-* commands layer .env.example (covers the grafana password guard)
# under backend/.env.test (wins for every DB/substitution variable).

db-test-up:
	@[ -f backend/.env.test ] || (echo "backend/.env.test not found"; exit 1)
	$(COMPOSE) --env-file .env.example --env-file backend/.env.test up -d postgres mongodb

db-test-down:
	@[ -f backend/.env.test ] || (echo "backend/.env.test not found"; exit 1)
	$(COMPOSE) --env-file .env.example --env-file backend/.env.test stop postgres mongodb

db-test-remove:
	@[ -f backend/.env.test ] || (echo "backend/.env.test not found"; exit 1)
	$(COMPOSE) --env-file .env.example --env-file backend/.env.test rm -sf postgres mongodb
	docker volume rm -f infra_postgres_test_data infra_mongodb_test_data infra_mongodb_test_config

# --- Monitoring ---

monitoring-up:
	$(COMPOSE) --env-file $(ENV_FILE) --profile observability up -d node-exporter prometheus grafana loki promtail

monitoring-down:
	$(COMPOSE) --env-file $(ENV_FILE) stop node-exporter prometheus grafana loki promtail

# --- Frontend container (nginx; part of the compose stack) ---

frontend-up:
	$(COMPOSE) --env-file $(ENV_FILE) up -d web
	@echo "App running at http://localhost:3000"

frontend-down:
	$(COMPOSE) --env-file $(ENV_FILE) stop web

# Build the static export and copy it into the running web container.
deploy-frontend: frontend-up
	bash scripts/deploy-frontend.sh

# --- Android (WSL2: emulator on Windows, build in WSL · native Linux: all local) ---
#
# Dev loop for apps/mobile. The host is auto-detected by the presence of
# wslpath (only exists inside WSL); force either mode with WSL=1 or WSL=0.
#
# WSL2: no USB passthrough or accelerated emulation, so the emulator runs
# on the Windows host while Gradle, Metro (:8081) and the API (:8080)
# stay in WSL. The bridge is the Windows adb.exe driven from WSL via
# interop — no firewall changes needed:
#   - RN debug builds reach Metro through the emulator's host alias
#     10.0.2.2:8081 (react-native's AndroidInfoHelpers emulator default);
#   - the API is baked at bundle time as 10.0.2.2 (see
#     apps/mobile/.env.example).
#   - both aliases resolve to the Windows host loopback, which forwards
#     into WSL ONLY with mirrored networking (`networkingMode=mirrored`
#     in %USERPROFILE%\.wslconfig): NAT-mode forwarding is IPv6-only and
#     the emulator speaks IPv4.
# Native Linux: adb/emulator come from ANDROID_HOME (default ~/Android/Sdk);
# KVM gives acceleration and 10.0.2.2 reaches the host loopback directly —
# no mirrored networking, adb.exe or wslpath needed. Fedora needs the
# android-36 platform + build-tools 36.0.0 and JDK 21 (see docs/mobile.md).
# Common: `adb kill-server` once after an emulator start if the emulator
# booted before the adb server. ANDROID_AVD falls back to the first AVD in
# `emulator -list-avds` when the default isn't present.
# apps/mobile/android/ is generated by prebuild and git-ignored — `make
# mobile` prebuilds it automatically when missing, or run
# `npx expo prebuild --platform android --no-install` in apps/mobile.

WSL ?= $(shell command -v wslpath >/dev/null 2>&1 && echo 1)
ifeq ($(WSL),1)
ADB ?= /mnt/c/Users/lauti/AppData/Local/Android/Sdk/platform-tools/adb.exe
EMU ?= /mnt/c/Users/lauti/AppData/Local/Android/Sdk/emulator/emulator.exe
# Convert repo paths for the Windows-hosted adb.exe.
APK_CONV = wslpath -w
else
ANDROID_HOME ?= $(HOME)/Android/Sdk
ADB ?= $(ANDROID_HOME)/platform-tools/adb
EMU ?= $(ANDROID_HOME)/emulator/emulator
APK_CONV = echo
# prebuild + gradlew need ANDROID_HOME in the environment, not just here.
export ANDROID_HOME
endif
ANDROID_AVD ?= Pixel_9
ANDROID_PKG ?= com.lifetracker.mobile
# Dev builds compile for the x86_64 emulator only (much faster than the
# all-ABI default in apps/mobile/android/gradle.properties — keep that
# default for release builds).
ANDROID_ABI ?= x86_64

# One-command mobile dev loop. Bootstraps everything in order and skips any
# piece already up:
#   1. boots an AVD if no device is attached (waiting for boot; falls back
#      to the first available AVD when ANDROID_AVD isn't found),
#   2. prebuilds apps/mobile/android/ if missing,
#   3. builds + installs the debug APK if the package isn't installed,
#   4. wires device :8081 -> Metro (reverse mappings die with the emulator),
#   5. starts the API (:8080) and Metro (:8081) DETACHED (nohup + pidfiles)
#      if not already up, then launches the app,
#   6. stays in a key loop: [R] rebuild+reinstall the native app (make
#      mobile-rebuild), Enter relaunches it, q exits. Ctrl-C also just exits
#      the loop; detached processes keep running.
# Everything runs in its own session, so `make` returns in seconds and
# Ctrl-C during startup can't wedge the terminal (learned the hard way:
# interactive background children + make's signal handling deadlock).
# - `make mobile-logs`  tail API + Metro logs
# - `make mobile-stop`  stop exactly what `make mobile` started (pidfiles;
#   an API running from `make dev` is NOT touched)
mobile:
	@avd=$(ANDROID_AVD); \
	if [ "$$($(ADB) get-state 2>/dev/null)" != "device" ]; then \
		if ! "$(EMU)" -list-avds 2>/dev/null | tr -d '\r' | grep -qx "$$avd"; then \
			avd=$$("$(EMU)" -list-avds 2>/dev/null | tr -d '\r' | grep -v '^$$' | head -n 1); \
			echo "==> AVD $(ANDROID_AVD) not found — using first available: $$avd"; \
		fi; \
		[ -n "$$avd" ] || { echo "✗ no AVDs found — create one (Android Studio Device Manager or avdmanager)"; exit 1; }; \
		echo "==> no device attached — starting AVD $$avd"; \
		nohup "$(EMU)" -avd "$$avd" >/dev/null 2>&1 & \
	fi; \
	echo "==> waiting for emulator boot"; \
	ok=0; kicked=0; for i in $$(seq 1 120); do \
		[ "$$(timeout 10 $(ADB) shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && ok=1 && break; \
		if [ $$kicked = 0 ] && [ $$i -ge 6 ]; then $(ADB) kill-server >/dev/null 2>&1; kicked=1; fi; \
		sleep 2; \
	done; \
	[ "$$ok" = 1 ] || { echo "✗ $$avd did not boot within ~4 min — check the AVD name in Android Studio Device Manager"; exit 1; }; \
	echo "✓ emulator booted"
	@if [ ! -d apps/mobile/android ]; then \
		echo "==> prebuild (android/ missing)"; \
		cd apps/mobile && npx expo prebuild --platform android --no-install; \
	fi
	@if ! $(ADB) shell pm list packages $(ANDROID_PKG) 2>/dev/null | grep -q "$(ANDROID_PKG)"; then \
		if [ ! -f apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk ]; then \
			echo "==> assembleDebug ($(ANDROID_ABI) only)"; \
			(cd apps/mobile/android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=$(ANDROID_ABI)); \
		fi; \
		echo "==> installing app-debug.apk"; \
		$(ADB) install -r "$$($(APK_CONV) $$(realpath apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk))"; \
	else \
		echo "✓ $(ANDROID_PKG) already installed"; \
	fi
	@$(ADB) reverse tcp:8081 tcp:8081 >/dev/null
	@echo "==> mobile dev mode (detached): API :8080 + Metro :8081 + $(ANDROID_PKG)"
	@if curl -sf --connect-timeout 1 -m 2 http://localhost:8080/health >/dev/null 2>&1; then \
		echo "✓ API already on :8080"; \
	else \
		$(MAKE) --no-print-directory db-up; \
		$(CHECK_AIR) \
		$(CHECK_ENV); \
		until docker exec golang_api_postgres pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done; \
		nohup setsid sh -c 'cd backend && exec air -c .air.toml' >/tmp/lifetracker-api.log 2>&1 & \
		echo $$! > /tmp/lifetracker-api.pid; \
		ok=0; for i in $$(seq 1 60); do curl -sf --connect-timeout 1 -m 2 http://localhost:8080/health >/dev/null 2>&1 && ok=1 && break; sleep 1; done; \
		[ "$$ok" = 1 ] || { echo "✗ API did not come up — tail /tmp/lifetracker-api.log"; exit 1; }; \
		echo "✓ API on :8080 (log: /tmp/lifetracker-api.log)"; \
	fi; \
	if curl -sf --connect-timeout 1 -m 2 http://localhost:8081/status >/dev/null 2>&1; then \
		echo "✓ Metro already on :8081"; \
	else \
		nohup setsid sh -c 'cd apps/mobile && exec npx expo start' >/tmp/lifetracker-metro.log 2>&1 & \
		echo $$! > /tmp/lifetracker-metro.pid; \
		ok=0; for i in $$(seq 1 90); do curl -sf --connect-timeout 1 -m 2 http://localhost:8081/status >/dev/null 2>&1 && ok=1 && break; sleep 1; done; \
		[ "$$ok" = 1 ] || { echo "✗ Metro did not start — tail /tmp/lifetracker-metro.log"; exit 1; }; \
		echo "✓ Metro on :8081 (log: /tmp/lifetracker-metro.log)"; \
	fi; \
	$(ADB) shell monkey -p $(ANDROID_PKG) 1 >/dev/null 2>&1; \
	echo "✓ $(ANDROID_PKG) launched — JS edits hot-reload via Fast Refresh"; \
	echo "  follow logs: make mobile-logs · stop: make mobile-stop"
# Interactive key loop: [R] rebuilds the NATIVE app (prebuild + assembleDebug +
# reinstall — needed after app.json / icon / splash / native-dep changes, which
# Fast Refresh can't apply), Enter relaunches, q exits. JS edits never need R.
# Skipped when stdin isn't a TTY (CI, piped make) so automation keeps the old
# return-immediately behavior. Ctrl-C here just exits the loop — the API and
# Metro run detached and are unaffected.
	@if [ -t 0 ]; then \
		echo ""; \
		echo "Keys: [R] rebuild+reinstall native app · Enter relaunch · q quit (JS edits hot-reload on their own)"; \
		while true; do \
			printf "mobile> "; \
			IFS= read -r -n 1 key || { echo; break; }; \
			case "$$key" in \
				"") echo ;; \
				r|R) echo " $$key"; $(MAKE) --no-print-directory mobile-rebuild || echo "✗ rebuild failed — see output above" ;; \
				q|Q) echo " $$key"; echo "✓ bye — API/Metro keep running (make mobile-stop to stop them)"; break ;; \
				*) echo " $$key"; $(ADB) shell monkey -p $(ANDROID_PKG) 1 >/dev/null 2>&1 && echo "✓ app relaunched" ;; \
			esac; \
		done; \
	fi

# Rebuild the native app and reinstall it on the emulator. What the [R] key in
# `make mobile` runs; also usable directly. The prebuild step is conditional:
# expo prebuild --clean regenerates android/ and forces a full native
# recompile (minutes), so it only runs when something native-affecting
# (app.json, package.json, assets/, plugin/) is newer than the generated
# android/ project. Otherwise Gradle does an incremental build (seconds).
mobile-rebuild:
	@if [ ! -f apps/mobile/android/app/build.gradle ] || \
		[ -n "$$(find apps/mobile/app.json apps/mobile/package.json apps/mobile/assets apps/mobile/plugin -newer apps/mobile/android/app/build.gradle -print -quit 2>/dev/null)" ]; then \
		echo "==> prebuild (native config changed since last prebuild)"; \
		cd apps/mobile && npx expo prebuild --platform android --clean --no-install; \
	else \
		echo "✓ android/ is newer than app.json/assets/plugin — skipping prebuild"; \
	fi
	@echo "==> assembleDebug ($(ANDROID_ABI) only)"
	(cd apps/mobile/android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=$(ANDROID_ABI))
	@echo "==> reinstalling app-debug.apk"
	$(ADB) install -r "$$($(APK_CONV) $$(realpath apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk))"
	$(ADB) reverse tcp:8081 tcp:8081
	$(ADB) shell monkey -p $(ANDROID_PKG) 1 >/dev/null 2>&1
	@echo "✓ reinstalled + relaunched"

# Tail the detached mobile processes' logs (Ctrl-C here is safe — it only
# ends the tail).
mobile-logs:
	@tail -n 30 -f /tmp/lifetracker-api.log /tmp/lifetracker-metro.log

# Stop exactly what `make mobile` started, via its pidfiles. Processes
# started elsewhere (make dev's air, a manual expo start) have no pidfile
# and are left alone; kill them by hand if you need the ports.
mobile-stop:
	@stopped=0; \
	for f in /tmp/lifetracker-metro.pid /tmp/lifetracker-api.pid; do \
		if [ -f "$$f" ]; then \
			pid=$$(cat "$$f"); \
			if kill -- -$$pid 2>/dev/null || kill $$pid 2>/dev/null; then \
				echo "✓ stopped $$(basename $$f .pid) (pid $$pid)"; stopped=1; \
			fi; \
			rm -f "$$f"; \
		fi; \
	done; \
	[ "$$stopped" = 1 ] || echo "nothing to stop (no pidfiles found)"
