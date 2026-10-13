#!/usr/bin/env bash
# Run DB migrations against the compose services.
#
# Executes the migrate binary in a container on the compose network rather
# than on the host: host-side tools cannot always reach bridge IPs (e.g. Docker
# Desktop WSL2). The API container runs its embedded migrations on every
# (re)start too — this script is the explicit, standalone equivalent.
#
# Env:
#   ENV_FILE   env file with DB/Mongo connection settings. Default: .env at
#              the repo root.
#   NETWORK    docker network to attach to. Default: infra_golang_api_network
#              (the compose project network; project name is pinned to `infra`
#              in docker-compose.yml).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$(realpath "${SCRIPT_DIR}/../.env")}"
BACKEND_DIR="${SCRIPT_DIR}/../backend"
NETWORK="${NETWORK:-infra_golang_api_network}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} not found" >&2
  exit 1
fi

cd "${BACKEND_DIR}"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /tmp/lifetracker-migrate ./cmd/migrate

docker run --rm --network "${NETWORK}" --env-file "${ENV_FILE}" \
  -e DB_HOST=postgres -e MONGO_URI= -e MONGO_HOST=mongodb \
  -v /tmp/lifetracker-migrate:/migrate:ro \
  alpine /migrate
echo "  migrations applied"
