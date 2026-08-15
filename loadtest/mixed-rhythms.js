// mixed-rhythms.js — multiple users at different rhythms.
//
// The realistic traffic pattern: readers poll frequently, writers commit every
// few seconds, finance users are intermittent, and a spike bursts on top.
// Every VU acts as its own pooled user; each scenario sets its own rhythm via
// VU counts + sleeps, so the request mix is genuinely per-user.
//
// Env:
//   LOADTEST_DURATION  base scenario duration (default 2m)
//   LOADTEST_SPIKE_VUS burst size (default 250)
//   LOADTEST_BASE_URL  target (see common.js)

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
  transactionPayload,
  sleepBetween,
  todayISO,
} from './common.js';

const users = loadUserPool();

const DURATION = __ENV.LOADTEST_DURATION || '2m';
const SPIKE_VUS = Number(__ENV.LOADTEST_SPIKE_VUS || 250);
const SUMMARY_QS = `start_date=${todayISO()}&end_date=${todayISO()}`;

export const options = {
  scenarios: {
    // ~1 request every 0.5-1.5s per reader (weighted reads)
    readers: {
      executor: 'ramping-vus',
      exec: 'reader',
      startVUs: 20,
      stages: [
        { duration: '30s', target: 200 },
        { duration: DURATION, target: 200 },
      ],
      gracefulStop: '30s',
    },
    // ~1 request every 4-8s per writer
    writers: {
      executor: 'constant-vus',
      exec: 'writer',
      vus: 30,
      duration: DURATION,
    },
    // ~1 request every 6-10s per finance user
    financers: {
      executor: 'constant-vus',
      exec: 'financer',
      vus: 20,
      duration: DURATION,
    },
    // burst on top of the baseline: 0 -> spike -> 0
    spike: {
      executor: 'ramping-vus',
      exec: 'reader',
      startVUs: 0,
      stages: [
        { duration: '20s', target: SPIKE_VUS },
        { duration: '30s', target: SPIKE_VUS },
        { duration: '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
  },
};

export function reader() {
  const user = userForVU(users);
  const path = Math.random() < 0.4 ? '/api/activities/today' : '/api/activities';
  const res = http.get(`${BASE_URL}${path}`, { headers: authHeaders(user.accessToken) });
  check(res, { 'read 200': (r) => r.status === 200 });
  sleepBetween(0.5, 1.5);
}

export function writer() {
  const user = userForVU(users);
  const headers = authHeaders(user.accessToken);

  const act = http.post(`${BASE_URL}/api/activities`, JSON.stringify(activityPayload()), { headers });
  check(act, { 'create activity 201': (r) => r.status === 201 });

  const activityId = act.json('data.id');
  if (activityId) {
    const rec = http.post(`${BASE_URL}/api/activities/${activityId}/record`, JSON.stringify(recordPayload()), {
      headers,
    });
    check(rec, { 'record activity 201': (r) => r.status === 201 });
  }
  sleepBetween(4, 8);
}

export function financer() {
  const user = userForVU(users);
  const headers = authHeaders(user.accessToken);

  const sum = http.get(`${BASE_URL}/api/finances/summary?${SUMMARY_QS}`, { headers });
  check(sum, { 'summary 200': (r) => r.status === 200 });

  const tx = http.post(`${BASE_URL}/api/finances/transactions`, JSON.stringify(transactionPayload()), {
    headers,
  });
  check(tx, { 'create transaction 201': (r) => r.status === 201 });

  sleepBetween(6, 10);
}
