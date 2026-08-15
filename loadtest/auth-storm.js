// auth-storm.js — authentication endpoint stress.
//
// bcrypt (DefaultCost) runs on every register/login/password call, so this is
// deliberately CPU-heavy for the server. Each VU uses its own pooled account,
// so every login hits a different user (no cache warmup).
//
// Env:
//   LOADTEST_LOGIN_RATE    login req/s (default 100)
//   LOADTEST_REFRESH_RATE  refresh req/s (default 50)
//   LOADTEST_DURATION      run duration (default 1m)
//   LOADTEST_BASE_URL      target (see common.js)

import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL, authHeaders, jsonHeaders, loadUserPool, userForVU } from './common.js';

const users = loadUserPool();

const LOGIN_RATE = Number(__ENV.LOADTEST_LOGIN_RATE || 100);
const REFRESH_RATE = Number(__ENV.LOADTEST_REFRESH_RATE || 50);
const DURATION = __ENV.LOADTEST_DURATION || '1m';

export const options = {
  scenarios: {
    login: {
      executor: 'constant-arrival-rate',
      rate: LOGIN_RATE,
      duration: DURATION,
      preAllocatedVUs: 100,
      maxVUs: 500,
      exec: 'login',
    },
    refresh: {
      executor: 'constant-arrival-rate',
      rate: REFRESH_RATE,
      duration: DURATION,
      preAllocatedVUs: 100,
      maxVUs: 500,
      exec: 'refresh',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
  },
};

export function login() {
  const user = userForVU(users);
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ identifier: user.email, password: user.password }),
    { headers: jsonHeaders() }
  );
  check(res, { 'login 200': (r) => r.status === 200 });
}

export function refresh() {
  const user = userForVU(users);
  const res = http.post(
    `${BASE_URL}/api/auth/refresh`,
    JSON.stringify({ refreshToken: user.refreshToken }),
    { headers: jsonHeaders() }
  );
  check(res, { 'refresh 200': (r) => r.status === 200 });
}

export function authRead() {
  // convenience: authed read against the same user pool (used by other scenarios)
  const user = userForVU(users);
  const res = http.get(`${BASE_URL}/api/users/me`, { headers: authHeaders(user.accessToken) });
  check(res, { 'me 200': (r) => r.status === 200 });
}
