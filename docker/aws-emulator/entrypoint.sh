#!/bin/sh
# AWS Emulator entrypoint wrapper.
#
# At every start the emulator generates a fresh self-signed TLS certificate
# and writes it (mode 0600, owned by this container's uid 1000) under
# $HOME/.aws/emulator/<port>/. Consumers need that file readable:
#   - the api container (uid 1001) reads it via AWS_CA_BUNDLE when the api
#     runs on the host lane (`make dev`),
#   - local SDKs/CLI on the host do the same.
# This wrapper waits for the files, relaxes the mode (it owns them), then
# keeps the emulator in the foreground. Compose publishes the port loopback
# only, so the relaxed mode does not expose the emulator beyond localhost.
set -eu

PORT=9297
prev=
for arg in "$@"; do
  case "$prev" in
    -p | --port) PORT=$arg ;;
  esac
  prev=$arg
done

DIR="$HOME/.aws/emulator/$PORT"

aws-emulator "$@" &
PID=$!

tries=0
until [ -f "$DIR/ca.pem" ] || [ "$tries" -ge 120 ]; do
  sleep 0.5
  tries=$((tries + 1))
done
if [ ! -f "$DIR/ca.pem" ]; then
  echo "aws-emulator did not write $DIR/ca.pem within 60s" >&2
  kill "$PID" 2>/dev/null || true
  exit 1
fi
chmod -R a+rX "$HOME/.aws/emulator"

set +e
wait "$PID"
code=$?
echo "aws-emulator process exited with $code" >&2
exit "$code"
