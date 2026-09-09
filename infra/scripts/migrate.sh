#!/usr/bin/env bash
# Run DB migrations against the provisioned services.
#
# Executes the migrate binary in a container on the target docker network rather
# than on the host: host-side tools cannot always reach bridge IPs (e.g. Docker
# Desktop WSL2), and the Lambda path must never run migrations per cold start —
# this is the provision-time migration step.
#
# Env:
#   ENV_FILE   env file with DB/Mongo connection settings.
#              Default: ../.floci.env (floci path). Container mode passes
#              the repo-root .env (DB_HOST/MONGO_URI must use compose service
#              hostnames — the api container already relies on that; this
#              script overrides them onto the network anyway).
#   NETWORK    docker network to attach to. Default: the floci container's
#              first network (floci path); container mode passes
#              infra_golang_api_network.

set -euo pipefail

FLOCI_CONTAINER="${FLOCI_CONTAINER:-floci}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/../.floci.env}"
BACKEND_DIR="${SCRIPT_DIR}/../../backend"

if [ -z "${NETWORK:-}" ]; then
  NETWORK="$(docker inspect "${FLOCI_CONTAINER}" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null | awk '{print $1}')"
fi
NETWORK="${NETWORK:-golang_api_network}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} not found" >&2
  exit 1
fi

cd "${BACKEND_DIR}"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /tmp/lifetracker-migrate ./cmd/migrate
docker run --rm --network "${NETWORK}" --env-file "${ENV_FILE}" \
  -e DB_HOST=postgres \
  -e MONGO_URI= \
  -e MONGO_HOST=mongodb \
  -v /tmp/lifetracker-migrate:/migrate:ro alpine /migrate
echo "  migrations applied"
