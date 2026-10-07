/**
 * Pure, chrome-free helpers shared by background.js and (optionally) popup.
 * Kept dependency-free so they are unit-testable in Node.
 */

export function buildApiUrl(host) {
  // Strip any scheme the user may have typed, then re-add the right one:
  // tokens travel in the Authorization header, so anything reachable over the
  // network must be https://. Plain http is allowed only for localhost dev.
  const clean = String(host).replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/+$/, "");
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(clean);
  return `${isLocal ? "http" : "https"}://${clean}/api`;
}

/**
 * Boundary-aware domain match: `host === d || host.endsWith('.' + d)`.
 * Replaces the old `host.endsWith(d)` which had false positives
 * (e.g. "notsocial.com" matched "social.com").
 */
export function matchDomain(hostname, trackedDomains) {
  const host = hostname.toLowerCase();
  return trackedDomains.find(
    (d) => d && (host === d || host.endsWith(`.${d}`))
  );
}

export function isTrackedHost(hostname, trackedDomains) {
  return matchDomain(hostname, trackedDomains) !== undefined;
}

/**
 * Normalizes user-entered domain input (popup "add domain" field behavior):
 * trims, lowercases, strips scheme, leading www., and trailing path.
 * Extracted as-is from popup.js — it stays DOM-free.
 */
export function normalizeDomainInput(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}
