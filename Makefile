# Root Makefile — the single entry point for the life-tracker repo.
#
# Deployment is plain docker compose at the repo root (docker-compose.yml +
# nginx/ + scripts/); `make` / `make help` shows the main commands only;
# `make components` lists the backend/frontend/databases/docker commands.
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

# Env file for docker commands: root .env when present, else .env.example (dev
# defaults). Absolute so it survives recipe shells; consumed via --env-file
# (variable substitution) and by scripts/migrate.sh.
ENV_FILE := $(if $(wildcard $(CURDIR)/.env),$(CURDIR)/.env,$(CURDIR)/.env.example)

# Compose wrapper (project name pinned in docker-compose.yml).
COMPOSE := docker compose -f docker-compose.yml

.PHONY: help components docs dev dev-container dev-full stop test test-only test-coverage \
	test-js test-shared test-frontend test-mobile loadtest loadtest-% \
	test-e2e test-e2e-ui \
	loadtest-stack-up loadtest-stack-down \
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
	@printf "    make test           backend tests — isolated test DB + race detector\n"
	@printf "    make test-only      backend tests — reuses a running test DB\n"
	@printf "    make test-e2e       backend essential E2E — production router + real auth\n"
	@printf "    make test-e2e-ui    browser E2E — headed chromium, needs container lane\n"
	@printf "    make test-coverage  backend tests + coverage profile (report-only)\n"
	@printf "    make test-js        all JS/TS suites: shared + frontend + mobile\n"
	@printf "    make loadtest       k6 full suite — also: loadtest-breakpoint / -soak / -tap\n"
	@printf "\n"
	@printf "$(GREEN)  DOCS$(RST)\n"
	@printf "    make docs           build + open the docs page (docs/index.html, self-contained)\n"
	@printf "\n"
	@printf "$(DIM)  ── component-level ──────────────────────────────────────────────$(RST)\n"
	@printf "\n"
	@printf "    Components: 🧠 backend · 🖥️  frontend · 🗄️  databases · 🐳 docker\n"
	@printf "    Run $(GREEN)%s$(RST) to see the full list\n" "make components"

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

dev: setup db-up
	@echo "==> fast lane: air (api :8080) + next dev (web :3000) + compose databases"
	$(CHECK_AIR)
	@echo "==> env file: $(notdir $(ENV_FILE))"
	@[ -f "$(ENV_FILE)" ] || (echo ".env/.env.example not found — run 'make setup'"; exit 1)
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
		echo "✓ .env created. Review and update configuration if needed."; \
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
	@until docker exec golang_api_postgres pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
	# config.Load() walks up from backend/ and picks up the root .env.
	cd backend && air -c .air.toml

# Essential E2E: production router + real JWT auth middleware against the
# compose test DBs. Guarded by the `e2e` build tag, so the regular suite
# (`make test`) stays fast. Does not truncate shared tables — uses unique
# users per run, so it coexists with unit/integration runs on the same DBs.
test-e2e: db-test-up
	cd backend && ENVIRONMENT=test gotestsum --format=short-verbose -- -race -tags=e2e ./tests/e2e/...; \
	TEST_EXIT=$$?; \
	$(MAKE) -C $(CURDIR) db-test-down; \
	exit $$TEST_EXIT

# Browser E2E (Playwright, chromium) against the container lane
# (`make dev-container` — nginx static export on :3000 proxying /api to the
# backend). Runs headed so the browser is visible. CI keeps the headless
# lane (`npm run test:e2e`); this target is local-dev only.
test-e2e-ui:
	@curl -sf http://localhost:3000 >/dev/null || \
		(echo "container lane not up on :3000 — run 'make dev-container' first"; exit 1)
	cd frontend && npx playwright test --headed

# --- Tests ---

test: db-test-up
	cd backend && ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 ./...; \
	TEST_EXIT=$$?; \
	$(MAKE) -C $(CURDIR) db-test-down; \
	exit $$TEST_EXIT

test-only:
	cd backend && ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 ./...

# Same suite as `test` plus a coverage profile (report-only; thresholds are
# ratcheted against this baseline later).
test-coverage: db-test-up
	cd backend && ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 -coverprofile=./coverage.out ./...; \
	TEST_EXIT=$$?; \
	$(MAKE) -C $(CURDIR) db-test-down; \
	go tool cover -func=./coverage.out | tail -1; \
	exit $$TEST_EXIT

# All JS/TS suites (shared + frontend + mobile). Each has its own config:
# shared/frontend run vitest, mobile runs jest-expo (workspace-local).
test-js: test-shared test-frontend test-mobile

test-shared:
	npm test -w @life-tracker/shared

test-frontend:
	cd frontend && npm test

# --- Load testing in CI ---

# Backend service + test DBs only (no observability, no Prometheus): the lane
# the nightly k6 suite runs against. Heavy scenarios stay out of PRs entirely.
loadtest-stack-up:
	$(MAKE) -C loadtest stack-up

loadtest-stack-down:
	$(MAKE) -C loadtest stack-down

test-mobile:
	npm run test -w apps/mobile

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

# --- Android (emulator on Windows, build in WSL) ---
#
# Dev loop for apps/mobile against the Android Studio AVD on the Windows
# host: WSL2 has no USB passthrough or accelerated emulation, so the
# emulator runs on Windows while Gradle, Metro (:8081) and the API (:8080)
# stay in WSL. The bridge is the Windows adb.exe driven from WSL via
# interop — no firewall changes needed:
#   - RN debug builds reach Metro through the emulator's host alias
#     10.0.2.2:8081 (react-native's AndroidInfoHelpers emulator default);
#   - the API is baked at bundle time as 10.0.2.2 (see
#     apps/mobile/.env.development).
#   - both aliases resolve to the Windows host loopback, which forwards
#     into WSL ONLY with mirrored networking (`networkingMode=mirrored`
#     in %USERPROFILE%\.wslconfig): NAT-mode forwarding is IPv6-only and
#     the emulator speaks IPv4. Also needed once after an emulator start:
#     `adb kill-server` if the emulator booted before the adb server.
# apps/mobile/android/ is generated by prebuild and git-ignored — `make
# mobile` prebuilds it automatically when missing, or run
# `npx expo prebuild --platform android --no-install` in apps/mobile.

WIN_ADB ?= /mnt/c/Users/lauti/AppData/Local/Android/Sdk/platform-tools/adb.exe
WIN_EMU ?= /mnt/c/Users/lauti/AppData/Local/Android/Sdk/emulator/emulator.exe
ANDROID_AVD ?= Pixel_9
ANDROID_PKG ?= com.lifetracker.mobile
# Dev builds compile for the x86_64 emulator only (much faster than the
# all-ABI default in apps/mobile/android/gradle.properties — keep that
# default for release builds).
ANDROID_ABI ?= x86_64

# One-command mobile dev loop. Bootstraps everything in order and skips any
# piece already up:
#   1. boots the Windows AVD if no device is attached (waiting for boot),
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
	@if [ "$$($(WIN_ADB) get-state 2>/dev/null)" != "device" ]; then \
		echo "==> no device attached — starting AVD $(ANDROID_AVD) on Windows"; \
		nohup "$(WIN_EMU)" -avd $(ANDROID_AVD) >/dev/null 2>&1 & \
	fi; \
	echo "==> waiting for emulator boot"; \
	ok=0; kicked=0; for i in $$(seq 1 120); do \
		[ "$$(timeout 10 $(WIN_ADB) shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && ok=1 && break; \
		if [ $$kicked = 0 ] && [ $$i -ge 6 ]; then $(WIN_ADB) kill-server >/dev/null 2>&1; kicked=1; fi; \
		sleep 2; \
	done; \
	[ "$$ok" = 1 ] || { echo "✗ $(ANDROID_AVD) did not boot within ~4 min — check the AVD name in Android Studio Device Manager"; exit 1; }; \
	echo "✓ emulator booted"
	@if [ ! -d apps/mobile/android ]; then \
		echo "==> prebuild (android/ missing)"; \
		cd apps/mobile && npx expo prebuild --platform android --no-install; \
	fi
	@if ! $(WIN_ADB) shell pm list packages $(ANDROID_PKG) 2>/dev/null | grep -q "$(ANDROID_PKG)"; then \
		if [ ! -f apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk ]; then \
			echo "==> assembleDebug ($(ANDROID_ABI) only)"; \
			cd apps/mobile/android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=$(ANDROID_ABI); \
		fi; \
		echo "==> installing app-debug.apk"; \
		$(WIN_ADB) install -r "$$(wslpath -w $$(realpath apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk))"; \
	else \
		echo "✓ $(ANDROID_PKG) already installed"; \
	fi
	@$(WIN_ADB) reverse tcp:8081 tcp:8081 >/dev/null
	@echo "==> mobile dev mode (detached): API :8080 + Metro :8081 + $(ANDROID_PKG)"
	@if curl -sf --connect-timeout 1 -m 2 http://localhost:8080/health >/dev/null 2>&1; then \
		echo "✓ API already on :8080"; \
	else \
		$(MAKE) --no-print-directory db-up; \
		$(CHECK_AIR) \
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
	$(WIN_ADB) shell monkey -p $(ANDROID_PKG) 1 >/dev/null 2>&1; \
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
				*) echo " $$key"; $(WIN_ADB) shell monkey -p $(ANDROID_PKG) 1 >/dev/null 2>&1 && echo "✓ app relaunched" ;; \
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
	cd apps/mobile/android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=$(ANDROID_ABI)
	@echo "==> reinstalling app-debug.apk"
	$(WIN_ADB) install -r "$$(wslpath -w $$(realpath apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk))"
	$(WIN_ADB) reverse tcp:8081 tcp:8081
	$(WIN_ADB) shell monkey -p $(ANDROID_PKG) 1 >/dev/null 2>&1
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
