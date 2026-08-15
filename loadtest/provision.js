// provision.js — bulk user provisioning.
//
// Registers LOADTEST_USERS users and emits one JSON line per user to stdout
// (email, username, password, id, accessToken, refreshToken). Capture it with
// k6's --console-output into users.json:
//
//   k6 run --log-format raw --console-output users.json provision.js
//
// Registration runs bcrypt at DefaultCost on the server, so this is slow on
// purpose — it doubles as a register-throughput probe. Use a fresh LOADTEST_PREFIX
// per run to avoid username/email collisions.
//
// Env:
//   LOADTEST_USERS    total users to create (default 100)
//   LOADTEST_PREFIX   username/email prefix, ^[a-z0-9_]+$ (default: u<timestamp>)
//   LOADTEST_VUS      parallel registration workers (default min(20, USERS))
//   LOADTEST_BASE_URL target (see common.js)

import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL, userPayload } from './common.js';

const USERS = Number(__ENV.LOADTEST_USERS || 100);
const PREFIX = __ENV.LOADTEST_PREFIX || `u${Date.now().toString(36)}`;
const VUS = Math.min(Number(__ENV.LOADTEST_VUS || 20), USERS);

let failures = 0;

export const options = {
  scenarios: {
    provision: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: USERS,
      maxDuration: '30m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // __ITER is per-VU (starts at 0 for every VU), so __VU*1e6+__ITER is the only
  // globally unique sequence within a run.
  const payload = userPayload(PREFIX, __VU * 1000000 + __ITER);
  const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  const ok = check(res, {
    'register returns 201': (r) => r.status === 201,
  });
  if (!ok) {
    failures += 1;
    return;
  }

  const tokens = res.json('data.tokens');
  const id = res.json('data.user.id');
  console.log(
    JSON.stringify({
      email: payload.email,
      username: payload.username,
      password: payload.password,
      id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
  );
}

export function teardown() {
  if (failures > 0) {
    console.log(JSON.stringify({ provisionFailures: failures }));
  }
}
