# Root Makefile — the single entry point for the life-tracker repo.
#
# Everything lives here now (infra/, backend/ and frontend/ Makefiles were
# merged into this file). `make` / `make help` shows the main commands only;
# `make components` lists the backend/frontend/databases/infra commands.
#
# The run modes (see infra/docker-compose*.yml + infra/scripts/ for the
# details; floci = local AWS emulator). One mode at a time; stop before
# switching (ports and compose project names overlap):
#   make dev           - fast lane: air hot-reload on the host (:8080) +
#                        compose postgres + mongodb + `next dev` (:3000).
#                        No app containers; fastest feedback loop.
#   make dev-container - container mode: API as a plain container (:8080) +
#                        postgres + mongodb + frontend on :3000. No floci.
#                        Prod-built image + static export; parity check.
#   make dev-emulator  - AWS-emulated mode: floci + the API deployed as a
#                        Lambda behind API Gateway v2 + frontend on :3000.
#                        This is the pre-deploy test of the real AWS path.
#   make dev-full      - container mode + observability (Prometheus, Grafana,
#                        Loki, Promtail, node-exporter).
#
# Why the API is deployed as a Lambda rather than run on the host in emulator
# mode: the floci-provisioned RDS/DocumentDB containers live on the emulator's
# docker network and are unreachable from the host (see infra/scripts/migrate.sh),
# so anything that talks to them must run inside that network. The repo's
# mechanism for that is `floci-deploy` (Lambda behind API Gateway v2), which is
# also what the frontend's nginx proxy targets (/api -> gateway). Re-running
# `make dev-emulator` redeploys the Lambda, so it doubles as the "restart the
# API" command in that mode.
#
# Recipe convention: compose and scripts run inside `cd infra` (their relative
# paths assume it); backend tooling runs inside `cd backend`. `-p infra` pins
# the compose project name so container/network names can't drift.

INFRA := $(abspath infra)

# Host-run Go tooling (air, gotestsum, ...) is installed via `make
# install-tools` into GOPATH/bin, which is often not on PATH — expose it to
# every recipe shell so `air` etc. resolve without shell config changes.
GOPATH_BIN := $(shell go env GOPATH 2>/dev/null)/bin
export PATH := $(GOPATH_BIN):$(PATH)

GREEN := \033[1;32m
DIM   := \033[2m
RST   := \033[0m

# Env file for infra commands: root .env when present, else .env.example (dev
# defaults). Absolute so it survives the `cd infra` compose wrappers; consumed
# via --env-file (variable substitution) and by scripts/migrate.sh.
ENV_FILE := $(if $(wildcard $(CURDIR)/.env),$(CURDIR)/.env,$(CURDIR)/.env.example)

# Compose wrappers (executed inside infra/).
DC  := cd infra && docker compose -p infra -f docker-compose.yml
DB  := cd infra && docker compose -p infra -f docker-compose.db.yml
FE  := cd infra && docker compose -p infra -f docker-compose.frontend.yml
# Frontend with nginx proxying /api -> the api container (:8080) instead of the
# floci gateway — used by the container-mode lanes (dev / dev-full).
FEO := cd infra && docker compose -p infra -f docker-compose.frontend.yml -f docker-compose.frontend.override.yml

.PHONY: help components dev dev-container dev-emulator dev-full stop test test-only loadtest loadtest-% \
	backend-dev backend-start setup install-tools code-check hooks \
	floci-dev migrate-floci test-floci \
	fe-run-dev fe-build-dev fe-logs-dev fe-shell-dev fe-clean \
	fe-docker-up fe-docker-down fe-docker-restart \
	db-up db-down db-remove db-test-up db-test-down db-test-remove \
	floci-up floci-provision floci-status floci-down floci-deploy \
	frontend-up frontend-down frontend-build \
	mobile mobile-logs mobile-stop \
	monitoring-up monitoring-down dev-migrate up down build deploy-frontend

.DEFAULT_GOAL := help

help:
	@printf "$(GREEN)  Life Tracker$(RST)\n"
	@printf "  Run from the repo root.\n"
	@printf "\n"
	@printf "$(GREEN)  RUN$(RST) — one mode at a time; stop before switching\n"
	@printf "    make dev            fast lane: air (api :8080) · next dev (web :3000) · compose db\n"
	@printf "    make dev-container  container mode: API :8080 · postgres · mongo · web :3000\n"
	@printf "    make dev-emulator   AWS path: floci + Lambda + API Gateway · web :3000\n"
	@printf "    make dev-full       container mode + observability: Prometheus :9090 · Grafana :3001\n"
	@printf "\n"
	@printf "$(GREEN)  STOP$(RST)\n"
	@printf "    make stop           stops EVERYTHING, whichever mode is running\n"
	@printf "\n"
	@printf "$(GREEN)  TEST$(RST)\n"
	@printf "    make test           backend tests — isolated test DB + race detector\n"
	@printf "    make test-only      backend tests — reuses a running test DB\n"
	@printf "    make loadtest       k6 full suite — also: loadtest-breakpoint / -soak / -tap\n"
	@printf "\n"
	@printf "$(DIM)  ── component-level ──────────────────────────────────────────────$(RST)\n"
	@printf "\n"
	@printf "    Components: 🧠 backend · 🖥️  frontend · 🗄️  databases · 🐳 infra\n"
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
	@printf "    make %-18s %s\n" "floci-dev"        "run the API on the host against floci services (air)"
	@printf "    make %-18s %s\n" "migrate-floci"    "run DB migrations against floci services"
	@printf "    make %-18s %s\n" "test-floci"       "test suite against floci RDS + DocumentDB"
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
	@printf "$(GREEN)  🗄️  Databases (legacy compose file; the run modes manage their own)$(RST)\n"
	@printf "    make %-18s %s\n" "db-up"            "start dev databases"
	@printf "    make %-18s %s\n" "db-down"          "stop dev databases"
	@printf "    make %-18s %s\n" "db-remove"        "remove dev databases and volumes"
	@printf "    make %-18s %s\n" "db-test-up"       "start test databases"
	@printf "    make %-18s %s\n" "db-test-down"     "stop test databases"
	@printf "    make %-18s %s\n" "db-test-remove"   "remove test databases and volumes"
	@printf "\n"
	@printf "$(GREEN)  🐳 Infra$(RST)\n"
	@printf "    make %-18s %s\n" "floci-up"         "start floci emulator (:4566)"
	@printf "    make %-18s %s\n" "floci-provision"  "provision S3, RDS, DocumentDB, Secrets (idempotent)"
	@printf "    make %-18s %s\n" "floci-status"     "floci health + provisioned resources"
	@printf "    make %-18s %s\n" "floci-down"       "stop floci"
	@printf "    make %-18s %s\n" "floci-deploy"     "build + deploy the API as a Lambda (API GW v2)"
	@printf "    make %-18s %s\n" "frontend-up"      "serve static export at :3000 (nginx; = CloudFront stand-in)"
	@printf "    make %-18s %s\n" "frontend-down"    "stop the frontend container"
	@printf "    make %-18s %s\n" "frontend-build"   "build the frontend image"
	@printf "    make %-18s %s\n" "deploy-frontend"  "build static export, sync to S3, serve at :3000"
	@printf "    make %-18s %s\n" "monitoring-up"    "Prometheus, Grafana, Loki, Promtail, node-exporter"
	@printf "    make %-18s %s\n" "monitoring-down"  "stop the monitoring stack"
	@printf "    make %-18s %s\n" "up / down / build" "legacy full stack (every profile)"
	@printf "\n"
	@printf "$(GREEN)  📱 Mobile (emulator on Windows, build in WSL)$(RST)\n"
	@printf "    make %-18s %s\n" "mobile" "one command dev loop: emulator + build + API + Metro + launch"
	@printf "    make %-18s %s\n" "mobile-logs"      "tail API + Metro logs"
	@printf "    make %-18s %s\n" "mobile-stop"      "stop what make mobile started (pidfiles)"

# --- Run modes ---

# Fast lane: backend hot-reloads with air on the host (config.Load() walks up
# from backend/ and picks up the root .env, which points at localhost hosts);
# frontend hot-reloads with `next dev` hitting the API directly on :8080 (the
# backend's CORS middleware allows it in dev). Databases run in compose via
# db-up; the API runs its embedded migrations on every (re)start, so no
# explicit migrate step is needed. Ctrl-C stops air + the frontend; the
# databases stay up (make stop / make db-down to stop them).
dev: setup db-up
	@echo "==> fast lane: air (api :8080) + next dev (web :3000) + compose databases"
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

# Container mode: api + databases + frontend, no floci, no observability.
dev-container:
	@echo "==> container mode: api + postgres + mongodb + frontend"
	@echo "==> env file: $(notdir $(ENV_FILE))"
	@[ -f "$(ENV_FILE)" ] || (echo ".env/.env.example not found — run 'make setup'"; exit 1)
	$(DC) --env-file $(ENV_FILE) up -d --build
	@echo "==> migrations"
	@$(MAKE) --no-print-directory dev-migrate
	@echo "==> frontend (nginx /api -> api:8080)"
	$(FEO) --env-file $(ENV_FILE) up -d web
	cd infra && DEPLOY_S3=0 bash scripts/deploy-frontend.sh
	@echo ""
	@echo "Container mode ready:"
	@echo "  API:      http://localhost:8080/api"
	@echo "  Frontend: http://localhost:3000  (proxies /api to :8080)"

# AWS-emulated mode: floci + API as Lambda behind API Gateway v2.
dev-emulator:
	@echo "==> AWS-emulated mode: floci + Lambda + frontend"
	@echo "==> floci emulator"
	@$(MAKE) --no-print-directory floci-up
	@echo "==> provisioning floci services (idempotent)"
	@$(MAKE) --no-print-directory floci-provision
	@echo "==> backend API (migrate + Lambda deploy, idempotent)"
	@$(MAKE) --no-print-directory floci-deploy
	@echo "==> frontend (build + deploy current source to web container + S3)"
	@$(MAKE) --no-print-directory deploy-frontend
	@echo ""
	@echo "AWS-emulated mode ready:"
	@echo "  API:      http://localhost:3000/api  (same-origin via nginx proxy)"
	@echo "  Gateway:  http://localhost:4566/execute-api/lifetracker-api/dev/health"
	@echo "  Frontend: http://localhost:3000"

# Container mode + observability (Prometheus, Grafana, Loki, Promtail,
# node-exporter). Prometheus scrapes api:8080; Grafana on :3001.
dev-full:
	@echo "==> container mode + observability"
	@echo "==> env file: $(notdir $(ENV_FILE))"
	@[ -f "$(ENV_FILE)" ] || (echo ".env/.env.example not found — run 'make setup'"; exit 1)
	$(DC) --env-file $(ENV_FILE) --profile observability up -d --build
	@echo "==> migrations"
	@$(MAKE) --no-print-directory dev-migrate
	@echo "==> frontend (nginx /api -> api:8080)"
	$(FEO) --env-file $(ENV_FILE) up -d web
	cd infra && DEPLOY_S3=0 bash scripts/deploy-frontend.sh
	@echo ""
	@echo "Container mode + observability ready:"
	@echo "  API:         http://localhost:8080/api"
	@echo "  Frontend:    http://localhost:3000  (proxies /api to :8080)"
	@echo "  Prometheus:  http://localhost:9090  (targets: api:8080, node-exporter)"
	@echo "  Grafana:     http://localhost:3001  (admin/admin by default)"
	@echo "  Loki:        http://localhost:3100"

# Stops whichever mode is up: compose down ignores profiles and removes every
# running service of the project, including the frontend container.
stop:
	$(DC) --profile emulator --profile observability down
	$(FE) down

# Migrations for the container-mode lanes: same in-network pattern as the floci
# path (migrate.sh defaults), but against the compose network and the root .env.
dev-migrate:
	cd infra && CONTAINER_MODE=1 ENV_FILE='$(ENV_FILE)' NETWORK=infra_golang_api_network bash scripts/migrate.sh

# --- Full stack (legacy) ---

# Every profile: container API + floci + observability.
up:
	@[ -f "$(ENV_FILE)" ] || (echo ".env/.env.example not found — run 'make setup'"; exit 1)
	$(DC) --env-file $(ENV_FILE) --profile emulator --profile observability up -d

down:
	$(DC) down

build:
	@[ -f "$(ENV_FILE)" ] || (echo ".env/.env.example not found — run 'make setup'"; exit 1)
	$(DC) --env-file $(ENV_FILE) build api

# --- AWS (floci) path ---

floci-up:
	$(DC) --profile emulator up -d floci
	@echo "Waiting for floci health..."
	@until docker exec floci curl -sf http://localhost:4566/_localstack/health >/dev/null 2>&1; do sleep 2; done
	@echo "✓ floci is ready at http://localhost:4566"

floci-provision:
	cd infra && bash scripts/provision.sh

floci-status:
	@docker exec floci curl -s http://localhost:4566/_localstack/health | python3 -m json.tool 2>/dev/null | head -15
	@echo "--- S3 buckets ---"
	@docker exec floci aws --endpoint-url http://localhost:4566 s3 ls 2>/dev/null
	@echo "--- RDS instances ---"
	@docker exec floci aws --endpoint-url http://localhost:4566 rds describe-db-instances --query 'DBInstances[].[DBInstanceIdentifier,Endpoint.Address,Endpoint.Port,DBInstanceStatus]' --output table 2>/dev/null
	@echo "--- DocumentDB clusters ---"
	@docker exec floci aws --endpoint-url http://localhost:4566 docdb describe-db-clusters --query 'DBClusters[].[DBClusterIdentifier,Endpoint,Port]' --output table 2>/dev/null
	@echo "--- Secrets ---"
	@docker exec floci aws --endpoint-url http://localhost:4566 secretsmanager list-secrets --query 'SecretList[].Name' --output text 2>/dev/null

floci-down:
	$(DC) stop floci

floci-deploy:
	cd infra && bash scripts/deploy-lambda.sh

deploy-frontend: frontend-up
	cd infra && bash scripts/deploy-frontend.sh

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
	@until docker exec golang_api_postgres pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
	# config.Load() walks up from backend/ and picks up the root .env.
	cd backend && air -c .air.toml

floci-dev: floci-up floci-provision
	@set -a; . "$(INFRA)/.floci.env"; set +a; \
	cd backend && air -c .air.toml

migrate-floci:
	@[ -f "$(INFRA)/.floci.env" ] || (echo ".floci.env not found — run 'make floci-provision' first"; exit 1)
	cd infra && bash scripts/migrate.sh

test-floci:
	@[ -f "$(INFRA)/.floci.env" ] || (echo ".floci.env not found — run 'make floci-provision' first"; exit 1)
	@echo "Note: tests truncate tables in the provisioned test DB (provision.sh creates it)."
	@set -a; . "$(INFRA)/.floci.env"; set +a; \
	export DB_NAME="$${DB_NAME}_test" MONGO_DATABASE="$${MONGO_DATABASE}_test"; \
	cd backend && ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 ./...

# --- Tests ---

test: db-test-up
	cd backend && ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 ./...; \
	TEST_EXIT=$$?; \
	$(MAKE) -C $(CURDIR) db-test-down; \
	exit $$TEST_EXIT

test-only:
	cd backend && ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 ./...

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

# --- Legacy databases (docker-compose.db.yml, rollback path) ---

db-up:
	@[ -f "$(ENV_FILE)" ] || (echo ".env/.env.example not found — run 'make setup'"; exit 1)
	$(DB) --env-file $(ENV_FILE) up -d

db-down:
	$(DB) --env-file $(ENV_FILE) stop

db-remove:
	$(DB) --env-file $(ENV_FILE) down -v

db-test-up:
	@cd infra && [ -f ../backend/.env.test ] || (echo "../backend/.env.test not found"; exit 1)
	$(DB) --env-file ../backend/.env.test up -d

db-test-down:
	@cd infra && [ -f ../backend/.env.test ] || (echo "../backend/.env.test not found"; exit 1)
	$(DB) --env-file ../backend/.env.test stop

db-test-remove:
	@cd infra && [ -f ../backend/.env.test ] || (echo "../backend/.env.test not found"; exit 1)
	$(DB) --env-file ../backend/.env.test down -v

# --- Monitoring ---

monitoring-up:
	$(DC) --profile observability up -d node-exporter prometheus grafana loki promtail

monitoring-down:
	$(DC) stop node-exporter prometheus grafana loki promtail

# --- Frontend container (nginx; part of the compose stack) ---

frontend-up:
	$(FE) up -d web
	@echo "App running at http://localhost:3000"

frontend-down:
	$(FE) stop web

frontend-build:
	$(FE) build

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
#      if not already up, then launches the app and exits.
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
		$(WIN_ADB) install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk; \
	else \
		echo "✓ $(ANDROID_PKG) already installed"; \
	fi
	@$(WIN_ADB) reverse tcp:8081 tcp:8081 >/dev/null
	@echo "==> mobile dev mode (detached): API :8080 + Metro :8081 + $(ANDROID_PKG)"
	@if curl -sf --connect-timeout 1 -m 2 http://localhost:8080/health >/dev/null 2>&1; then \
		echo "✓ API already on :8080"; \
	else \
		$(MAKE) --no-print-directory db-up; \
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
