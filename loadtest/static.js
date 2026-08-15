// static.js — frontend serving lane (nginx static export).
//
// Hammers the nginx-served Next.js static export. No auth, no user pool.
// Point LOADTEST_BASE_URL at the frontend (default http://localhost:3000).
//
// Env:
//   LOADTEST_RATE     arrival rate, req/s (default 500)
//   LOADTEST_DURATION run duration (default 1m)
//   LOADTEST_BASE_URL target, e.g. http://localhost:3000

import http from 'k6/http';
import { BASE_URL } from './common.js';

const RATE = Number(__ENV.LOADTEST_RATE || 500);
const DURATION = __ENV.LOADTEST_DURATION || '1m';

export const options = {
  scenarios: {
    static_assets: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      duration: DURATION,
      preAllocatedVUs: 100,
      maxVUs: 500,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

const PATHS = ['/', '/index.html', '/404.html'];

export default function () {
  http.get(`${BASE_URL}${PATHS[__ITER % PATHS.length]}`);
}
