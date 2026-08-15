// smoke.js — end-to-end toolchain check.
//
// One pass over the whole auth + data lifecycle with a single fresh user:
// health, register, login, refresh, authed reads and writes. Run this before
// any scale tests; it fails fast if the stack is misconfigured.

import { check } from 'k6';
import http from 'k6/http';
import {
  BASE_URL,
  authHeaders,
  jsonHeaders,
  activityPayload,
  notePayload,
  userPayload,
} from './common.js';

const PREFIX = __ENV.LOADTEST_PREFIX || `smoke${Date.now().toString(36)}`;

export const options = {
  scenarios: {
    smoke: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  // 1. health (public)
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  // 2. register a fresh user
  const regUser = userPayload(PREFIX, 0);
  const reg = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(regUser), {
    headers: jsonHeaders(),
  });
  check(reg, { 'register 201': (r) => r.status === 201 });

  const accessToken = reg.json('data.tokens.accessToken');
  const refreshToken = reg.json('data.tokens.refreshToken');
  check(accessToken, { 'register issued access token': (t) => typeof t === 'string' && t.length > 20 });
  check(refreshToken, { 'register issued refresh token': (t) => typeof t === 'string' && t.length > 20 });

  // 3. login
  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ identifier: regUser.username, password: regUser.password }),
    { headers: jsonHeaders() }
  );
  check(login, { 'login 200': (r) => r.status === 200 });

  // 4. refresh
  const refresh = http.post(
    `${BASE_URL}/api/auth/refresh`,
    JSON.stringify({ refreshToken }),
    { headers: jsonHeaders() }
  );
  check(refresh, { 'refresh 200': (r) => r.status === 200 });

  // 5. authed reads
  const me = http.get(`${BASE_URL}/api/users/me`, { headers: authHeaders(accessToken) });
  check(me, { 'me 200': (r) => r.status === 200 });

  const today = http.get(`${BASE_URL}/api/activities/today`, { headers: authHeaders(accessToken) });
  check(today, { 'today 200': (r) => r.status === 200 });

  // 6. authed writes
  const act = http.post(`${BASE_URL}/api/activities`, JSON.stringify(activityPayload()), {
    headers: authHeaders(accessToken),
  });
  check(act, { 'create activity 201': (r) => r.status === 201 });

  const note = http.post(`${BASE_URL}/api/notes`, JSON.stringify(notePayload()), {
    headers: authHeaders(accessToken),
  });
  check(note, { 'create note 201': (r) => r.status === 201 });
}
