import { DEFAULT_TRACKED_DOMAINS, DEFAULT_API_HOST } from "./config.js";

function buildApiUrl(host) {
  return `http://${host}/api`;
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(["trackedDomains", "apiHost"]);
  if (!existing.trackedDomains) {
    await chrome.storage.local.set({ trackedDomains: DEFAULT_TRACKED_DOMAINS });
  }
  if (!existing.apiHost) {
    await chrome.storage.local.set({ apiHost: DEFAULT_API_HOST });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  let url;
  try {
    url = new URL(tab.url);
  } catch {
    return;
  }

  const { trackedDomains, apiHost, token } = await chrome.storage.local.get([
    "trackedDomains",
    "apiHost",
    "token",
  ]);

  const domains = trackedDomains || DEFAULT_TRACKED_DOMAINS;
  const host = apiHost || DEFAULT_API_HOST;
  const base = buildApiUrl(host);

  const matched = domains.find((d) => url.hostname.endsWith(d));
  if (!matched) return;
  if (!token) return;

  try {
    await fetch(`${base}/screen-time/visits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        domain: matched,
        visitedAt: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("Failed to record visit:", err);
  }
});
