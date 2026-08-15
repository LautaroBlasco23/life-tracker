// cleanup.js — delete every user in the pool.
//
// Each pooled user deletes its own account with its own token
// (DELETE /api/users/:id). Deterministic per-VU ownership: VU n deletes users
// n-1, n-1+VUS, n-1+2*VUS, ... so every pool user is deleted exactly once.
//
// Env:
//   LOADTEST_USERS_FILE user pool to clean (default users.json)
//   LOADTEST_BASE_URL   target (see common.js)

import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL, authHeaders, loadUserPool } from './common.js';

const users = loadUserPool();

const VUS = Math.min(50, users.length);
const ITERATIONS = Math.ceil(users.length / VUS);

export const options = {
  scenarios: {
    cleanup: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: ITERATIONS,
      maxDuration: '30m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // per-vu-iterations guarantees __ITER = 0..ITERATIONS-1 for this VU
  const idx = (__VU - 1) + __ITER * VUS;
  if (idx >= users.length) {
    return; // uneven distribution tail — no user to delete
  }
  const user = users[idx];
  const res = http.del(`${BASE_URL}/api/users/${user.id}`, null, {
    headers: authHeaders(user.accessToken),
  });

  check(res, {
    'delete user returns 200': (r) => r.status === 200,
  });
}
