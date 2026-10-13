#!/usr/bin/env node
/**
 * Production dependency audit gate.
 *
 * `npm audit` cannot exclude individual advisories, so this runs it with
 * --json and filters an explicit allowlist. Any high/critical advisory
 * outside the allowlist fails with exit 1.
 */
import { execSync } from 'node:child_process';

/**
 * Next.js advisories affecting next@^14 (range 9.5.0 - 15.5.23).
 *
 * All of them require a running Next.js server (server actions, middleware,
 * rewrites, image-optimization API, edge runtime, RSC cache). Production is
 * a static export (`output: 'export'`) served by nginx — none of these code
 * paths exist in the deployed artifact; only `next dev` (localhost) touches
 * them. Remove this allowlist once the next@16 upgrade lands.
 */
const NEXT_SERVER_ADVISORIES = [
  'GHSA-9g9p-9gw9-jx7f',
  'GHSA-h25m-26qc-wcjf',
  'GHSA-ggv3-7p47-pfv8',
  'GHSA-3x4c-7xq6-9pq8',
  'GHSA-q4gf-8mx6-v5v3',
  'GHSA-8h8q-6873-q5fj',
  'GHSA-3g8h-86w9-wvmq',
  'GHSA-ffhc-5mcf-pf4q',
  'GHSA-vfv6-92ff-j949',
  'GHSA-gx5p-jg67-6x7h',
  'GHSA-h64f-5h5j-jqjh',
  'GHSA-c4j6-fc7j-m34r',
  'GHSA-wfc6-r584-vfw7',
  'GHSA-36qx-fr4f-26g5',
  'GHSA-m99w-x7hq-7vfj',
  'GHSA-89xv-2m56-2m9x',
  'GHSA-68g3-v927-f742',
  'GHSA-4633-3j49-mh5q',
  'GHSA-4c39-4ccg-62r3',
  'GHSA-p9j2-gv94-2wf4',
  'GHSA-955p-x3mx-jcvp',
  'GHSA-p293-qw3h-jr36',
  'GHSA-2xp9-vwfh-vxw4',
];
const ALLOWED = new Set(NEXT_SERVER_ADVISORIES);

// `via` entries are advisory objects whose GHSA id lives in `url` (there is
// no `id` field), or strings referencing another package in the chain.
const ghsaId = (via) =>
  typeof via === 'string' ? null : ((via.url ?? '').split('/').pop() ?? '');

let stdout;
try {
  // npm audit exits non-zero when it finds vulns, but still prints the JSON.
  stdout = execSync('npm audit --omit=dev --json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
} catch (e) {
  stdout = e.stdout;
}

let report;
try {
  report = JSON.parse(stdout);
} catch {
  console.error(
    'audit-prod: could not parse `npm audit --omit=dev --json` output'
  );
  process.exit(1);
}

const failing = Object.entries(report.vulnerabilities || {}).filter(
  ([name, v]) =>
    (v.severity === 'high' || v.severity === 'critical') &&
    !v.via.every((x) => ALLOWED.has(ghsaId(x)))
);

for (const [name, v] of failing) {
  console.error(`audit-prod: ${name} ${v.severity} (range ${v.range})`);
}

if (failing.length > 0) {
  console.error(
    `audit-prod: FAIL — ${failing.length} unallowed high/critical advisory group(s)`
  );
  process.exit(1);
}

const total = Object.keys(report.vulnerabilities || {}).length;
console.log(
  `audit-prod: PASS — ${total} advisory group(s), all allowed or below high`
);
