// soak.js — sustained load over a long window.
//
// Constant arrival rate for LOADTEST_SOAK_DURATION to catch pool exhaustion,
// slow leaks, and degraded GC behavior. Mix of reads and writes.
//
// Note: access tokens default to 24h expiry, so a soak shorter than that never
// needs a refresh; for longer runs add a refresh step or regenerate the pool.
//
// Env:
//   LOADTEST_SOAK_RATE      req/s (default 200)
//   LOADTEST_SOAK_DURATION  run duration (default 30m)
//   LOADTEST_BASE_URL       target (see common.js)

import { check } from 'k6';
import http from 'k6/http';
import { sleep } from 'k6';
import {
  BASE_URL,
  authHeaders,
  loadUserPool,
  userForVU,
  activityPayload,
  recordPayload,
} from './common.js';

const users = loadUserPool();

const RATE = Number(__ENV.LOADTEST_SOAK_RATE || 200);
const DURATION = __ENV.LOADTEST_SOAK_DURATION || '30m';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      duration: DURATION,
      preAllocatedVUs: 200,
      maxVUs: 800,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const user = userForVU(users);
  const headers = authHeaders(user.accessToken);

  if (Math.random() < 0.7) {
    // read-heavy mix
    const path = Math.random() < 0.5 ? '/api/activities/today' : '/api/users/me';
    const res = http.get(`${BASE_URL}${path}`, { headers });
    check(res, { 'read 200': (r) => r.status === 200 });
  } else {
    const act = http.post(`${BASE_URL}/api/activities`, JSON.stringify(activityPayload()), { headers });
    check(act, { 'write 201': (r) => r.status === 201 });
    const activityId = act.json('data.id');
    if (activityId) {
      const rec = http.post(`${BASE_URL}/api/activities/${activityId}/record`, JSON.stringify(recordPayload()), {
        headers,
      });
      check(rec, { 'record 201': (r) => r.status === 201 });
    }
  }
  sleep(Math.random() * 0.3);
}
