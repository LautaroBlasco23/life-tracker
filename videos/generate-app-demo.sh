#!/usr/bin/env bash
#
# Regenerate videos/app-demo.mp4 (see videos/APP-DEMO-GUIDE.md).
#
# Boots the standard dev lane (compose databases, air API on :8080, next dev
# on :3000), records the app demo with the committed Playwright pipeline,
# renders it with ffmpeg, copies the result into videos/, and stops the
# servers it started. Intentionally NOT wired into the Makefile — this
# folder is the self-contained home of the demo-video tooling.
#
# Usage: bash videos/generate-app-demo.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$REPO_ROOT/frontend"
LOG_DIR="${TMPDIR:-/tmp}/app-demo-logs"
mkdir -p "$LOG_DIR"

log() { printf '\n==> %s\n' "$*"; }
fail() { printf 'generate-app-demo: %s\n' "$*" >&2; exit 1; }

# --- Prerequisites ---------------------------------------------------------
command -v ffmpeg >/dev/null 2>&1 || fail "ffmpeg not found on PATH."
command -v air >/dev/null 2>&1 || fail "air not found on PATH (go install github.com/air-verse/air@latest)."
command -v node >/dev/null 2>&1 || fail "node not found on PATH."
[ -f "$REPO_ROOT/.env" ] || fail ".env not found — run 'make setup' first."
[ -d "$FRONTEND/node_modules" ] || fail "frontend/node_modules missing — run 'npm install' inside frontend/."

port_busy() { ss -tlnH "sport = :$1" 2>/dev/null | grep -q .; }
port_busy 3000 && fail "port 3000 already in use — is 'make dev' running? Stop it first (make stop)."
port_busy 8080 && fail "port 8080 already in use — is the API already running? Stop it first (make stop)."

cleanup() {
  log "stopping servers started by this script"
  pkill -f "$FRONTEND/node_modules/.bin/[n]ext" 2>/dev/null || true
  pkill -f "[a]ir -c .air.toml" 2>/dev/null || true
}
trap cleanup EXIT INT

# --- Dev lane (compose databases + air API + next dev) ---------------------
log "starting databases (compose)"
make -C "$REPO_ROOT" db-up >/dev/null
until docker exec golang_api_postgres pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done

log "starting API (air) on :8080 — log: $LOG_DIR/api.log"
( cd "$REPO_ROOT/backend" && setsid air -c .air.toml >"$LOG_DIR/api.log" 2>&1 ) &

log "starting web (next dev) on :3000 — log: $LOG_DIR/web.log"
( cd "$FRONTEND" && setsid env NEXT_PUBLIC_API_URL=http://localhost:8080/api \
    npm run dev >"$LOG_DIR/web.log" 2>&1 ) &

log "waiting for readiness"
for _ in $(seq 1 60); do
  curl -sf -o /dev/null http://localhost:8080/api/auth/register -X OPTIONS 2>/dev/null && break
  curl -sf -o /dev/null http://localhost:8080 && break
  sleep 1
done
port_busy 8080 || fail "API did not come up on :8080 — check $LOG_DIR/api.log"
for _ in $(seq 1 60); do
  curl -sf -o /dev/null http://localhost:3000 && break
  sleep 1
done
port_busy 3000 || fail "web did not come up on :3000 — check $LOG_DIR/web.log"

# --- Capture + render ------------------------------------------------------
log "recording the demo (Playwright) — this takes ~2 minutes"
( cd "$FRONTEND" && PLAYWRIGHT_API_URL=http://localhost:8080/api npm run demo:video ) \
  >"$LOG_DIR/capture.log" 2>&1 || {
  tail -20 "$LOG_DIR/capture.log" >&2
  fail "capture/render failed — see $LOG_DIR/capture.log"
}

# --- Publish into videos/ ---------------------------------------------------
log "copying artifacts into videos/"
cp "$FRONTEND/demo/output/demo.mp4" "$REPO_ROOT/videos/app-demo.mp4"
cp "$FRONTEND/demo/output/demo-poster.jpg" "$REPO_ROOT/videos/app-demo-poster.jpg"
SIZE_MB=$(du -m "$REPO_ROOT/videos/app-demo.mp4" | cut -f1)
[ "$SIZE_MB" -le 10 ] || log "WARNING: app-demo.mp4 is ${SIZE_MB} MB — GitHub embed budget is 10 MB."

log "done: videos/app-demo.mp4 (${SIZE_MB} MB) + videos/app-demo-poster.jpg"
log "review it, then commit both files together with any spec changes."
