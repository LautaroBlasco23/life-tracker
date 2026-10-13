#!/usr/bin/env bash
# Build the Next.js static export and copy it into the running web container
# (nginx volume), including the runtime env-config.js baked with the API URL.
#
# Env:
#   NEXT_PUBLIC_API_URL   Base API URL baked into out/env-config.js.
#                         Default: http://localhost:3000/api — same-origin via
#                         the nginx proxy.
#   WEB_CONTAINER         nginx container name. Default: lifetracker-web

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/../frontend"
STAGE_DIR="${FRONTEND_DIR}/out"
WEB_CONTAINER="${WEB_CONTAINER:-lifetracker-web}"

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3000/api}"

if ! docker inspect "${WEB_CONTAINER}" >/dev/null 2>&1; then
  echo "ERROR: ${WEB_CONTAINER} is not running — start it first (make frontend-up)" >&2
  exit 1
fi

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

echo "==> Populating web volume (lifetracker-web-data)"
# Serve from a named volume, not a host bind mount: next build deletes/recreates
# out/, which breaks host bind mounts under Docker Desktop's WSL integration.
docker exec "${WEB_CONTAINER}" sh -c 'rm -rf /usr/share/nginx/html/*' >/dev/null 2>&1
docker cp "${STAGE_DIR}/." "${WEB_CONTAINER}:/usr/share/nginx/html/" >/dev/null
echo "  copied ${STAGE_DIR} -> ${WEB_CONTAINER}:/usr/share/nginx/html"

echo ""
echo "  App: http://localhost:3000/   (nginx serving the export; API proxied same-origin)"
