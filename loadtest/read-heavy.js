// read-heavy.js — sustained read throughput.
//
// Constant arrival rate against the read-mostly endpoints. Exercises the
// Postgres pool (capped at 10 open conns) and Mongo reads. Each VU acts as its
// own pooled user.
//
// Env:
//   LOADTEST_RATE     req/s (default 300)
//   LOADTEST_DURATION run duration (default 1m)
//   LOADTEST_BASE_URL target (see common.js)

import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL, authHeaders, loadUserPool, userForVU, todayISO } from './common.js';

const users = loadUserPool();

const RATE = Number(__ENV.LOADTEST_RATE || 300);
const DURATION = __ENV.LOADTEST_DURATION || '1m';

// finance/nutrition summaries require start_date & end_date
const SUMMARY_QS = `start_date=${todayISO()}&end_date=${todayISO()}`;

export const options = {
  scenarios: {
    reads: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      duration: DURATION,
      preAllocatedVUs: 200,
      maxVUs: 800,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
  },
};

// Weighted endpoint mix: (endpoint, weight)
const ENDPOINTS = [
  ['/api/activities', 3],
  ['/api/activities/today', 2],
  ['/api/users/me', 2],
  ['/api/notes', 1],
  [`/api/finances/summary?${SUMMARY_QS}`, 1],
  [`/api/health/nutrition/summary?${SUMMARY_QS}`, 1],
];

export default function () {
  const user = userForVU(users);

  let total = 0;
  for (const [, w] of ENDPOINTS) total += w;
  let pick = Math.random() * total;
  let path = ENDPOINTS[0][0];
  for (const [p, w] of ENDPOINTS) {
    pick -= w;
    if (pick <= 0) {
      path = p;
      break;
    }
  }

  const res = http.get(`${BASE_URL}${path}`, { headers: authHeaders(user.accessToken) });
  check(res, { 'read 200': (r) => r.status === 200 });
}
