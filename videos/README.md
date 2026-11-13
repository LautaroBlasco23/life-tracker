# videos/ — demo recordings & guides

Scriptable, reproducible demo videos of the app, recorded by driving a
headless Chromium with Playwright and encoding with ffmpeg — no screen
recorder, no manual clicking. Regenerate after meaningful UI changes.

| File | What it is |
|---|---|
| `app-demo.mp4` + `app-demo-poster.jpg` | **The app demo** embedded in the root `README.md` — a "real day" with the app (habit completion, routines, live timer, notes, sticky notes) |
| `APP-DEMO-GUIDE.md` | How `app-demo.mp4` is generated: the committed pipeline (`frontend/demo/`), one-command regeneration, manual steps, scene list, gotchas |
| `generate-app-demo.sh` | One-command regeneration of the app demo (dev lane + capture + render + publish into this folder) |
| `RECORDING-GUIDE.md` | Reference guide from the calendar drag & drop demo (that video is kept outside the repo) — same recipe, plus dnd-kit-specific gotchas |

Start here: [`APP-DEMO-GUIDE.md`](./APP-DEMO-GUIDE.md).
