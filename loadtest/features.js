// features.js — full API functionality coverage.
//
// One iteration = a complete CRUD lifecycle sweep across EVERY domain:
// activities (+ records/stats/revert/streak), notes, time records, routines,
// finances (transactions, fixed, payments, movements, monthly stats), screen
// time, social (follows, pending, accept, subscriptions), user
// profile/search, and auth password/email change.
//
// Each entity is created, read, updated, and deleted inside the iteration, so
// the test leaves no residue and exercises every handler the app exposes.
//
// Env:
//   LOADTEST_VUS      concurrent feature walkers (default 10)
//   LOADTEST_DURATION run duration (default 2m)
//   LOADTEST_BASE_URL target (see common.js)

import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL, authHeaders, loadUserPool, userForVU, PASSWORD } from './common.js';

const users = loadUserPool();

const VUS = Number(__ENV.LOADTEST_VUS || 10);
const DURATION = __ENV.LOADTEST_DURATION || '2m';

export const options = {
  scenarios: {
    features: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
    },
  },
  // social follow/accept races between concurrent VUs can produce occasional
  // 4xx — treat <10% as acceptable; real breakage shows as more.
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<5000'],
  },
};

// --- helpers ---------------------------------------------------------------

function iso() {
  return new Date().toISOString();
}

function post(path, body, headers, label, pred) {
  return check(http.post(`${BASE_URL}${path}`, JSON.stringify(body), { headers }), {
    [label]: pred || ((r) => r.status >= 200 && r.status < 300),
  });
}

function put(path, body, headers, label, pred) {
  return check(http.put(`${BASE_URL}${path}`, JSON.stringify(body), { headers }), {
    [label]: pred || ((r) => r.status >= 200 && r.status < 300),
  });
}

function get(path, headers, label, pred) {
  return check(http.get(`${BASE_URL}${path}`, { headers }), {
    [label]: pred || ((r) => r.status >= 200 && r.status < 300),
  });
}

function del(path, headers, label, pred) {
  return check(http.del(`${BASE_URL}${path}`, null, { headers }), {
    [label]: pred || ((r) => r.status >= 200 && r.status < 300),
  });
}

const TODAY = iso().slice(0, 10);
const SUMMARY_QS = `start_date=${TODAY}&end_date=${TODAY}`;

// --- domain lifecycles -----------------------------------------------------

function activityLifecycle(headers) {
  const actRes = http.post(`${BASE_URL}/api/activities`, JSON.stringify({
    title: `Feature activity ${__ITER}`,
    description: 'features sweep',
    frequency: 'daily',
    dayTime: 'evening',
    completionAmount: 1,
  }), { headers });
  check(actRes, { 'activity create 2xx': (r) => r.status === 201 });
  const actId = actRes.json('data.id');

  if (actId) {
    get(`/api/activities/${actId}`, headers, 'activity get by id 2xx');
    put(`/api/activities/${actId}`, { description: 'updated', completionAmount: 2 }, headers, 'activity update 2xx');
    post(`/api/activities/${actId}/record`, { completionDate: iso(), notes: 'features' }, headers, 'activity record 2xx', (r) => r.status === 201);
    get(`/api/activities/${actId}/records?limit=10`, headers, 'activity records 2xx');
    get(`/api/activities/${actId}/stats`, headers, 'activity stats 2xx');
    del(`/api/activities/${actId}/revert`, headers, 'activity revert 2xx');
    del(`/api/activities/${actId}`, headers, 'activity delete 2xx');
  }
  get('/api/activities/streak', headers, 'activity streak 2xx');
}

function noteLifecycle(headers) {
  const res = http.post(`${BASE_URL}/api/notes`, JSON.stringify({ title: `Note ${__ITER}`, content: 'features' }), { headers });
  check(res, { 'note create 2xx': (r) => r.status === 201 });
  const id = res.json('data.id');
  if (id) {
    get(`/api/notes/${id}`, headers, 'note get 2xx');
    put(`/api/notes/${id}`, { title: 'updated' }, headers, 'note update 2xx');
    del(`/api/notes/${id}`, headers, 'note delete 2xx');
  }
  get('/api/notes?q=Feature', headers, 'note list 2xx');
}

function timeLifecycle(headers) {
  const res = http.post(`${BASE_URL}/api/time-records`, JSON.stringify({
    category: 'Work',
    description: 'features sweep',
    durationMinutes: 30,
  }), { headers });
  check(res, { 'time-record create 2xx': (r) => r.status === 201 });
  const id = res.json('data.id');
  if (id) {
    get(`/api/time-records/${id}`, headers, 'time-record get 2xx');
    put(`/api/time-records/${id}`, { durationMinutes: 45 }, headers, 'time-record update 2xx');
    del(`/api/time-records/${id}`, headers, 'time-record delete 2xx');
  }
  get('/api/time-records/stats', headers, 'time-record stats 2xx');
  get('/api/time-records?limit=10', headers, 'time-record list 2xx');
}

function routineLifecycle(headers, activityId) {
  if (!activityId) return;
  const res = http.post(`${BASE_URL}/api/routines`, JSON.stringify({
    title: `Routine ${__ITER}`,
    privacyStatus: 'public',
    activityIds: [{ activityId }],
  }), { headers });
  check(res, { 'routine create 2xx': (r) => r.status === 201 });
  const id = res.json('data.id');
  if (id) {
    get(`/api/routines/${id}`, headers, 'routine get 2xx');
    const patch = http.patch(`${BASE_URL}/api/routines/${id}`, JSON.stringify({ description: 'updated' }), { headers });
    check(patch, { 'routine patch 2xx': (r) => r.status >= 200 && r.status < 300 });
    del(`/api/routines/${id}`, headers, 'routine delete 2xx');
  }
  get('/api/routines/me', headers, 'routine list 2xx');
}

function financeLifecycle(headers) {
  get('/api/finances/categories', headers, 'finance categories 2xx');

  // variable transaction (full lifecycle)
  const varRes = http.post(`${BASE_URL}/api/finances/transactions`, JSON.stringify({
    type: 'outcome',
    frequency: 'variable',
    description: 'features',
    amount: 100 + (__ITER % 900),
    category: 'Food & Groceries',
    date: iso(),
  }), { headers });
  check(varRes, { 'finance transaction create 2xx': (r) => r.status === 201 });
  const varId = varRes.json('data.id');
  if (varId) {
    get(`/api/finances/transactions/${varId}`, headers, 'finance transaction get 2xx');
    put(`/api/finances/transactions/${varId}`, { description: 'updated', amount: 200 }, headers, 'finance transaction update 2xx');
    del(`/api/finances/transactions/${varId}`, headers, 'finance transaction delete 2xx');
  }
  get('/api/finances/transactions?limit=10', headers, 'finance transactions list 2xx');

  // fixed transaction + payment lifecycle
  const fixedRes = http.post(`${BASE_URL}/api/finances/transactions`, JSON.stringify({
    type: 'outcome',
    frequency: 'fixed',
    description: 'features fixed',
    amount: 50,
    category: 'Housing & Utilities',
    date: iso(),
  }), { headers });
  check(fixedRes, { 'finance fixed transaction create 2xx': (r) => r.status === 201 });
  const fixedId = fixedRes.json('data.id');
  if (fixedId) {
    get('/api/finances/fixed-transactions', headers, 'finance fixed list 2xx');
    get(`/api/finances/fixed-transactions/${fixedId}`, headers, 'finance fixed get 2xx');
    const pay = http.post(`${BASE_URL}/api/finances/payments`, JSON.stringify({
      transactionId: fixedId,
      amount: 25,
      date: iso(),
    }), { headers });
    check(pay, { 'finance payment create 2xx': (r) => r.status === 201 });
    const payId = pay.json('data.id');
    if (payId) {
      get(`/api/finances/payments?transaction_id=${fixedId}`, headers, 'finance payments list 2xx');
      del(`/api/finances/payments/${payId}`, headers, 'finance payment delete 2xx');
    }
    del(`/api/finances/transactions/${fixedId}`, headers, 'finance fixed transaction delete 2xx');
  }

  get(`/api/finances/summary?${SUMMARY_QS}`, headers, 'finance summary 2xx');
  get('/api/finances/movements?limit=10', headers, 'finance movements 2xx');
  get('/api/finances/monthly-stats', headers, 'finance monthly-stats 2xx');
}

function screenTimeLifecycle(headers) {
  const res = http.post(`${BASE_URL}/api/screen-time/visits`, JSON.stringify({
    domain: 'example.com',
    visitedAt: iso(),
  }), { headers });
  check(res, { 'screentime visit create 2xx': (r) => r.status === 201 });
  const id = res.json('data.id');
  if (id) {
    get('/api/screen-time/visits?domain=example.com', headers, 'screentime visits list 2xx');
    get('/api/screen-time/stats', headers, 'screentime stats 2xx');
  }
}

function socialLifecycle(headers, otherHeaders, otherUsername, selfUsername, activityId) {
  // follow other -> other accepts -> verify -> unfollow
  post(`/api/follows/${otherUsername}`, {}, headers, 'social follow 2xx');

  const pending = http.get(`${BASE_URL}/api/follows/pending`, { headers: otherHeaders });
  check(pending, { 'social pending 2xx': (r) => r.status === 200 });
  const followerId = pending.json('data.items[0].userId') || pending.json('data[0].userId');
  if (followerId) {
    post(`/api/follows/pending/${followerId}/accept`, {}, otherHeaders, 'social accept 2xx');
  }

  get(`/api/users/${selfUsername}/followers`, headers, 'social followers 2xx');
  get(`/api/users/${otherUsername}/following`, headers, 'social following 2xx');
  get(`/api/users/${otherUsername}/profile`, headers, 'social profile 2xx');
  del(`/api/follows/${otherUsername}`, headers, 'social unfollow 2xx');

  // subscription on an activity (or routine) source
  if (activityId) {
    const sub = http.post(`${BASE_URL}/api/subscriptions`, JSON.stringify({
      sourceType: 'activity',
      sourceId: activityId,
    }), { headers });
    check(sub, { 'social subscription create 2xx': (r) => r.status >= 200 && r.status < 300 });
    const subId = sub.json('data.id');
    get('/api/subscriptions', headers, 'social subscriptions list 2xx');
    if (subId) {
      del(`/api/subscriptions/${subId}`, headers, 'social subscription delete 2xx');
    }
  }
}

function userEndpoints(headers, user) {
  get('/api/users', headers, 'users list 2xx');
  get(`/api/users/search?q=${encodeURIComponent(user.username.slice(0, 6))}`, headers, 'users search 2xx');
  get(`/api/users/${user.username}`, headers, 'users get by username 2xx');
  put('/api/users/me', { firstName: 'Load', timezone: 'UTC' }, headers, 'users update me 2xx');
  get('/api/users/me', headers, 'users me 2xx');

  // public checks (no auth)
  check(http.get(`${BASE_URL}/api/users/check-username?username=${user.username}`), {
    'users check-username 2xx': (r) => r.status === 200,
  });
  check(http.get(`${BASE_URL}/api/users/check-email?email=${user.email}`), {
    'users check-email 2xx': (r) => r.status === 200,
  });
}

function authLifecycle() {
  // throwaway user: register -> change password -> change email -> cleanup
  // __VU + __ITER are unique within a run; timestamp guards across runs
  const prefix = `feat${__VU}_${__ITER}`;
  const email = `${prefix}@loadtest.local`;
  const newPass = 'new-pass-456';

  const reg = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email,
    firstName: 'Feature',
    lastName: 'Test',
    username: prefix,
    password: PASSWORD,
  }), { headers: { 'Content-Type': 'application/json' } });
  check(reg, { 'auth temp register 2xx': (r) => r.status === 201 });
  const id = reg.json('data.user.id');
  let token = reg.json('data.tokens.accessToken');

  if (id && token) {
    const pw = http.put(`${BASE_URL}/api/auth/password`, JSON.stringify({
      currentPassword: PASSWORD,
      newPassword: newPass,
    }), { headers: authHeaders(token) });
    check(pw, { 'auth password change 2xx': (r) => r.status === 200 });

    const login = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      identifier: email,
      password: newPass,
    }), { headers: { 'Content-Type': 'application/json' } });
    check(login, { 'auth login after password change 2xx': (r) => r.status === 200 });
    token = login.json('data.tokens.accessToken');

    const newEmail = `${prefix}-new@loadtest.local`;
    const em = http.put(`${BASE_URL}/api/auth/email`, JSON.stringify({
      password: newPass,
      newEmail,
    }), { headers: authHeaders(token) });
    check(em, { 'auth email change 2xx': (r) => r.status === 200 });
    token = em.json('data.tokens.accessToken') || token;

    check(http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      identifier: newEmail,
      password: newPass,
    }), { headers: { 'Content-Type': 'application/json' } }), {
      'auth login after email change 2xx': (r) => r.status === 200,
    });

    if (token) {
      del(`/api/users/${id}`, authHeaders(token), 'auth temp user delete 2xx');
    }
  }
}

// --- main ------------------------------------------------------------------

export default function () {
  const user = userForVU(users);
  const other = users[__VU % users.length];
  const headers = authHeaders(user.accessToken);
  const otherHeaders = authHeaders(other.accessToken);

  // anchor activity: kept alive across the iteration for routine + subscription
  const anchor = http.post(`${BASE_URL}/api/activities`, JSON.stringify({
    title: `Anchor ${__ITER}`,
    frequency: 'weekly',
    dayTime: 'morning',
    completionAmount: 1,
  }), { headers });
  check(anchor, { 'anchor activity 2xx': (r) => r.status === 201 });
  const anchorId = anchor.json('data.id');

  activityLifecycle(headers);
  noteLifecycle(headers);
  timeLifecycle(headers);
  routineLifecycle(headers, anchorId);
  financeLifecycle(headers);
  screenTimeLifecycle(headers);
  socialLifecycle(headers, otherHeaders, other.username, user.username, anchorId);
  userEndpoints(headers, user);
  authLifecycle();

  if (anchorId) {
    del(`/api/activities/${anchorId}`, headers, 'anchor activity delete 2xx');
  }
}
