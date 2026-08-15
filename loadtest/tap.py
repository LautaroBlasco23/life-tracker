#!/usr/bin/env python3
"""tap.py — live API response watcher for load tests.

Prints one line per request: time | HTTP status | latency ms | truncated body.
Uses a token from the k6 user pool (users.json) so requests are authenticated.

Usage:
    python3 tap.py [--base-url http://localhost:8080] [--path /api/activities/today]
                   [--interval 1] [--users-file users.json]

Stdlib only (urllib); Ctrl-C to stop.
"""

import argparse
import json
import sys
import time
import urllib.request
import urllib.error


def load_pool(path):
    with open(path) as f:
        users = [json.loads(line) for line in f if line.strip()]
    if not users:
        sys.exit(f"user pool {path} is empty — run `make provision` first")
    return users


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base-url", default="http://localhost:8080")
    ap.add_argument("--path", default="/api/activities/today")
    ap.add_argument("--interval", type=float, default=1.0)
    ap.add_argument("--users-file", default="users.json")
    args = ap.parse_args()

    users = load_pool(args.users_file)
    url = f"{args.base_url.rstrip('/')}{args.path}"
    print(f"tapping {url} every {args.interval:g}s (Ctrl-C to stop)\n", flush=True)

    i = 0
    while True:
        user = users[i % len(users)]
        i += 1
        req = urllib.request.Request(
            url, headers={"Authorization": f"Bearer {user['accessToken']}"}
        )
        start = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                status = resp.status
                body = resp.read(160).decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            status = e.code
            body = e.read(160).decode("utf-8", "replace")
        except Exception as e:  # network errors
            status = "ERR"
            body = str(e)[:160]
        latency_ms = (time.monotonic() - start) * 1000
        body = " ".join(body.split())
        print(f"{time.strftime('%H:%M:%S')} | {status} | {latency_ms:7.1f} ms | {body[:120]}", flush=True)
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
