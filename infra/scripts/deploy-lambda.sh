#!/usr/bin/env bash
# Deploy the backend as a single Go Lambda behind API Gateway v2 on floci.
#
# Steps:
#   1. Build the Gin app as a Linux binary (APP_RUNTIME=serverless path).
#   2. Create/update the Lambda function (runtime provided.al2, handler bootstrap).
#   3. Create/update an HTTP API Gateway v2 API with ANY /{proxy+} -> Lambda.
#   4. Print the invocation URL.
#
# Requires: scripts/provision.sh to have been run (reads ../.floci.env).
#
# Env overrides:
#   FLOCI_CONTAINER   floci container name (default: floci)
#   FUNCTION_NAME     Lambda function name (default: lifetracker-api)
#   API_ID            pinned API Gateway id via floci:override-id (default: lifetracker-api)

set -euo pipefail

FLOCI_CONTAINER="${FLOCI_CONTAINER:-floci}"
FUNCTION_NAME="${FUNCTION_NAME:-lifetracker-api}"
API_ID="${API_ID:-lifetracker-api}"
ENDPOINT_URL="http://localhost:4566"
REGION="us-east-1"
ROLE="arn:aws:iam::000000000000:role/lambda-role"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../../backend"
ENV_FILE="${SCRIPT_DIR}/../.floci.env"

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} not found — run 'make floci-provision' first." >&2
  exit 1
fi

aws_cmd() {
  docker exec "${FLOCI_CONTAINER}" aws --endpoint-url "${ENDPOINT_URL}" --region "${REGION}" "$@"
}

# Load .floci.env (shell-safe: simple KEY=value lines, no spaces)
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

# Lambda containers share the docker network with floci; reach floci via the
# IP that the provisioned RDS endpoint resolved to (guaranteed reachable).
FLOCI_IP="${DB_HOST%%:*}"
FLOCI_INTERNAL_URL="http://${FLOCI_IP}:4566"

echo "==> Running migrations (provision-time, not per cold start)"
bash "${SCRIPT_DIR}/migrate.sh"

echo "==> Building Lambda binary"
cd "${BACKEND_DIR}"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bootstrap ./cmd/main
python3 - <<'PY'
import shutil
shutil.make_archive('/tmp/lifetracker-lambda', 'zip', '.', 'bootstrap')
PY
docker cp /tmp/lifetracker-lambda.zip "${FLOCI_CONTAINER}:/tmp/lifetracker-lambda.zip"
echo "  binary built and uploaded"

LAMBDA_ENV="Variables={ENVIRONMENT=dev,APP_RUNTIME=serverless,DB_HOST=${DB_HOST},DB_PORT=${DB_PORT},DB_USER=${DB_USER},DB_PASSWORD=${DB_PASSWORD},DB_NAME=${DB_NAME},DB_SSLMODE=${DB_SSLMODE},MONGO_URI=${MONGO_URI},MONGO_DATABASE=${MONGO_DATABASE},JWT_SECRET=${JWT_SECRET},JWT_EXPIRY=${JWT_EXPIRY},JWT_REFRESH_EXPIRY=${JWT_REFRESH_EXPIRY},AWS_ENDPOINT_URL=${FLOCI_INTERNAL_URL},AWS_REGION=${AWS_REGION},AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID},AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY},S3_BUCKET=${S3_BUCKET},S3_PUBLIC_URL=${S3_PUBLIC_URL},SECRETS_JWT_NAME=${SECRETS_JWT_NAME},CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS:-*}}"

echo "==> Lambda function"
if aws_cmd lambda get-function --function-name "${FUNCTION_NAME}" >/dev/null 2>&1; then
  aws_cmd lambda update-function-code --function-name "${FUNCTION_NAME}" --zip-file fileb:///tmp/lifetracker-lambda.zip >/dev/null
  aws_cmd lambda update-function-configuration --function-name "${FUNCTION_NAME}" \
    --timeout 60 --memory-size 512 --environment "${LAMBDA_ENV}" >/dev/null
  echo "  function updated"
else
  aws_cmd lambda create-function \
    --function-name "${FUNCTION_NAME}" \
    --runtime provided.al2 \
    --handler bootstrap \
    --role "${ROLE}" \
    --zip-file fileb:///tmp/lifetracker-lambda.zip \
    --timeout 60 --memory-size 512 \
    --environment "${LAMBDA_ENV}" >/dev/null
  echo "  function created"
fi

echo "==> API Gateway v2"
# Pin a stable API id so the invocation URL survives redeploys.
if ! aws_cmd apigatewayv2 get-api --api-id "${API_ID}" >/dev/null 2>&1; then
  aws_cmd apigatewayv2 create-api \
    --name "lifetracker-api" \
    --protocol-type HTTP \
    --tags "{\"floci:override-id\":\"${API_ID}\"}" >/dev/null
  echo "  API created (${API_ID})"
fi

# Fresh integration + route each deploy (idempotent).
for int_id in $(aws_cmd apigatewayv2 get-integrations --api-id "${API_ID}" --query 'Items[].IntegrationId' --output text); do
  aws_cmd apigatewayv2 delete-integration --api-id "${API_ID}" --integration-id "${int_id}" >/dev/null 2>&1 || true
done
INT_ID="$(aws_cmd apigatewayv2 create-integration \
  --api-id "${API_ID}" \
  --integration-type AWS_PROXY \
  --integration-uri "arn:aws:lambda:${REGION}:000000000000:function:${FUNCTION_NAME}" \
  --payload-format-version 2.0 \
  --query IntegrationId --output text)"
echo "  integration: ${INT_ID}"

for route_id in $(aws_cmd apigatewayv2 get-routes --api-id "${API_ID}" --query 'Items[].RouteId' --output text); do
  aws_cmd apigatewayv2 delete-route --api-id "${API_ID}" --route-id "${route_id}" >/dev/null 2>&1 || true
done
aws_cmd apigatewayv2 create-route \
  --api-id "${API_ID}" \
  --route-key "ANY /{proxy+}" \
  --target "integrations/${INT_ID}" >/dev/null
echo "  route ANY /{proxy+}"

# Use a named stage ("dev") rather than AWS's "$default": the literal '$' in the
# URL breaks shell/nginx configs, and floci's gateway answers OPTIONS preflights
# itself (without CORS headers), so the frontend must call the API same-origin
# via the nginx proxy on :3000 — see docker-compose.frontend.yml.
if ! aws_cmd apigatewayv2 get-stage --api-id "${API_ID}" --stage-name dev >/dev/null 2>&1; then
  aws_cmd apigatewayv2 create-stage --api-id "${API_ID}" --stage-name dev --auto-deploy >/dev/null
  echo "  stage dev created"
else
  echo "  stage dev exists"
fi
# Remove the old $default stage (from earlier deploys) so the invoke URL is unambiguous.
if aws_cmd apigatewayv2 get-stage --api-id "${API_ID}" --stage-name '$default' >/dev/null 2>&1; then
  aws_cmd apigatewayv2 delete-stage --api-id "${API_ID}" --stage-name '$default' >/dev/null
  echo "  removed legacy \$default stage"
fi

echo ""
echo "Deploy complete."
echo "  Lambda:       ${FUNCTION_NAME}"
echo "  API:          ${API_ID}"
echo "  Invoke URL:   http://localhost:4566/execute-api/${API_ID}/dev/"
echo "  Health:       curl http://localhost:4566/execute-api/${API_ID}/dev/health"
echo "  App API:      http://localhost:3000/api  (same-origin via nginx proxy)"
