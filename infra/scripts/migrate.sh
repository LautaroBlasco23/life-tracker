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
#              the repo-root .env.
#   CONTAINER_MODE
#              Set to 1 for the compose path: overrides DB/Mongo hosts with
#              the compose service names (postgres/mongodb), which only
#              resolve on infra_golang_api_network. Must stay off for the
#              floci path — floci spawns its own DB containers with
#              different names, and the override breaks it (CI's
#              floci-deploy uses this path).
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
CONTAINER_MODE="${CONTAINER_MODE:-0}"

docker_opts=(--rm --network "${NETWORK}" --env-file "${ENV_FILE}"
  -v /tmp/lifetracker-migrate:/migrate:ro)
if [ "${CONTAINER_MODE}" = "1" ]; then
  # Compose network: rewrite the .env hosts to the compose service names.
  docker_opts+=(-e DB_HOST=postgres -e MONGO_URI= -e MONGO_HOST=mongodb)
fi

docker run "${docker_opts[@]}" alpine /migrate
echo "  migrations applied"
