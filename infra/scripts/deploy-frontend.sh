#!/usr/bin/env bash
set -euo pipefail

# Deploy the static frontend export to floci (S3 + CloudFront emulation).
#
# Assumes:
#   - floci is running on the host at http://localhost:4566
#   - the floci container is named `floci` and bundles the AWS CLI
#     (all aws calls are wrapped as `docker exec floci aws --endpoint-url ...`)
#
# Env:
#   NEXT_PUBLIC_API_URL   Base API URL baked into out/env-config.js.
#                         Default: http://localhost:3000/api — same-origin via
#                         the nginx proxy (no CORS preflight; floci's gateway
#                         cannot answer preflights).
#                         Direct gateway: http://localhost:4566/execute-api/lifetracker-api/dev/api
#                         Prod: https://<api-id>.execute-api.<region>.amazonaws.com/<stage>/api
#   FLOCI_HOST            Host where floci is reachable. Default: localhost
#   FLOCI_PORT            floci port. Default: 4566
#   DEPLOY_S3             Sync the build to S3 + register CloudFront (needs a
#                         running floci). Default: 1. Container-mode deploys
#                         (make dev / dev-full, no floci) pass DEPLOY_S3=0.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/../../frontend"

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3000/api}"
FLOCI_HOST="${FLOCI_HOST:-localhost}"
FLOCI_PORT="${FLOCI_PORT:-4566}"
DEPLOY_S3="${DEPLOY_S3:-1}"
BUCKET="lifetracker-web"
ENDPOINT_URL="http://localhost:4566"
STAGE_DIR="${FRONTEND_DIR}/out"

aws_cmd() {
  docker exec floci aws --endpoint-url "${ENDPOINT_URL}" "$@"
}

echo "==> Building static export"
cd "${FRONTEND_DIR}"
npm run build

if [ ! -f "${STAGE_DIR}/index.html" ]; then
  echo "ERROR: ${STAGE_DIR}/index.html not found after build" >&2
  exit 1
fi

echo "==> Generating runtime config (${STAGE_DIR}/env-config.js)"
# The value is embedded in a single-quoted JS string: escape single quotes so a
# crafted API_URL can't break out of it.
API_URL_ESCAPED=$(printf '%s' "${API_URL}" | sed "s/'/'\\\\''/g")
cat >"${STAGE_DIR}/env-config.js" <<EOF
window.__ENV__ = { NEXT_PUBLIC_API_URL: '${API_URL_ESCAPED}' };
EOF

if [ "${DEPLOY_S3}" = "1" ]; then
echo "==> Ensuring bucket '${BUCKET}' exists"
if ! aws_cmd s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  if ! aws_cmd s3 mb "s3://${BUCKET}" 2>/tmp/deploy-s3mb.err; then
    if ! grep -q "BucketAlreadyOwnedByYou" /tmp/deploy-s3mb.err; then
      echo "ERROR: could not create bucket '${BUCKET}':" >&2
      cat /tmp/deploy-s3mb.err >&2
      exit 1
    fi
  fi
fi

echo "==> Syncing ${STAGE_DIR}/ -> s3://${BUCKET}"
# s3 sync runs inside the floci container (aws CLI is bundled there), so the
# build output must be copied in first.
CONTAINER_STAGE="/tmp/lifetracker-web-out"
docker exec floci rm -rf "${CONTAINER_STAGE}" >/dev/null 2>&1 || true
docker cp "${STAGE_DIR}/" "floci:${CONTAINER_STAGE}/" >/dev/null
aws_cmd s3 sync "${CONTAINER_STAGE}/" "s3://${BUCKET}" --delete
else
echo "==> Skipping S3 sync (DEPLOY_S3=0 — container mode, no floci)"
fi

echo "==> Populating web volume (lifetracker-web-data)"
# Serve from a named volume, not a host bind mount: next build deletes/recreates
# out/, which breaks host bind mounts under Docker Desktop's WSL integration.
docker exec lifetracker-web sh -c 'rm -rf /usr/share/nginx/html/*' >/dev/null 2>&1
docker cp "${STAGE_DIR}/." lifetracker-web:/usr/share/nginx/html/ >/dev/null
echo "  copied ${STAGE_DIR} -> lifetracker-web:/usr/share/nginx/html"

echo "==> CloudFront distribution (best-effort in floci)"
DIST_ID=""
if [ "${DEPLOY_S3}" != "1" ]; then
  echo "  skipped (DEPLOY_S3=0)"
else
  EXISTING_DIST=$(aws_cmd cloudfront list-distributions --query "DistributionList.Items[?contains(Origins.Items[].DomainName, '${BUCKET}')].Id | [0]" --output text 2>/dev/null || true)
  if [ -n "${EXISTING_DIST}" ] && [ "${EXISTING_DIST}" != "None" ]; then
    DIST_ID="${EXISTING_DIST}"
  else
    DIST_CONFIG_TMP=$(mktemp)
    trap 'rm -f "${DIST_CONFIG_TMP}"' EXIT
    cat >"${DIST_CONFIG_TMP}" <<EOF
{
  "CallerReference": "lifetracker-web-$(date +%s)",
  "Comment": "lifetracker-web static site",
  "Enabled": true,
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "lifetracker-web-origin",
        "DomainName": "${BUCKET}.s3.amazonaws.com"
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "lifetracker-web-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": { "Forward": "none" }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400
  }
}
EOF
    docker cp "${DIST_CONFIG_TMP}" floci:/tmp/distribution-config.json >/dev/null
    DIST_ID=$(aws_cmd cloudfront create-distribution \
      --distribution-config file:///tmp/distribution-config.json \
      --query 'Distribution.Id' --output text 2>/dev/null || true)
  fi
fi

echo ""
echo "==================================================================="
echo " Deployment summary"
echo "==================================================================="
echo "  Build output:     ${STAGE_DIR}/"
echo "  API base URL:     ${API_URL}"
if [ "${DEPLOY_S3}" = "1" ]; then
  echo "  S3 bucket:        s3://${BUCKET}"
  if [ -n "${DIST_ID}" ] && [ "${DIST_ID}" != "None" ]; then
    echo "  CloudFront dist:  ${DIST_ID}"
  else
    echo "  CloudFront dist:  (skipped — floci CloudFront emulation has parity gaps)"
  fi
else
  echo "  S3 bucket:        (skipped — DEPLOY_S3=0)"
fi
echo ""
echo "  Working app URL:  http://localhost:3000/   (nginx serving the export; API on the same origin)"
echo "  S3 artifact:      http://localhost:4566/${BUCKET}/index.html"
echo ""
echo "  Note: the Next.js export uses root-relative asset paths, so it must be"
echo "  served at the domain root — nginx on :3000 is the local stand-in for"
echo "  CloudFront. The S3 bucket is the deploy artifact (and CI validates it),"
echo "  but path-style bucket URLs cannot host the app directly."
echo "==================================================================="
