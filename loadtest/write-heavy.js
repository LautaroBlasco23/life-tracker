// write-heavy.js — sustained write throughput.
//
// Creates activities (with a record), notes, transactions, and meals. Mongo is
// the write path for records/transactions/meals; Postgres for activities/notes.
// Exposes the Mongo MaxConnecting(2) throttle and Postgres 10-conn pool cap.
//
// Env:
//   LOADTEST_RATE     req/s (default 100)
//   LOADTEST_DURATION run duration (default 1m)
//   LOADTEST_BASE_URL target (see common.js)

import { check } from 'k6';
import http from 'k6/http';
import {
  BASE_URL,
  authHeaders,
  loadUserPool,
  userForVU,
  activityPayload,
  recordPayload,
  notePayload,
  transactionPayload,
  mealPayload,
} from './common.js';

const users = loadUserPool();

const RATE = Number(__ENV.LOADTEST_RATE || 100);
const DURATION = __ENV.LOADTEST_DURATION || '1m';

export const options = {
  scenarios: {
    writes: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      duration: DURATION,
      preAllocatedVUs: 100,
      maxVUs: 600,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
  },
};

// One iteration = activity + record (chained), note, transaction, meal.
// Fails soft: a failed activity does not abort the remaining writes.
export default function () {
  const user = userForVU(users);
  const headers = authHeaders(user.accessToken);

  const act = http.post(`${BASE_URL}/api/activities`, JSON.stringify(activityPayload()), {
    headers,
  });
  check(act, { 'create activity 201': (r) => r.status === 201 });

  const activityId = act.json('data.id');
  if (activityId) {
    const rec = http.post(`${BASE_URL}/api/activities/${activityId}/record`, JSON.stringify(recordPayload()), {
      headers,
    });
    check(rec, { 'record activity 201': (r) => r.status === 201 });
  }

  const note = http.post(`${BASE_URL}/api/notes`, JSON.stringify(notePayload()), { headers });
  check(note, { 'create note 201': (r) => r.status === 201 });

  const tx = http.post(`${BASE_URL}/api/finances/transactions`, JSON.stringify(transactionPayload()), {
    headers,
  });
  check(tx, { 'create transaction 201': (r) => r.status === 201 });

  const meal = http.post(`${BASE_URL}/api/health/nutrition/meals`, JSON.stringify(mealPayload()), {
    headers,
  });
  check(meal, { 'create meal 201': (r) => r.status === 201 });
}
