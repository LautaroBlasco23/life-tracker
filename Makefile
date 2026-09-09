# Root Makefile — the single entry point for the life-tracker repo.
#
# Everything lives here now (infra/, backend/ and frontend/ Makefiles were
# merged into this file). `make` / `make help` shows the main commands only;
# `make components` lists the backend/frontend/databases/infra commands.
#
# The three run modes (see infra/docker-compose*.yml + infra/scripts/ for the
# details; floci = local AWS emulator):
#   make dev           - container mode: API as a plain container (:8080) +
#                        postgres + mongodb + frontend on :3000. No floci.
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

GREEN := \033[1;32m
DIM   := \033[2m
RST   := \033[0m

# Compose wrappers (executed inside infra/).
DC  := cd infra && docker compose -p infra -f docker-compose.yml
DB  := cd infra && docker compose -p infra -f docker-compose.db.yml
FE  := cd infra && docker compose -p infra -f docker-compose.frontend.yml
# Frontend with nginx proxying /api -> the api container (:8080) instead of the
# floci gateway — used by the container-mode lanes (dev / dev-full).
FEO := cd infra && docker compose -p infra -f docker-compose.frontend.yml -f docker-compose.frontend.override.yml

.PHONY: help components dev dev-emulator dev-full stop test test-only loadtest loadtest-% \
	backend-dev backend-start setup install-tools code-check hooks \
	floci-dev migrate-floci test-floci \
	fe-run-dev fe-build-dev fe-logs-dev fe-shell-dev fe-clean \
	fe-docker-up fe-docker-down fe-docker-restart \
	db-up db-down db-remove db-test-up db-test-down db-test-remove \
	floci-up floci-provision floci-status floci-down floci-deploy \
	frontend-up frontend-down frontend-build \
	monitoring-up monitoring-down dev-migrate up down build deploy-frontend

.DEFAULT_GOAL := help

help:
	@printf "$(GREEN)  Life Tracker$(RST)\n"
	@printf "  Run from the repo root.\n"
	@printf "\n"
	@printf "$(GREEN)  RUN$(RST) — one mode at a time; stop before switching\n"
	@printf "    make dev            container mode: API :8080 · postgres · mongo · web :3000\n"
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
	@printf "    make %-18s %s\n" "setup"            "create backend/.env from backend/.env.example"
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

# --- Run modes ---

# Container mode: api + databases + frontend, no floci, no observability.
dev:
	@echo "==> container mode: api + postgres + mongodb + frontend"
	@cd infra && [ -f ../backend/.env ] || (echo "../backend/.env not found — run 'make setup'"; exit 1)
	$(DC) --env-file ../backend/.env up -d --build
	@echo "==> migrations"
	@$(MAKE) --no-print-directory dev-migrate
	@echo "==> frontend (nginx /api -> api:8080)"
	$(FEO) --env-file ../backend/.env up -d web
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
	@cd infra && [ -f ../backend/.env ] || (echo "../backend/.env not found — run 'make setup'"; exit 1)
	$(DC) --env-file ../backend/.env --profile observability up -d --build
	@echo "==> migrations"
	@$(MAKE) --no-print-directory dev-migrate
	@echo "==> frontend (nginx /api -> api:8080)"
	$(FEO) --env-file ../backend/.env up -d web
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
# path (migrate.sh defaults), but against the compose network and backend/.env.
dev-migrate:
	cd infra && ENV_FILE=$(abspath backend)/.env NETWORK=infra_golang_api_network bash scripts/migrate.sh

# --- Full stack (legacy) ---

# Every profile: container API + floci + observability.
up:
	@cd infra && [ -f ../backend/.env ] || (echo "../backend/.env not found — run 'make setup'"; exit 1)
	$(DC) --env-file ../backend/.env --profile emulator --profile observability up -d

down:
	$(DC) down

build:
	@cd infra && [ -f ../backend/.env ] || (echo "../backend/.env not found — run 'make setup'"; exit 1)
	$(DC) --env-file ../backend/.env build api

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
	@if [ ! -f backend/.env ]; then \
		echo "Creating backend/.env from backend/.env.example..."; \
		cp backend/.env.example backend/.env; \
		echo "✓ backend/.env created. Review and update configuration if needed."; \
	else \
		echo "✓ backend/.env already exists"; \
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
	cd backend && ENV_FILE=.env air -c .air.toml

floci-dev: floci-up floci-provision
	@set -a; . "$(INFRA)/.floci.env"; set +a; \
	cd backend && air -c .air.toml

migrate-floci:
	@[ -f "$(INFRA)/.floci.env" ] || (echo ".floci.env not found — run 'make floci-provision' first"; exit 1)
	cd infra && bash scripts/migrate.sh

test-floci:
	@[ -f "$(INFRA)/.floci.env" ] || (echo ".floci.env not found — run 'make floci-provision' first"; exit 1)
	@echo "Note: tests truncate tables in the provisioned DB."
	@set -a; . "$(INFRA)/.floci.env"; set +a; \
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
	@cd infra && [ -f ../backend/.env ] || (echo "../backend/.env not found — run 'make setup'"; exit 1)
	$(DB) --env-file ../backend/.env up -d

db-down:
	$(DB) --env-file ../backend/.env stop

db-remove:
	$(DB) --env-file ../backend/.env down -v

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
