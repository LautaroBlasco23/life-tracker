# Root Makefile — orchestrate the life-tracker dev stack (floci path).
#
# Run from the repository root. Delegates to the infra Makefile.
#
# Why the API is deployed as a Lambda rather than run on the host:
# the floci-provisioned RDS/DocumentDB containers live on the emulator's docker
# network and are unreachable from the host (see infra/scripts/migrate.sh), so
# anything that talks to them must run inside that network. The repo's mechanism
# for that is `floci-deploy` (Lambda behind API Gateway v2), which is also what
# the frontend's nginx proxy targets (/api -> gateway). Re-running `make start`
# redeploys the Lambda, so it doubles as the "restart the API" command.

INFRA := $(abspath infra)

.PHONY: help start stop restart status logs loadtest loadtest-%

.DEFAULT_GOAL := help

help:
	@echo "Life Tracker — dev stack orchestration (floci path)"
	@echo ""
	@echo "  make start     - Start the full stack: floci + provisioned DBs +"
	@echo "                   backend API (Lambda + API Gateway) + frontend on :3000."
	@echo "                   Idempotent: re-running redeploys BOTH the backend"
	@echo "                   Lambda and the frontend build, so it also restarts"
	@echo "                   the app with the latest code."
	@echo "  make stop      - Stop floci and the frontend container."
	@echo "  make restart   - stop + start"
	@echo "  make status    - Show what is running and health-check the API"
	@echo "  make logs      - Follow floci (emulator) logs"
	@echo ""
	@echo "  Load testing (k6, see loadtest/):"
	@echo "    make loadtest                  - run the FULL load test: stack up,"
	@echo "                                     provision users, smoke, scenarios, cleanup"
	@echo "    make loadtest-breakpoint       - ramp until the app collapses"
	@echo "    make loadtest-soak             - long sustained run"
	@echo "    make loadtest-tap              - live API response watcher"
	@echo ""
	@echo "  Per-component (see infra/Makefile and backend/Makefile):"
	@echo "    make -C infra floci-up / floci-provision / floci-deploy / frontend-up / deploy-frontend"
	@echo "    make -C backend floci-status / floci-down / test-floci / migrate-floci"

# Delegate every `make loadtest-<target>` to loadtest/Makefile, forwarding
# command-line variables (USERS=500, RATE=600, BASE_URL=..., ...).
# Plain `make loadtest` runs the full suite (see loadtest/Makefile `run`).
loadtest:
	$(MAKE) -C loadtest run

loadtest-%:
	$(MAKE) -C loadtest $*

start:
	@echo "==> floci emulator"
	$(MAKE) -C $(INFRA) floci-up
	@echo "==> provisioning floci services (idempotent)"
	$(MAKE) -C $(INFRA) floci-provision
	@echo "==> backend API (migrate + Lambda deploy, idempotent)"
	$(MAKE) -C $(INFRA) floci-deploy
	@echo "==> frontend (build + deploy current source to web container + S3)"
	$(MAKE) -C $(INFRA) deploy-frontend
	@echo ""
	@echo "Stack ready:"
	@echo "  API:       http://localhost:3000/api  (same-origin via nginx proxy)"
	@echo "  Gateway:   http://localhost:4566/execute-api/lifetracker-api/dev/health"
	@echo "  Frontend:  http://localhost:3000"

stop:
	$(MAKE) -C $(INFRA) floci-down
	$(MAKE) -C $(INFRA) frontend-down

restart: stop start

status:
	@echo "==> floci"
	@docker ps --filter name=^/floci$$ --format '  floci: {{.Status}}' || true
	@echo "==> backend API (Lambda + API Gateway)"
	@docker exec floci aws --endpoint-url http://localhost:4566 --region us-east-1 lambda get-function \
		--function-name lifetracker-api --query 'Configuration.{State:State,LastModified:LastModified}' \
		--output text 2>/dev/null | sed 's/^/  Lambda: /' || echo "  Lambda: not deployed"
	@curl -s --max-time 8 -o /dev/null -w '  Gateway health:  %{http_code}\n' \
		http://localhost:4566/execute-api/lifetracker-api/dev/health || echo "  Gateway health: unreachable"
	@curl -s --max-time 8 -o /dev/null -w '  Proxy /api:       %{http_code} (400 = reachable, no creds)\n' \
		-X POST http://localhost:3000/api/auth/login || echo "  Proxy /api:       unreachable"
	@echo "==> frontend"
	@docker ps --filter name=^/lifetracker-web$$ --format '  lifetracker-web: {{.Status}}' || true

logs:
	@echo "Floci emulator logs (API/app logs appear here when running as a Lambda):"
	docker logs -f floci
