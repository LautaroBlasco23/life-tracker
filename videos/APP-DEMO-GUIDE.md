# App demo video (`app-demo.mp4`)

**Result:** `videos/app-demo.mp4` — 1:42, 1280×720, H.264, ~2.7 MB — embedded
in the root `README.md`. It shows a "real day" with the app:

1. UI login (first-run user "Alex") → skip onboarding → empty day view
2. Create **"Drink a water bottle"** (daily, morning) → complete it
   (green state, streak ×1)
3. Build a **"Healthy day" routine** (Walk / Stretch / Gym) — left pending
4. **Live meditation timer**: Start → ~5 s ticking → Stop → Save
5. **Dev note** "Backend e-commerce app" with markdown, typed live
6. **Sticky notes**: "Improve agents.md in dotfiles" / "Automate daily work"
7. Closing shot back on the activities page: habit done, routine pending

## How it is generated (in one breath)

A **Playwright spec drives a headless Chromium against the dev lane and
records the browser context** (`recordVideo`); a Node script converts the
`.webm` to web-optimised H.264 with ffmpeg. Same recipe as
[`RECORDING-GUIDE.md`](./RECORDING-GUIDE.md) (calendar drag & drop demo) —
the pipeline is committed, not a throwaway script:

| Piece | Path | Role |
|---|---|---|
| The script (scenes) | `frontend/demo/demo.spec.ts` | one continuous take; cursor overlay, typing, scene holds |
| Recording config | `frontend/demo/playwright.demo.config.ts` | `video: on`, 1280×720 (video size == viewport), isolated `outputDir` |
| Render script | `frontend/scripts/render-demo-video.mjs` | newest `.webm` → `demo/output/demo.mp4` + poster; encoder auto-detect (libx264, else libopenh264) |
| npm scripts | `frontend/package.json` | `demo:video:capture`, `demo:video:render`, `demo:video` |
| This folder's script | `videos/generate-app-demo.sh` | boots the dev lane, runs capture + render, copies the result here |

## Quick way: `videos/generate-app-demo.sh`

One command, no Makefile changes, safe to run from any branch checkout:

```bash
bash videos/generate-app-demo.sh
```

It reuses the standard dev lane (databases via compose, `air` API on :8080,
`next dev` on :3000), waits for readiness, records, renders, and copies
`app-demo.mp4` + `app-demo-poster.jpg` into this folder — then stops the
servers it started. Servers you started yourself are left alone.

## Manual way (what the script automates)

1. **Dev lane** (one mode at a time; `make stop` before switching):
   ```bash
   make dev   # air API :8080 · next dev :3000 (NEXT_PUBLIC_API_URL → :8080/api)
   ```
2. **Capture + render** (frontend is outside the npm workspaces — run inside
   `frontend/`; the dev lane needs `PLAYWRIGHT_API_URL` because `next dev`
   does not proxy `/api`):
   ```bash
   cd frontend
   PLAYWRIGHT_API_URL=http://localhost:8080/api npm run demo:video
   ```
3. **Publish into this folder:**
   ```bash
   cp demo/output/demo.mp4 ../videos/app-demo.mp4
   cp demo/output/demo-poster.jpg ../videos/app-demo-poster.jpg
   ```
4. Commit both files. Budget: keep the mp4 **≤ 10 MB** (current ~2.7 MB).

## Embedding on GitHub

A committed mp4 referenced by path does **not** play inline in the rendered
README (GitHub shows a raw-download link instead). GitHub's supported flow
is its own attachment hosting:

1. Open the README on github.com (pencil icon) — or any issue comment box.
2. Drag `videos/app-demo.mp4` into the editor and wait for the upload
   (limit: **10 MB** for repos on free plans; ours is ~2.7 MB).
3. Copy the generated `https://github.com/user-attachments/assets/<id>` URL.
4. Paste the **bare URL on its own line** in the README's Demo section and
   commit. GitHub rewrites it to a signed URL and renders a native player.

Do **not** wrap the URL in a `<video>` tag: GitHub doesn't rewrite the tag's
`src`, and the signed-in CSP blocks it (the bare-URL form plays for
everyone). See also
[community discussion #209976](https://github.com/orgs/community/discussions/209976).

The committed copy in this folder stays the source of truth for
regeneration; the attachment URL is just the README player.

## Regeneration etiquette

- Regenerate **deliberately** — after meaningful UI changes, not per commit
  (each update adds ~3 MB of git history).
- The spec registers a **fresh user per run** (`registerUser`), so runs are
  deterministic and never hit "user already exists".
- Record against an **idle dev lane**: don't edit app files mid-recording
  (hot reload remounts components and ruins the take); editing files under
  `frontend/demo/`, `frontend/scripts/` or `videos/` is safe.
- **Never trust the first take**: sample frames before publishing
  (`ffmpeg -ss <t> -i demo.mp4 -frames:v 1 out.jpg`) — scenes are spaced
  roughly every 10–15 s.

## Gotchas baked into the spec (learned the hard way)

- **No cursor in headless recordings** — the spec injects a synthetic dot
  that follows real `mousemove` events; init-script work is deferred to
  `DOMContentLoaded` (init scripts run before the document has content).
- **The Next.js dev-tools badge is hidden** via injected CSS
  (`nextjs-portal { display: none }`) — it must not appear in a frame.
- **Radix Select commits the wrong option if clicked while the listbox is
  still animating** — the spec holds ~400 ms after opening and asserts the
  committed value before moving on.
- **Clicks that shift the layout must not be retried** — a session card
  appearing above the timer's Start button makes a Playwright retry hit the
  now-cleared form (spurious "Category required" toast). Those buttons use
  a single raw `mouse.down()/up()` (`rawClick`).
- **`/notes` tabs stay mounted once visited** — hidden elements keep
  attribute locators matching; use exact role/placeholder locators there.
- **Timer semantics**: description must be typed *before* Start (Save
  rejects an empty one); durations round up to whole minutes (a 5 s
  session saves as "1 min").
- **The routines modal does not refresh the activities list** on close —
  the closing scene navigates back to `/activities` (a remount) to show
  the pending routine cards.
- The activity form's `SelectValue` renders raw enum values ("morning",
  "anyMoment") rather than translated labels.
