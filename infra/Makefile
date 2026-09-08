# infra/Makefile — all docker compose commands for the life-tracker stack.
#
# Run from this directory, or from anywhere via `make -C infra <target>`.
# The backend/frontend Makefiles delegate their compose targets here.

BACKEND_DIR := $(abspath $(CURDIR)/../backend)
FRONTEND_DIR := $(abspath $(CURDIR)/../frontend)

COMPOSE := docker compose
DC := $(COMPOSE) -f docker-compose.yml
DB := $(COMPOSE) -f docker-compose.db.yml
FE := $(COMPOSE) -f docker-compose.frontend.yml
# Frontend with nginx proxying /api -> the api container (:8080) instead of the
# floci gateway — used by the container-mode lanes (dev / dev-full).
FEO := $(COMPOSE) -f docker-compose.frontend.yml -f docker-compose.frontend.override.yml

.PHONY: help up down build \
	dev-up dev-emulator-up dev-full-up dev-down dev-migrate \
	db-up db-down db-remove db-test-up db-test-down db-test-remove \
	floci-up floci-provision floci-status floci-down floci-deploy \
	monitoring-up monitoring-down \
	frontend-up frontend-down frontend-restart frontend-logs frontend-build \
	deploy-frontend

.DEFAULT_GOAL := help

help:
	@echo ""
	@echo "  infra — docker compose commands for life-tracker"
	@echo ""
	@echo "  Run modes (one at a time; dev-down stops any of them):"
	@echo "    dev-up            - Container mode: api + postgres + mongodb +"
	@echo "                        frontend (nginx /api -> api:8080). No floci."
	@echo "    dev-emulator-up   - AWS-emulated mode: floci + API as Lambda behind"
	@echo "                        API Gateway v2 + frontend (nginx /api -> gateway)."
	@echo "    dev-full-up       - Container mode + observability (Prometheus,"
	@echo "                        Grafana, Loki, Promtail, node-exporter)."
	@echo "    dev-down          - Stop whichever mode is running."
	@echo ""
	@echo "  Full stack (floci + api + postgres + mongodb + monitoring):"
	@echo "    up                - Start all services (every profile)"
	@echo "    down              - Stop all services"
	@echo "    build             - Build the API image"
	@echo ""
	@echo "  ☁️  AWS (floci) path:"
	@echo "    floci-up          - Start floci emulator (RDS/DocumentDB/Lambda via Docker socket)"
	@echo "    floci-provision   - Provision S3, RDS, DocumentDB, Secrets Manager (idempotent)"
	@echo "    floci-status      - Show floci health and provisioned resources"
	@echo "    floci-deploy      - Build and deploy the API as a Lambda behind API Gateway v2"
	@echo "    floci-down        - Stop floci emulator"
	@echo "    deploy-frontend   - Build static export, sync to S3, serve at http://localhost:3000"
	@echo ""
	@echo "  🗄️  Legacy databases (docker-compose.db.yml, rollback path):"
	@echo "    db-up             - Start dev databases"
	@echo "    db-down           - Stop dev databases"
	@echo "    db-remove         - Remove dev databases and volumes"
	@echo "    db-test-up        - Start test databases"
	@echo "    db-test-down      - Stop test databases"
	@echo "    db-test-remove    - Remove test databases and volumes"
	@echo ""
	@echo "  📊 Monitoring:"
	@echo "    monitoring-up     - Start Prometheus, Grafana, Loki, Promtail, node-exporter"
	@echo "    monitoring-down   - Stop monitoring services"
	@echo ""
	@echo "  🖥️  Frontend (docker-compose.frontend.yml):"
	@echo "    frontend-up       - Serve the static export at http://localhost:3000"
	@echo "    frontend-down     - Stop the frontend container"
	@echo "    frontend-restart  - Restart the frontend container"
	@echo "    frontend-logs     - Follow frontend logs"
	@echo "    frontend-build    - Build the frontend image"

# --- Run modes ---

# Container mode: api + databases + frontend, no floci, no observability.
dev-up:
	@[ -f ../backend/.env ] || (echo "../backend/.env not found — run 'make -C ../backend setup'"; exit 1)
	@echo "==> api + postgres + mongodb (container mode)"
	$(DC) --env-file ../backend/.env up -d --build
	@echo "==> migrations"
	@$(MAKE) --no-print-directory dev-migrate
	@echo "==> frontend (nginx /api -> api:8080)"
	$(FEO) --env-file ../backend/.env up -d web
	DEPLOY_S3=0 bash scripts/deploy-frontend.sh
	@echo ""
	@echo "Container mode ready:"
	@echo "  API:      http://localhost:8080/api"
	@echo "  Frontend: http://localhost:3000  (proxies /api to :8080)"

# AWS-emulated mode: floci + API as Lambda behind API Gateway v2.
dev-emulator-up:
	@echo "==> floci emulator"
	$(MAKE) --no-print-directory floci-up
	@echo "==> provisioning floci services (idempotent)"
	$(MAKE) --no-print-directory floci-provision
	@echo "==> backend API (migrate + Lambda deploy, idempotent)"
	$(MAKE) --no-print-directory floci-deploy
	@echo "==> frontend (build + deploy current source to web container + S3)"
	$(MAKE) --no-print-directory deploy-frontend
	@echo ""
	@echo "AWS-emulated mode ready:"
	@echo "  API:      http://localhost:3000/api  (same-origin via nginx proxy)"
	@echo "  Gateway:  http://localhost:4566/execute-api/lifetracker-api/dev/health"
	@echo "  Frontend: http://localhost:3000"

# Container mode + observability (Prometheus, Grafana, Loki, Promtail,
# node-exporter). Prometheus scrapes api:8080; Grafana on :3001.
dev-full-up:
	@[ -f ../backend/.env ] || (echo "../backend/.env not found — run 'make -C ../backend setup'"; exit 1)
	@echo "==> api + postgres + mongodb + observability (container mode)"
	$(DC) --env-file ../backend/.env --profile observability up -d --build
	@echo "==> migrations"
	@$(MAKE) --no-print-directory dev-migrate
	@echo "==> frontend (nginx /api -> api:8080)"
	$(FEO) --env-file ../backend/.env up -d web
	DEPLOY_S3=0 bash scripts/deploy-frontend.sh
	@echo ""
	@echo "Container mode + observability ready:"
	@echo "  API:         http://localhost:8080/api"
	@echo "  Frontend:    http://localhost:3000  (proxies /api to :8080)"
	@echo "  Prometheus:  http://localhost:9090  (targets: api:8080, node-exporter)"
	@echo "  Grafana:     http://localhost:3001  (admin/admin by default)"
	@echo "  Loki:        http://localhost:3100"

# Stops whichever mode is up: compose down ignores profiles and removes every
# running service of the project, including the frontend container.
dev-down:
	$(DC) --profile emulator --profile observability down
	$(FE) down

# Migrations for the container-mode lanes: same in-network pattern as the floci
# path (migrate.sh defaults), but against the compose network and backend/.env.
dev-migrate:
	ENV_FILE=$(abspath ../backend/.env) NETWORK=infra_golang_api_network bash scripts/migrate.sh

# --- Full stack ---

# Every profile: container API + floci + observability (legacy target).
up:
	@[ -f ../backend/.env ] || (echo "../backend/.env not found — run 'make -C ../backend setup'"; exit 1)
	$(DC) --env-file ../backend/.env --profile emulator --profile observability up -d

down:
	$(DC) down

build:
	@[ -f ../backend/.env ] || (echo "../backend/.env not found — run 'make -C ../backend setup'"; exit 1)
	$(DC) --env-file ../backend/.env build api

# --- AWS (floci) path ---

floci-up:
	$(DC) --profile emulator up -d floci
	@echo "Waiting for floci health..."
	@until docker exec floci curl -sf http://localhost:4566/_localstack/health >/dev/null 2>&1; do sleep 2; done
	@echo "✓ floci is ready at http://localhost:4566"

floci-provision:
	bash scripts/provision.sh

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
	bash scripts/deploy-lambda.sh

deploy-frontend: frontend-up
	bash scripts/deploy-frontend.sh

# --- Legacy databases ---

db-up:
	@[ -f ../backend/.env ] || (echo "../backend/.env not found — run 'make -C ../backend setup'"; exit 1)
	$(DB) --env-file ../backend/.env up -d

db-down:
	$(DB) --env-file ../backend/.env stop

db-remove:
	$(DB) --env-file ../backend/.env down -v

db-test-up:
	@[ -f ../backend/.env.test ] || (echo "../backend/.env.test not found"; exit 1)
	$(DB) --env-file ../backend/.env.test up -d

db-test-down:
	@[ -f ../backend/.env.test ] || (echo "../backend/.env.test not found"; exit 1)
	$(DB) --env-file ../backend/.env.test stop

db-test-remove:
	@[ -f ../backend/.env.test ] || (echo "../backend/.env.test not found"; exit 1)
	$(DB) --env-file ../backend/.env.test down -v

# --- Monitoring ---

monitoring-up:
	$(DC) --profile observability up -d node-exporter prometheus grafana loki promtail

monitoring-down:
	$(DC) stop node-exporter prometheus grafana loki promtail

# --- Frontend container ---

frontend-up:
	$(FE) up -d web
	@echo "App running at http://localhost:3000"

frontend-down:
	$(FE) stop web

frontend-restart: frontend-down frontend-up

frontend-logs:
	$(FE) logs -f

frontend-build:
	$(FE) build
