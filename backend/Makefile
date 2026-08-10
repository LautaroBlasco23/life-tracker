.PHONY: help setup start install-tools code-check dev dev-app docker-up docker-down docker-build db-up db-down db-remove db-test-up db-test-down db-test-remove test test-only hooks monitoring-up monitoring-down floci-up floci-provision floci-status floci-down floci-deploy floci-dev migrate-floci test-floci

.DEFAULT_GOAL := help

# infra/Makefile owns every docker compose command; these are thin delegates.
INFRA := $(abspath $(CURDIR)/../infra)

help:
	@echo ""
	@echo "  🚀 Quick Start:"
	@echo "    setup              - Create .env from .env.example"
	@echo "    start              - Setup environment and start application (setup + dev)"
	@echo ""
	@echo "  🛠️  Development:"
	@echo "    install-tools      - Install Go tools (gofumpt, golangci-lint, air, gotestsum)"
	@echo "    code-check         - Format and lint code"
	@echo "    dev                - Start application with databases (legacy docker-compose.db.yml)"
	@echo "    test               - Run all tests with test database"
	@echo "    test-only          - Run tests without starting database"
	@echo ""
	@echo "  ☁️  AWS (floci) path (compose commands live in ../infra/Makefile):"
	@echo "    floci-up           - Start floci emulator (RDS/DocumentDB/Lambda via Docker socket)"
	@echo "    floci-provision    - Provision S3, RDS, DocumentDB, Secrets Manager (idempotent)"
	@echo "    floci-status       - Show floci health and provisioned resources"
	@echo "    floci-dev          - Start the API on the host against floci services (hot reload)"
	@echo "    floci-deploy       - Build and deploy the API as a Lambda behind API Gateway v2"
	@echo "    migrate-floci      - Run DB migrations against floci services"
	@echo "    test-floci         - Run the test suite against floci RDS + DocumentDB"
	@echo "    floci-down         - Stop floci emulator"
	@echo ""
	@echo "  Compose shortcuts (delegated to ../infra/Makefile):"
	@echo "    docker-up / docker-down / docker-build - full stack"
	@echo "    db-up / db-down / db-remove / db-test-* - legacy databases"
	@echo "    monitoring-up / monitoring-down - Prometheus + Grafana"

setup:
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo "✓ .env created. Review and update configuration if needed."; \
	else \
		echo "✓ .env already exists"; \
	fi

start: setup dev

install-tools:
	go install mvdan.cc/gofumpt@latest
	go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.7.2
	go install github.com/air-verse/air@latest
	go install gotest.tools/gotestsum@latest

code-check:
	gofumpt -l -w .
	golangci-lint run --fix ./...

dev: hooks db-up
	@until docker exec golang_api_postgres pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
	ENV_FILE=.env air -c .air.toml

dev-app: hooks
	ENV_FILE=.env air -c .air.toml

test: db-test-up
	@ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 ./...; \
	TEST_EXIT=$$?; \
	$(MAKE) db-test-down; \
	exit $$TEST_EXIT

test-only:
	ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 ./...

hooks:
	git config core.hooksPath .githooks
	chmod +x .githooks/*

# --- Compose shortcuts (delegated to infra/Makefile) ---

docker-up:
	$(MAKE) -C $(INFRA) up

docker-down:
	$(MAKE) -C $(INFRA) down

docker-build:
	$(MAKE) -C $(INFRA) build

db-up:
	$(MAKE) -C $(INFRA) db-up

db-down:
	$(MAKE) -C $(INFRA) db-down

db-remove:
	$(MAKE) -C $(INFRA) db-remove

db-test-up:
	$(MAKE) -C $(INFRA) db-test-up

db-test-down:
	$(MAKE) -C $(INFRA) db-test-down

db-test-remove:
	$(MAKE) -C $(INFRA) db-test-remove

monitoring-up:
	$(MAKE) -C $(INFRA) monitoring-up

monitoring-down:
	$(MAKE) -C $(INFRA) monitoring-down

# --- AWS (floci) path ---

floci-up:
	$(MAKE) -C $(INFRA) floci-up

floci-provision:
	$(MAKE) -C $(INFRA) floci-provision

floci-status:
	$(MAKE) -C $(INFRA) floci-status

floci-down:
	$(MAKE) -C $(INFRA) floci-down

floci-deploy:
	$(MAKE) -C $(INFRA) floci-deploy

floci-dev: floci-up floci-provision
	@set -a; . "$(INFRA)/.floci.env"; set +a; \
	air -c .air.toml

migrate-floci:
	@[ -f "$(INFRA)/.floci.env" ] || (echo ".floci.env not found — run 'make floci-provision' first"; exit 1)
	bash "$(INFRA)/scripts/migrate.sh"

test-floci:
	@[ -f "$(INFRA)/.floci.env" ] || (echo ".floci.env not found — run 'make floci-provision' first"; exit 1)
	@echo "Note: tests truncate tables in the provisioned DB."
	@set -a; . "$(INFRA)/.floci.env"; set +a; \
	ENVIRONMENT=test gotestsum --format=short-verbose -- -race -p 1 ./...
