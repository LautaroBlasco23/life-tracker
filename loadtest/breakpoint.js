// breakpoint.js — ramp until the system breaks.
//
// Steps VUs up past the point where latency or errors collapse, to document the
// real ceiling. Watch the p95/error thresholds in the k6 summary and in
// Prometheus/Grafana during the run.
//
// Env:
//   LOADTEST_MAX_VUS   final VU target (default 1000)
//   LOADTEST_STEP      VUs added per stage (default 200)
//   LOADTEST_STEP_DUR  time per stage (default 1m)
//   LOADTEST_BASE_URL  target (see common.js)

import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL, authHeaders, loadUserPool, userForVU } from './common.js';

const users = loadUserPool();

const MAX_VUS = Number(__ENV.LOADTEST_MAX_VUS || 1000);
const STEP = Number(__ENV.LOADTEST_STEP || 200);
const STEP_DUR = __ENV.LOADTEST_STEP_DUR || '1m';

const stages = [];
for (let vus = STEP; vus <= MAX_VUS; vus += STEP) {
  stages.push({ duration: STEP_DUR, target: vus });
}

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      exec: 'mixed',
      startVUs: 0,
      stages,
      gracefulRampDown: '30s',
    },
  },
  // Defaults; override on the command line with --threshold to find the cliff.
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

// one read + one write per iteration: the realistic ceiling
export function mixed() {
  const user = userForVU(users);
  const headers = authHeaders(user.accessToken);

  const read = http.get(`${BASE_URL}/api/activities/today`, { headers });
  check(read, { 'read 200': (r) => r.status === 200 });

  const write = http.post(
    `${BASE_URL}/api/activities`,
    JSON.stringify({
      title: `Breakpoint ${__ITER}`,
      frequency: 'daily',
      dayTime: 'evening',
      completionAmount: 1,
    }),
    { headers }
  );
  check(write, { 'write 201': (r) => r.status === 201 });
}
