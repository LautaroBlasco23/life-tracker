# loadtest/Makefile — k6-based stress tests for life-tracker.
#
# Run from this directory, or from the repo root via `make loadtest-<target>`
# (the root Makefile delegates here). k6 runs in a Docker container, so only
# Docker is required — no local k6 install.
#
# Variables can be overridden on the command line, e.g.:
#   make provision USERS=500
#   make read-heavy RATE=600 DURATION=2m BASE_URL=http://localhost:3000

K6_IMAGE := grafana/k6:2.3.0@sha256:9c2dee7f8ed74d317e4027c06a10f169b625638189de8d4555d0b3486a5aeb34
TS := $(shell date +%Y%m%d-%H%M%S)
REPORTS_DIR := reports

# --- tunables (overridable via command line) ---
BASE_URL      ?= http://localhost:8080
USERS         ?= 100
PREFIX        ?=
VUS           ?= 20
RATE          ?= 300
DURATION      ?= 1m
MAX_VUS       ?= 1000
STEP          ?= 200
STEP_DUR      ?= 1m
SOAK_RATE     ?= 200
SOAK_DURATION ?= 30m
LOGIN_RATE    ?= 100
REFRESH_RATE  ?= 50
SPIKE_VUS     ?= 250

# --- live metrics (Prometheus remote write) ---
# k6 streams its metrics to the compose Prometheus every PUSH_INTERVAL, so the
# Grafana "Load Test" / "k6 Prometheus" dashboards update live during a run.
# Set REMOTE_WRITE=0 to disable (e.g. when Prometheus is not running).
PROMETHEUS_URL ?= http://localhost:9090/api/v1/write
PUSH_INTERVAL  ?= 1s
REMOTE_WRITE   ?= 1

K6_RW_ENV := $(if $(filter-out 0,$(REMOTE_WRITE)), \
	-e K6_PROMETHEUS_RW_SERVER_URL=$(PROMETHEUS_URL) \
	-e K6_PROMETHEUS_RW_PUSH_INTERVAL=$(PUSH_INTERVAL) \
	-e K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM=true,)
K6_OUT := $(if $(filter-out 0,$(REMOTE_WRITE)),-o experimental-prometheus-rw,)

K6_ENV := \
	-e LOADTEST_BASE_URL=$(BASE_URL) \
	-e LOADTEST_USERS=$(USERS) \
	-e LOADTEST_PREFIX=$(PREFIX) \
	-e LOADTEST_VUS=$(VUS) \
	-e LOADTEST_RATE=$(RATE) \
	-e LOADTEST_DURATION=$(DURATION) \
	-e LOADTEST_MAX_VUS=$(MAX_VUS) \
	-e LOADTEST_STEP=$(STEP) \
	-e LOADTEST_STEP_DUR=$(STEP_DUR) \
	-e LOADTEST_SOAK_RATE=$(SOAK_RATE) \
	-e LOADTEST_SOAK_DURATION=$(SOAK_DURATION) \
	-e LOADTEST_LOGIN_RATE=$(LOGIN_RATE) \
	-e LOADTEST_REFRESH_RATE=$(REFRESH_RATE) \
	-e LOADTEST_SPIKE_VUS=$(SPIKE_VUS)

# k6 in Docker, reaching the host network (Linux). --user root is required
# because the grafana/k6 image runs as non-root uid 12345, which cannot write
# to the host-mounted loadtest directory. On Docker Desktop/WSL where
# --network host is unavailable, set BASE_URL=http://host.docker.internal:8080.
K6 := docker run --rm --user root --network host -v $(CURDIR):/loadtest -w /loadtest $(K6_ENV) $(K6_RW_ENV) $(K6_IMAGE)

# All scenario runs stream to Prometheus when remote write is enabled.
K6_RUN := $(K6) run $(K6_OUT)

.PHONY: help run provision cleanup smoke static auth-storm \
	read-heavy write-heavy mixed-rhythms features breakpoint soak tap \
	stack-up stack-down monitoring-up fe-up fe-down

.DEFAULT_GOAL := help

help:
	@echo ""
	@echo "  loadtest — k6 stress tests for life-tracker"
	@echo ""
	@echo "  make run (or root: make loadtest) runs the FULL suite:"
	@echo "    stack up -> provision users -> smoke -> read/write/auth/mixed"
	@echo "    -> features (full API coverage) -> cleanup. Overrides: USERS RATE"
	@echo "    DURATION BASE_URL (skip cleanup with CLEANUP=0)"
	@echo ""
	@echo "  Individual targets (fine-tuning / advanced):"
	@echo "    provision      - create LOADTEST_USERS users, write users.json pool"
	@echo "    cleanup        - delete every user in users.json"
	@echo "    smoke          - end-to-end sanity: health/register/login/refresh/CRUD"
	@echo "    static         - frontend serving lane (nginx static export, no auth)"
	@echo "    auth-storm     - login+refresh at high rate (bcrypt CPU pressure)"
	@echo "    read-heavy     - sustained read req/s"
	@echo "    write-heavy    - sustained write req/s"
	@echo "    mixed-rhythms  - readers/writers/financers at different rhythms + spike"
	@echo "    features       - full API coverage: CRUD lifecycle on every domain"
	@echo "    breakpoint     - ramp VUs until the app collapses"
	@echo "    soak           - sustained load for a long window"
	@echo "    tap            - print live API responses (time | status | latency | body)"
	@echo ""
	@echo "  Stack targets:"
	@echo "    stack-up       - start self-contained load-test stack (api + DBs +"
	@echo "                     monitoring; own volumes, independent of .env)"
	@echo "    stack-down     - stop it (dev stack and floci are untouched)"
	@echo "    monitoring-up  - start Prometheus + Grafana only (needs API/DBs running)"
	@echo "    fe-up          - nginx frontend with /api -> direct API (load-test lane)"
	@echo "    fe-down        - stop frontend"
	@echo ""
	@echo "  Live metrics (Grafana http://localhost:3001):"
	@echo "    REMOTE_WRITE=0  disable k6 -> Prometheus streaming (default 1)"
	@echo "    PROMETHEUS_URL  remote-write endpoint (default http://localhost:9090/api/v1/write)"
	@echo ""
	@echo "  Common overrides: BASE_URL USERS PREFIX RATE DURATION MAX_VUS SOAK_* LOGIN_RATE"
	@echo "  Examples:"
	@echo "    make provision USERS=500"
	@echo "    make read-heavy RATE=600 DURATION=2m"
	@echo "    make mixed-rhythms BASE_URL=http://localhost:3000"

# --- one-shot full load test ---
# Stack up -> provision users -> smoke -> core scenarios -> cleanup.
# Command-line vars (USERS, RATE, DURATION, BASE_URL, ...) propagate to every
# step. Skip the final cleanup with CLEANUP=0.
CLEANUP ?= 1

run: stack-up provision smoke read-heavy write-heavy auth-storm mixed-rhythms features
	@echo ""
	@echo "==> scenarios finished — cleaning up test users"
	@if [ "$(CLEANUP)" != "0" ]; then $(MAKE) cleanup; fi
	@echo ""
	@echo "Load test complete."
	@echo "  Grafana dashboards: http://localhost:3001 (admin/admin)"
	@echo "  Stack still running — stop it with: make loadtest-stack-down"
	@echo "  Advanced runs: make loadtest-breakpoint | loadtest-soak | loadtest-static"

# --- user pool lifecycle ---

provision:
	# k6 --console-output APPENDS, so start from a clean pool — otherwise
	# stale users from previous runs pollute the pool and fail later logins.
	rm -f users.json
	$(K6_RUN) --log-format raw --console-output users.json provision.js

cleanup:
	$(K6_RUN) cleanup.js

# --- scenarios ---

smoke:
	$(K6_RUN) smoke.js

static:
	$(K6_RUN) static.js

auth-storm:
	mkdir -p $(REPORTS_DIR)
	$(K6_RUN) --out json=$(REPORTS_DIR)/auth-storm-$(TS).json auth-storm.js

read-heavy:
	mkdir -p $(REPORTS_DIR)
	$(K6_RUN) --out json=$(REPORTS_DIR)/read-heavy-$(TS).json read-heavy.js

write-heavy:
	mkdir -p $(REPORTS_DIR)
	$(K6_RUN) --out json=$(REPORTS_DIR)/write-heavy-$(TS).json write-heavy.js

mixed-rhythms:
	mkdir -p $(REPORTS_DIR)
	$(K6_RUN) --out json=$(REPORTS_DIR)/mixed-rhythms-$(TS).json mixed-rhythms.js

features:
	mkdir -p $(REPORTS_DIR)
	$(K6_RUN) --out json=$(REPORTS_DIR)/features-$(TS).json features.js

breakpoint:
	mkdir -p $(REPORTS_DIR)
	$(K6_RUN) --out json=$(REPORTS_DIR)/breakpoint-$(TS).json breakpoint.js

soak:
	mkdir -p $(REPORTS_DIR)
	$(K6_RUN) --out json=$(REPORTS_DIR)/soak-$(TS).json soak.js

# --- live response tap (host-side, python3) ---

TAP_PATH     ?= /api/activities/today
TAP_INTERVAL ?= 1

tap:
	python3 tap.py --path $(TAP_PATH) --interval $(TAP_INTERVAL) --base-url $(BASE_URL) --users-file users.json

# --- stack orchestration ---

# Self-contained load-test stack: api + postgres + mongodb + monitoring.
# Uses docker-compose.loadtest.yml (pinned credentials, own volumes), so it
# does NOT depend on .env and does not touch dev DB data or floci.
LTC := docker compose -f ../infra/docker-compose.yml -f ../infra/docker-compose.loadtest.yml

stack-up:
	$(LTC) up -d api postgres mongodb node-exporter prometheus grafana

stack-down:
	$(LTC) stop api postgres mongodb node-exporter prometheus grafana

monitoring-up:
	$(MAKE) -C .. monitoring-up

# nginx frontend proxying /api directly to the compose API (not floci).
# Requires the static export in the web volume (run `make deploy-frontend` once from the repo root).
fe-up:
	docker compose -f ../infra/docker-compose.frontend.yml -f ../infra/docker-compose.frontend.override.yml up -d

fe-down:
	docker compose -f ../infra/docker-compose.frontend.yml -f ../infra/docker-compose.frontend.override.yml stop
