#!/usr/bin/env node
/**
 * Production dependency audit gate for the npm workspaces (apps/mobile +
 * packages/shared). Mirrors frontend/scripts/audit-prod.mjs.
 *
 * Why this exists instead of plain `npm audit --omit=dev --audit-level=high`:
 *
 * 1. `--omit=dev` is unreliable at a workspace root (longstanding npm quirk):
 *    jest / metro / expo build tooling chains still show up even though they
 *    are devDependencies of apps/mobile. The gate's stated intent — audit the
 *    production tree — can't be expressed with the flag alone.
 * 2. Several advisories were published against the current Expo SDK / React
 *    Native versions with no fixed release yet. npm's "fix" for those is to
 *    downgrade the Expo SDK (e.g. expo 58 → 44), which is not a real fix.
 *
 * `npm audit` cannot exclude individual findings, so we parse --json and
 * allowlist explicitly. Anything high/critical whose top-level package is not
 * allowlisted fails with exit 1.
 */
import { execSync } from "node:child_process";

/**
 * Allowed high/critical findings, grouped by rationale. Update as patches
 * land — every group here should shrink over time.
 */
const ALLOWED_EXACT = new Set([
  // Runtime RN deps with no fixed release yet (fix: false upstream). DoS in
  // markdown rendering of user-generated note content — accepted risk until
  // react-native-markdown-display ships a markdown-it/linkify-it fix.
  "linkify-it",
  "markdown-it",
  "react-native-markdown-display",
  // Runtime RN deps where the only audit "fix" is an incompatible downgrade
  // of a version pinned by the Expo SDK; patch releases are the path forward.
  "react-native",
  "react-native-reanimated",
  "react-native-worklets",
  "react-native-css-interop",
  "nativewind",
  "expo",
  "expo-router",
  "expo-sharing",
  "expo-splash-screen",
  // zod 3.25.76 ships with Expo 58's @expo/cli (build-time CLI — no on-device
  // runtime path). GHSA-mrhx-c7xc-m3w5 (memory exhaustion validating oversized
  // constrained collections) affects all zod < 4.6.6, and no @expo/cli 58.x
  // accepts zod 4.x yet. Remove once expo bumps @expo/cli's zod range.
  "zod",
]);

/** Dev/build tooling chains (see point 1 above): should be out of scope of
 * a production-tree audit; matched by prefix. */
const ALLOWED_PREFIXES = [
  // Jest toolchain (devDep of apps/mobile).
  "@jest/",
  "jest",
  "expect",
  "@istanbuljs/",
  "babel-jest",
  "babel-plugin-istanbul",
  "create-jest",
  // Metro / RN build tooling.
  "@react-native/",
  "metro",
  "metro-",
  // Expo build-time tooling.
  "@expo/",
  "expo-",
  "xcode",
  "node-forge",
  "@xmldom/",
  "compression",
  "shell-quote",
  "image-size",
  // Tailwind v4 native (build-time) chain.
  "tailwindcss",
  "postcss-nested",
  "postcss-selector-parser",
  "braces",
  "brace-expansion",
  "chokidar",
  "fast-glob",
  "micromatch",
  // Transitives of the above build/runtime tooling.
  "@testing-library/",
  "js-yaml",
  "sprintf-js",
  "argparse",
  "uuid",
  "decode-uri-component",
  "query-string",
];

const isAllowed = (name) =>
  ALLOWED_EXACT.has(name) || ALLOWED_PREFIXES.some((p) => name.startsWith(p));

let stdout;
try {
  // npm audit exits non-zero when it finds vulns, but still prints the JSON.
  stdout = execSync("npm audit --omit=dev --json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
} catch (e) {
  stdout = e.stdout;
}

let report;
try {
  report = JSON.parse(stdout);
} catch {
  console.error("audit-prod: could not parse `npm audit --omit=dev --json` output");
  process.exit(1);
}

const failing = Object.entries(report.vulnerabilities || {}).filter(
  ([name, v]) =>
    (v.severity === "high" || v.severity === "critical") && !isAllowed(name),
);

for (const [name, v] of failing) {
  console.error(`audit-prod: ${name} ${v.severity} (range ${v.range})`);
}

if (failing.length > 0) {
  console.error(`audit-prod: FAIL — ${failing.length} unallowed high/critical advisory group(s)`);
  process.exit(1);
}

const total = Object.keys(report.vulnerabilities || {}).length;
console.log(`audit-prod: PASS — ${total} advisory group(s), all allowed or below high`);
