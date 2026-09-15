#!/bin/sh
set -e

# Runtime env-config consumed by the app at page load via
# <script src="/env-config.js"> (app/layout.tsx) and the window.__ENV__ lookup
# in packages/shared/src/lib/config.ts.
echo "window.__ENV__ = {" >/usr/share/nginx/html/env-config.js
echo "  NEXT_PUBLIC_API_URL: '${NEXT_PUBLIC_API_URL}'" >>/usr/share/nginx/html/env-config.js
echo "};" >>/usr/share/nginx/html/env-config.js

echo "Runtime config injected: ${NEXT_PUBLIC_API_URL}"

# Hand off to nginx's entrypoint: it renders /etc/nginx/templates/*.template
# (envsubst of GATEWAY_UPSTREAM) before starting nginx in the foreground.
exec /docker-entrypoint.sh nginx -g 'daemon off;'
