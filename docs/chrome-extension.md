# Life Tracker — Screen Time Extension

Chrome extension (Manifest V3) that records visits to configured websites into the life-tracker backend.

## How it works

- `background.js` (service worker) listens to `chrome.tabs.onUpdated`. When a tab finishes loading on a tracked domain, it POSTs a visit to the backend.
- `popup.html` / `popup.js` provide a login form and three tabs: **stats** (today's visit counts per domain), **sites** (add/remove tracked domains, plus a "+ Track" banner for the current tab) and **settings** (editable API host, logout).
- Auth token is stored in `chrome.storage.local`, alongside the tracked domains and API host (all persisted via `chrome.storage.local`; `config.js` only holds defaults).
- Domains are matched with https enforced for non-local hosts (`lib/tracker.js`).

## Files

All file paths below are relative to [`chrome-extension/`](../chrome-extension/).

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest — permissions, service worker, popup, `optional_host_permissions: ["https://*/*"]` |
| `background.js` | Detects tab loads and records visits |
| `popup.html` | Login + tabs (stats / sites / settings) UI |
| `popup.js` | Login, logout, stats fetching, domain management, API host setting |
| `config.js` | `DEFAULT_TRACKED_DOMAINS`, `DEFAULT_API_HOST`, gateway constants |
| `lib/tracker.js` | Shared pure helpers: `buildApiUrl`, `matchDomain`, `normalizeDomainInput` |
| `lib/tracker.test.js` | Vitest unit tests for the helpers |
| `manifest.test.js` | Manifest sanity tests |
| `vitest.config.js` / `package.json` | Test runner (`npm test`) |

## Configuration

Domains and the API host are **runtime-managed from the popup** (stored in
`chrome.storage.local`). `config.js` only provides the defaults:

```js
export const DEFAULT_TRACKED_DOMAINS = [
  "instagram.com",
  "twitter.com",
  "x.com",
  "discord.com",
  "reddit.com",
];

export const DEFAULT_API_HOST = "localhost:8080";
```

For production backends the popup **requests the `https://*/*` origin
permission at runtime** (optional host permission) when you set a non-local
API host — no `manifest.json` edit needed.

## Backend endpoints used

All screen-time endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/auth/login` | Get JWT (`{ identifier, password }` — email **or** username) |
| `POST` | `/api/screen-time/visits` | Record a visit (`{ domain, visitedAt }`) |
| `GET`  | `/api/screen-time/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` | Visit count per domain |
| `GET`  | `/api/screen-time/visits?domain=&limit=&from=&to=` | Visit list with filters |

## Install (development)

1. Start the life-tracker backend locally on `http://localhost:8080`.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and select the `chrome-extension/` directory.
5. Click the extension icon and log in with your life-tracker credentials.
6. Open any tracked site — the visit is recorded immediately.

## Tests

```bash
cd chrome-extension
npm install
npm test
```

Vitest suite covering `lib/tracker.js` helpers and manifest sanity.

## Reloading after changes

After editing any file, go to `chrome://extensions` and click the reload icon on the extension card. Then reopen the popup or reload tracked tabs.

## Troubleshooting

- **No visits recorded** — open the service worker console (`chrome://extensions` → *Inspect views: service worker*) and check for fetch errors. Confirm the token exists in `chrome.storage.local`.
- **Login fails** — verify the API host in the popup's Settings tab points at the running backend.
- **Network errors on a production host** — the popup requests the origin permission on first use; accept the browser prompt (check the extension's permission icon in the address bar).
