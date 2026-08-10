#!/usr/bin/env bash
# Run DB migrations against the floci-provisioned services.
#
# Executes the migrate binary in a container on the floci network rather than
# on the host: host-side tools cannot always reach the emulator's bridge IPs
# (e.g. Docker Desktop WSL2), and the Lambda path must never run migrations
# per cold start — this is the provision-time migration step.
#
# Requires: scripts/provision.sh to have been run (reads ../.floci.env).

set -euo pipefail

FLOCI_CONTAINER="${FLOCI_CONTAINER:-floci}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.floci.env"
BACKEND_DIR="${SCRIPT_DIR}/../../backend"

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} not found — run 'make -C infra floci-provision' first." >&2
  exit 1
fi

NET="$(docker inspect "${FLOCI_CONTAINER}" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null | awk '{print $1}')"
NET="${NET:-golang_api_network}"

cd "${BACKEND_DIR}"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /tmp/lifetracker-migrate ./cmd/migrate
docker run --rm --network "${NET}" --env-file "${ENV_FILE}" \
  -v /tmp/lifetracker-migrate:/migrate:ro alpine /migrate
echo "  migrations applied"
