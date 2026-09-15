#!/usr/bin/env bash
# Provision AWS-shaped resources on floci (local AWS emulator, port 4566).
#
# Idempotent: safe to re-run. Creates:
#   - S3 bucket            lifetracker-images
#   - RDS Postgres         lifetracker-postgres (real postgres:16-alpine container)
#   - DocumentDB cluster   lifetracker-docdb    (real mongo:7.0 container)
#   - Secrets Manager      life-tracker/jwt-secret
#   - .floci.env           env file pointing the app at the provisioned services
#
# Requires the floci container (name: floci, latest-compat image) to be running
# with the Docker socket mounted (see `make floci-up`).
#
# Env overrides:
#   FLOCI_CONTAINER   floci container name (default: floci)
#   FLOCI_NETWORK     docker network the floci container joins (default: golang_api_network)
#   DB_NAME           database name (default: life_tracker)
#   DB_USER           postgres user (default: postgres)
#   DB_PASSWORD       postgres password (default: dev-db-password)
#   DOCDB_USER        documentdb master user (default: root)
#   DOCDB_PASSWORD    documentdb master password (default: dev-docdb-password)
#   JWT_SECRET        secret stored in Secrets Manager (default: generated once, reused)

set -euo pipefail

FLOCI_CONTAINER="${FLOCI_CONTAINER:-floci}"
# Auto-detect the network floci is attached to (compose prefixes it with the
# project name, e.g. backend_golang_api_network). Override with FLOCI_NETWORK.
FLOCI_NETWORK="${FLOCI_NETWORK:-$(docker inspect "${FLOCI_CONTAINER}" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null | awk '{print $1}')}"
if [ -z "${FLOCI_NETWORK}" ]; then
  FLOCI_NETWORK="golang_api_network"
fi
ENDPOINT_URL="http://localhost:4566"
REGION="us-east-1"

DB_NAME="${DB_NAME:-life_tracker}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-dev-db-password}"
DOCDB_USER="${DOCDB_USER:-root}"
DOCDB_PASSWORD="${DOCDB_PASSWORD:-dev-docdb-password}"

S3_BUCKET="lifetracker-images"
SECRET_NAME="life-tracker/jwt-secret"
RDS_ID="lifetracker-postgres"
DOCDB_ID="lifetracker-docdb"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.floci.env"

aws_cmd() {
  docker exec "${FLOCI_CONTAINER}" aws --endpoint-url "${ENDPOINT_URL}" --region "${REGION}" "$@"
}

wait_for() {
  local desc="$1"
  shift
  local tries="${FLOCI_WAIT_TRIES:-36}"
  local i=0
  until "$@"; do
    i=$((i + 1))
    if [ "${i}" -ge "${tries}" ]; then
      echo "ERROR: timed out waiting for ${desc}" >&2
      return 1
    fi
    echo "  waiting for ${desc}... (${i}/${tries})"
    sleep 5
  done
  echo "  ${desc} is ready"
}

echo "==> Waiting for floci health"
wait_for "floci health" docker exec "${FLOCI_CONTAINER}" curl -sf "${ENDPOINT_URL}/_localstack/health" >/dev/null

echo "==> S3 bucket"
if ! aws_cmd s3api head-bucket --bucket "${S3_BUCKET}" >/dev/null 2>&1; then
  aws_cmd s3 mb "s3://${S3_BUCKET}" >/dev/null
  echo "  created ${S3_BUCKET}"
else
  echo "  ${S3_BUCKET} already exists"
fi

echo "==> Secrets Manager (${SECRET_NAME})"
if aws_cmd secretsmanager describe-secret --secret-id "${SECRET_NAME}" >/dev/null 2>&1; then
  JWT_SECRET="$(aws_cmd secretsmanager get-secret-value --secret-id "${SECRET_NAME}" --query SecretString --output text)"
  echo "  secret already exists"
else
  JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32 2>/dev/null || echo "dev-secret-change-me")}"
  aws_cmd secretsmanager create-secret --name "${SECRET_NAME}" --secret-string "${JWT_SECRET}" >/dev/null
  echo "  created secret"
fi

echo "==> RDS Postgres (${RDS_ID})"
# floci parity gap: describe-db-instances returns [] with exit 0 for a missing
# instance (real AWS raises DBInstanceNotFound). Check the list length instead.
if [ "$(aws_cmd rds describe-db-instances --db-instance-identifier "${RDS_ID}" --query 'length(DBInstances)' --output text 2>/dev/null || echo 0)" = "0" ]; then
  aws_cmd rds create-db-instance \
    --db-instance-identifier "${RDS_ID}" \
    --db-instance-class db.t3.micro \
    --engine postgres --engine-version 16 \
    --master-username "${DB_USER}" \
    --master-user-password "${DB_PASSWORD}" \
    --allocated-storage 20 \
    --db-name "${DB_NAME}" \
    --no-publicly-accessible >/dev/null
  echo "  instance created"
fi
rds_endpoint() {
  local addr
  addr="$(aws_cmd rds describe-db-instances --db-instance-identifier "${RDS_ID}" --query 'DBInstances[0].Endpoint.Address' --output text 2>/dev/null || echo None)"
  [ "${addr}" != "None" ] && [ -n "${addr}" ]
}
echo "  resolving endpoint"
wait_for "RDS endpoint" rds_endpoint
RDS_ENDPOINT="$(aws_cmd rds describe-db-instances --db-instance-identifier "${RDS_ID}" --query 'DBInstances[0].Endpoint.Address' --output text)"
RDS_PORT="$(aws_cmd rds describe-db-instances --db-instance-identifier "${RDS_ID}" --query 'DBInstances[0].Endpoint.Port' --output text)"
echo "  endpoint: ${RDS_ENDPOINT}:${RDS_PORT}"
echo "  waiting for postgres to accept connections"
wait_for "postgres readiness" docker run --rm --network "${FLOCI_NETWORK}" postgres:16-alpine \
  pg_isready -h "${RDS_ENDPOINT}" -p "${RDS_PORT}" -U "${DB_USER}"

# Separate database for the test suite: tests build their schema with GORM
# AutoMigrate and drop tables between runs, which is incompatible with the
# migration-managed app database (schema_migrations would disagree with the
# actual tables). Keeping them apart lets `make test-floci` and `floci-deploy`
# run against the same RDS instance without clobbering each other.
TEST_DB_NAME="${DB_NAME}_test"
echo "  ensuring test database ${TEST_DB_NAME}"
if [ "$(docker run --rm --network "${FLOCI_NETWORK}" -e PGPASSWORD="${DB_PASSWORD}" postgres:16-alpine \
  psql -h "${RDS_ENDPOINT}" -p "${RDS_PORT}" -U "${DB_USER}" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}'" 2>/dev/null)" != "1" ]; then
  docker run --rm --network "${FLOCI_NETWORK}" -e PGPASSWORD="${DB_PASSWORD}" postgres:16-alpine \
    createdb -h "${RDS_ENDPOINT}" -p "${RDS_PORT}" -U "${DB_USER}" "${TEST_DB_NAME}"
  echo "  created ${TEST_DB_NAME}"
else
  echo "  ${TEST_DB_NAME} already exists"
fi

echo "==> DocumentDB cluster (${DOCDB_ID})"
# floci persists cluster records but does not restart the backing mongo
# container on boot (unlike RDS, whose backend is auto-restarted). A record
# whose container is gone/stopped must be deleted or provisioning will wait
# forever on the dead endpoint. Delete it here so the recreate path below runs.
if [ "$(aws_cmd docdb describe-db-clusters --db-cluster-identifier "${DOCDB_ID}" --query 'length(DBClusters)' --output text 2>/dev/null || echo 0)" != "0" ] \
   && [ "$(docker inspect "floci-docdb-${DOCDB_ID}" --format '{{.State.Running}}' 2>/dev/null || echo missing)" != "true" ]; then
  echo "  stale cluster record (backing container not running) — recreating"
  aws_cmd docdb delete-db-cluster --db-cluster-identifier "${DOCDB_ID}" --skip-final-snapshot >/dev/null
  i=0
  while [ "$(aws_cmd docdb describe-db-clusters --db-cluster-identifier "${DOCDB_ID}" --query 'length(DBClusters)' --output text 2>/dev/null || echo 0)" != "0" ]; do
    i=$((i + 1))
    [ "${i}" -ge 12 ] && { echo "ERROR: timed out deleting stale ${DOCDB_ID}" >&2; exit 1; }
    sleep 1
  done
fi
if [ "$(aws_cmd docdb describe-db-clusters --db-cluster-identifier "${DOCDB_ID}" --query 'length(DBClusters)' --output text 2>/dev/null || echo 0)" = "0" ]; then
  aws_cmd docdb create-db-cluster \
    --db-cluster-identifier "${DOCDB_ID}" \
    --engine docdb --engine-version 7.0 \
    --master-username "${DOCDB_USER}" \
    --master-user-password "${DOCDB_PASSWORD}" >/dev/null
  echo "  cluster created"
fi
docdb_endpoint() {
  local addr
  addr="$(aws_cmd docdb describe-db-clusters --db-cluster-identifier "${DOCDB_ID}" --query 'DBClusters[0].Endpoint' --output text 2>/dev/null || echo None)"
  [ "${addr}" != "None" ] && [ -n "${addr}" ]
}
echo "  resolving endpoint"
wait_for "DocumentDB endpoint" docdb_endpoint
DOCDB_ENDPOINT="$(aws_cmd docdb describe-db-clusters --db-cluster-identifier "${DOCDB_ID}" --query 'DBClusters[0].Endpoint' --output text)"
DOCDB_PORT="$(aws_cmd docdb describe-db-clusters --db-cluster-identifier "${DOCDB_ID}" --query 'DBClusters[0].Port' --output text)"
echo "  endpoint: ${DOCDB_ENDPOINT}:${DOCDB_PORT}"
echo "  waiting for mongodb to accept connections"
wait_for "docdb readiness" docker run --rm --network "${FLOCI_NETWORK}" mongo:7.0 \
  mongosh "mongodb://${DOCDB_USER}:${DOCDB_PASSWORD}@${DOCDB_ENDPOINT}:${DOCDB_PORT}" --quiet --eval 'db.runCommand({ping:1})' >/dev/null

echo "==> Writing ${ENV_FILE}"
cat > "${ENV_FILE}" <<EOF
# Generated by scripts/provision.sh — machine-specific, do not commit.
DB_HOST=${RDS_ENDPOINT}
DB_PORT=${RDS_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_SSLMODE=disable
MONGO_URI=mongodb://${DOCDB_USER}:${DOCDB_PASSWORD}@${DOCDB_ENDPOINT}:${DOCDB_PORT}
MONGO_DATABASE=${DB_NAME}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=168h
AWS_ENDPOINT_URL=${ENDPOINT_URL}
AWS_REGION=${REGION}
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
S3_BUCKET=${S3_BUCKET}
S3_PUBLIC_URL=http://localhost:4566
SECRETS_JWT_NAME=${SECRET_NAME}
APP_RUNTIME=
CORS_ALLOWED_ORIGINS=*
EOF

echo ""
echo "Provisioning complete."
echo "  RDS:        ${RDS_ENDPOINT}:${RDS_PORT} (postgres/${DB_NAME})"
echo "  DocumentDB: ${DOCDB_ENDPOINT}:${DOCDB_PORT} (mongodb/${DB_NAME})"
echo "  S3:         ${S3_BUCKET}"
echo "  Secret:     ${SECRET_NAME}"
echo "  Env file:   ${ENV_FILE}"
