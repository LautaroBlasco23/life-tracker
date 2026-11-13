# Recording a feature demo video (Playwright + headless Chromium)

How the demo video for the calendar weekdays-DnD PR was recorded, so it can
be reproduced for future PRs.

> Note: this guide documents `calendar-weekdays-dnd-demo.mp4`, which is kept
> outside the repository. For the **app demo video committed in this folder**
> (`app-demo.mp4`), see [`APP-DEMO-GUIDE.md`](./APP-DEMO-GUIDE.md) — same
> Playwright + ffmpeg recipe, driven by the committed pipeline.

**Result:** `videos/calendar-weekdays-dnd-demo.mp4` (~17 s, 1280×720, ~450 KB)
— drag & drop it into the GitHub PR description (limit: 10 MB per attachment).

## Why this approach

Screen-capture of the desktop (ffmpeg x11grab / GNOME recorder) is not
scriptable from a terminal: it needs someone physically clicking through the
UI. Instead we **drive a headless Chromium with Playwright and record the
browser context** — deterministic, repeatable, no GUI interaction needed.

## Prerequisites

- The repo worktree with the feature checked out.
- `frontend/` node_modules installed (`npm install` inside `frontend/` —
  it is deliberately outside the npm workspaces).
- ffmpeg (available on this machine; note **no libx264** — use `-c:v libopenh264`).
- Credentials/env: the API needs DB connection etc. Sourced from the main
  worktree's `.env` (sourced, never read/printed).

## The setup (dev lane on alternate ports)

The docker stack that usually runs (`lifetracker-web` on :3000) serves an
older static export built from `main` — it will NOT show your feature. Run
this worktree's stack instead, on free ports, without touching the containers:

1. **API (Go) on :8081**

   ```bash
   cd <worktree>/backend && go build -o /tmp/opencode/wt-api ./cmd/main
   set -a; . /home/lautaroblasco23/projects/life-tracker/main/.env; set +a
   export DB_HOST=localhost PORT=8081 CORS_ALLOWED_ORIGINS=http://localhost:3001
   /tmp/opencode/wt-api > /tmp/opencode/wt-api.log 2>&1 &
   ```

   - Adding a **migration runs automatically on start** — versioned, additive
     (e.g. `ALTER TABLE ... ADD COLUMN`). The already-running container API
     ignores the new column, so there is no breakage.
   - `CORS_ALLOWED_ORIGINS` matters: the browser calls `http://localhost:8081`
     from origin `localhost:3001`.

2. **Frontend (Next dev) on :3001**

   ```bash
   cd <worktree>/frontend
   NEXT_PUBLIC_API_URL=http://localhost:8081/api npx next dev -p 3001 &
   ```

   ⚠️ The URL **must include the `/api` prefix**. `NEXT_PUBLIC_API_URL` is
   inlined into the client bundle **at dev-server start** — restart the
   server after changing it. Sanity check that the app actually reaches the
   API: open `/time` and look for 200s on
   `:8081/api/calendar-events` (a `404` with empty `path` in the API log
   means the prefix was missing).

3. **Record** — the script drives everything: `node .demo-video.mjs`
   (or `node .demo-video.mjs --no-record` for a selector dry-run).

## The script (`frontend/.demo-video.mjs`)

Kept in the worktree (untracked dotfile). Flow:

1. `POST /api/auth/register` — creates a throwaway user per run (names must
   be ≥ 3 chars username, ≥ 2 chars names, password ≥ 8 — DTO validation is
   stricter than the old e2e comment suggests).
2. Seeds `accessToken` / `refreshToken` / `currentUser` into `localStorage`
   via `addInitScript` **before any app code runs** (same mechanism as
   `frontend/e2e/helpers.ts`).
3. Drives the UI against stable hooks — prefer attribute/role hooks over
   text/class:
   - Radix `<Select>`: click `#event-repeat`, then
     `getByRole('option', { name: 'Weekly' })`.
   - Weekday checkboxes: `#event-repeat-day-<day>` (button, click works;
     `page.check()` does **not** — it is not a real `<input>`).
   - dnd-kit draggables: `button[aria-roledescription="draggable"]`;
     day columns carry `data-day` in the week grid.
4. Free-form submit: since the tall weekday grid pushes the modal's Save
   button below the fold, submit with `Enter` on the title field
   (`page.press('#event-title', 'Enter')`) — avoids viewport/scroll flake.
5. Records with Playwright's built-in `recordVideo`
   (`chromium.launch()` context option; one webm per context), then the webm
   is converted to H.264 mp4:

   ```bash
   ffmpeg -i page-*.webm -c:v libopenh264 -pix_fmt yuv420p \
          -an -movflags +faststart calendar-weekdays-dnd-demo.mp4
   ```

   (`-an` strips audio; `faststart` helps inline playback.)

## Gotchas learned the hard way

- **Scroll state breaks dnd-kit drop math.** Playwright scrolls elements
  into view (e.g. during the modal phase) and leaves the window scrolled.
  The drag then computed the drop time from a mismatched column rect (an
  event dropped on 9 AM landed at midnight). Fix in the script: after the
  modal closes, `window.scrollTo(0,0)` + zero every `.overflow-y-auto`,
  **then `scrollIntoViewIfNeeded()` on the source block**, then re-measure
  all bounding boxes and drag **purely horizontally** (same row ⇒ same time
  slot).
- **Never trust a first recording.** Always do a `--no-record` dry-run,
  verify side effects (PUT response body / API events dump printed after the
  drop), inspect sample frames (`ffmpeg -vf "select=eq(n\,N)"`) before
  calling it done.
- **dnd-kit specifics**: PointerSensor has a 6 px activation distance —
  first small move after `mouse.down()`, then slow stepwise moves, pause
  before `mouse.up()`. The app also guards against a click firing after a
  drag (do not click the block after releasing).
- **Port collisions**: the usual stack lives on :3000/:8080; we use
  :3001/:8081. Stopping is `pkill -f "[w]t-api"` and
  `pkill -f "[n]ext dev -p 3001"` (the `[x]` trick stops pkill matching
  its own command line).
- **`next dev` side effects**: it rewrites `tsconfig.json`, bumps/pins
  types in `package.json`, regenerates `package-lock.json` and Coron
  creates `frontend/AGENTS.md`. Revert tracked files afterward
  (`git checkout -- frontend/...`) so the PR diff stays clean; keep only
  the demo script as an untracked file.
- **Keep the video small**: ≤ 10 MB for GitHub. Short (~17 s), 1280×720,
  silent H.264 — mine ended up at ~450 KB. Trim pauses if it grows.
- **Do not read `.env` contents**; source it into the process env only.

## Reusable checklist for the next PR

1. Build API from the worktree → run on :8081 (env via `set -a; . ../main/.env`).
2. `next dev -p 3001` with `NEXT_PUBLIC_API_URL=http://localhost:8081/api`.
3. Dry-run `--no-record`; fix selectors; confirm via API/PUT logging.
4. Record → verify with frame samples → encode to mp4 (`libopenh264`).
5. Clean up: kill servers, revert next-dev-modified files, keep script + mp4.
