# Life Tracker — Screen Time Extension

Chrome extension (Manifest V3) that records visits to configured websites into the life-tracker backend.

## How it works

- `background.js` (service worker) listens to `chrome.tabs.onUpdated`. When a tab finishes loading on a tracked domain, it POSTs a visit to the backend.
- `popup.html` / `popup.js` provide a login form and show today's visit counts per domain.
- Auth token is stored in `chrome.storage.local`.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest — permissions, service worker, popup |
| `background.js` | Detects tab loads and records visits |
| `popup.html` | Login form + daily stats UI |
| `popup.js` | Login, logout, stats fetching |
| `config.js` | Tracked domains + API base URL |

## Configuration

Edit `config.js`:

```js
export const TRACKED_DOMAINS = [
  "instagram.com",
  "twitter.com",
  "x.com",
  "discord.com",
  "reddit.com",
];

export const API_BASE = "http://localhost:8080/api";
```

For production, also update `host_permissions` in `manifest.json` to match the backend domain.

## Backend endpoints used

All screen-time endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/auth/login` | Get JWT (`{ email, password }`) |
| `POST` | `/api/screen-time/visits` | Record a visit (`{ domain, visitedAt }`) |
| `GET`  | `/api/screen-time/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` | Visit count per domain |

## Install (development)

1. Start the life-tracker backend locally on `http://localhost:8080`.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and select this `extension/` directory.
5. Click the extension icon and log in with your life-tracker credentials.
6. Open any tracked site — the visit is recorded immediately.

## Reloading after changes

After editing any file, go to `chrome://extensions` and click the reload icon on the extension card. Then reopen the popup or reload tracked tabs.

## Troubleshooting

- **No visits recorded** — open the service worker console (`chrome://extensions` → *Inspect views: service worker*) and check for fetch errors. Confirm the token exists in `chrome.storage.local`.
- **Login fails** — verify the backend is reachable at `API_BASE` and the host permission in `manifest.json` matches.
- **CORS / network errors** — ensure the backend allows the extension origin and that `host_permissions` covers the API URL.
