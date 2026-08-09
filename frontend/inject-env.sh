#!/bin/sh
set -e

echo "window.__ENV__ = {" >/app/public/env-config.js
echo "  NEXT_PUBLIC_API_URL: '${NEXT_PUBLIC_API_URL}'" >>/app/public/env-config.js
echo "};" >>/app/public/env-config.js

echo "Runtime config injected: ${NEXT_PUBLIC_API_URL}"

exec "$@"
