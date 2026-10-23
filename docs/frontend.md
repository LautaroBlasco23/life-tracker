# Life Tracker Frontend

Web application for tracking personal activities, finances, spent time, notes and the user's profile.
Developed initially with Vercel V0. Built with Next.js and TypeScript.

![Next.js Version](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## Features

- **Authentication**
  - Secure user registration and login
  - Protected routes with session management (refresh-token rotation)
  - Persistent authentication state

- **Activity Tracking**
  - Create, edit, and delete activities
  - Interactive progress tracking
  - Target-based completion system
  - Time-based categories (Morning, Afternoon, Night)
  - Flexible frequency settings (Daily, Weekly with specific days)
  - Streaks (`GET /activities/streak`)
  - Visual progress indicators

- **Reminders**
  - One-time events shown as cards inside the Activities page (no separate route)
  - Created via the shared activity form by checking "Reminder"
  - Deadline with date picker and optional active window
  - Status badges and countdowns (Overdue / Open now / Upcoming / Completed)
  - Unified create/edit form defaults to a normal activity; the checkbox
    switches it to reminder mode

- **Finance Management**
  - Dashboard + transactions views (tabs under `app/finance/`)
  - Fully wired to the backend via the shared `finance-service`

- **Time Tracking**
  - Active session card (`app/time/`, `use-active-sessions`)
  - Start/stop sessions and browse records

- **Notes**
  - Markdown notes (`components/notes/` incl. `markdown-view`)
  - Note groups with manual reorder (`POST /notes/reorder`)

- **Social & Users**
  - `app/social/` follow/social feed
  - `app/users/` user search and public profiles (`/user/[username]`)

- **User Profile**
  - Profile information management
  - Avatar upload
  - Theme preferences (System/Light/Dark via `ThemeContext`)
  - Account settings

- **Architecture & Quality**
  - Type-safe development with TypeScript
  - Component-driven architecture
  - Reusable UI components with shadcn/ui
  - Form validation with Zod schemas
  - Responsive design
  - i18n (EN/ES) via the shared `LanguageProvider` (`@shared`)
  - Vitest unit tests + Playwright E2E (see [testing.md](./testing.md))

---

## Tech Stack

- **Next.js 14** (App Router, `output: 'export'` static export) - React framework
- **React 18**
- **TypeScript** - Type-safe development
- **Tailwind CSS v4** - Utility-first styling
- **shadcn/ui + Radix UI** - Accessible component primitives
- **React Hook Form + Zod** - Form handling and validation
- **date-fns** - Date utilities
- **Lucide React** - Icon library
- **`@shared/*`** - Business logic, services, types and i18n from `packages/shared` (tsconfig path alias)
- **Husky + lint-staged** - Prettier pre-commit gate

---

## Project Structure

```text
frontend/
├── app/                # Next.js App Router pages (feature folders: components/, modals/, hooks/, views/)
├── components/         # Reusable React components (ui/ = shadcn primitives)
├── contexts/           # React context providers (theme)
├── hooks/              # Shared hooks
├── lib/                # Utility functions
├── e2e/                # Playwright specs + helpers
├── test/               # Vitest setup
├── scripts/            # Prod dependency audit (audit-prod.mjs)
├── nginx-templates/    # nginx config templates for the runtime container
├── inject-env.sh       # Runtime env injection (/env-config.js)
├── Dockerfile          # Static export + nginx runtime image
├── Dockerfile.dev      # Dev container image (hot reload)
├── Dockerfile.export   # Export-stage image
├── out/                # Static export (committed on purpose)
└── package.json
```

> **Note:** there is no `frontend/services/`, `frontend/types/`, or
> `frontend/Makefile`. Business logic lives in `packages/shared`; commands come
> from the root Makefile. The frontend is deliberately outside the npm
> workspaces — run `npm install` inside `frontend/` separately.

---

## Quick Start

### Prerequisites

- Node.js 22+
- npm
- Backend API running (see [backend.md](./backend.md))

### Fastest Path (One Command)

```bash
git clone <your-repo-url>
cd life-tracker
make dev
```

Application runs at `http://localhost:3000` with hot reload (backend air + `next dev`).

> **Note:** This starts the fast lane: databases in Docker, backend and frontend on the host with hot reload. Use `make dev-container` for the full container-mode stack (API container + static export + nginx). See [getting-started.md](./getting-started.md) for the other run modes.

### Standard Setup (More Control)

```bash
# 1. Clone and install dependencies
git clone <your-repo-url>
cd frontend
npm install

# 2. Setup environment (repo root; creates .env from .env.example)
cd .. && make setup && cd frontend

# 3. Start development server
NEXT_PUBLIC_API_URL=http://localhost:8080/api npm run dev
```

### Environment Configuration

The frontend has **no build-time `.env`**. The API URL is injected two ways:

- **Dev:** `make dev` passes `NEXT_PUBLIC_API_URL=http://localhost:8080/api` on the command line.
- **Static export / prod:** runtime injection — `inject-env.sh` writes `window.__ENV__`
  into `/env-config.js` at container start, loaded by `app/layout.tsx` and
  consumed by `packages/shared/src/lib/config.ts`.

### Available Commands

Run `make help` (repo root) to see all available commands.

---

## Development

### Prerequisites

Install dependencies:

```bash
npm install
```

### Running the Application

Start the development server with hot reload:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api npm run dev
```

Or using Make (repo root):

```bash
make dev
```

### Code Quality

Format and check code:

```bash
npm run format   # Prettier (CI gate)
npm run lint     # ESLint
npm run lint:ts  # Type check
npm run type-check
```

> `make code-check` (repo root) is backend-only (gofumpt + golangci-lint).

### Building for Production

```bash
npm run build   # static export -> out/
```

Serving options:

```bash
make frontend-up      # nginx container serving out/ on :3000 (/api -> api:8080)
make deploy-frontend  # rebuild the export and copy it into the running container
```

---

## Docker

| Target | Purpose |
|---|---|
| `make fe-run-dev` | Dev container with hot reload on :3000 (mounts `frontend/`) |
| `make fe-build-dev` | Build the dev image (`Dockerfile.dev`) |
| `make fe-logs-dev` | Follow dev container logs |
| `make fe-shell-dev` | Shell into the dev container |
| `make fe-docker-up` | Prod image (`Dockerfile`) on :3000 — bakes the prod API URL |
| `make fe-docker-down` | Stop/remove the prod-build container |
| `make fe-docker-restart` | down + up |
| `make fe-clean` | Remove containers + images + docker prune |

---

## Tests

- Unit: `npm test` (Vitest, jsdom) — theme context, auth guard, theme toggle, `globals-parity` (palette hex parity with `theme-colors.ts`)
- E2E: `npm run test:e2e` (Playwright) — auth guard, login, notes CRUD, smoke (see [testing.md](./testing.md))
- Coverage: `npm run test:coverage`

---

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Static export to `out/`
- `npm run start` - Start production server (non-export)
- `npm run lint` - Run ESLint
- `npm run lint:ts` / `npm run type-check` - Type check with TypeScript
- `npm run format` - Format code with Prettier
- `npm run test` / `test:watch` / `test:coverage` - Vitest
- `npm run test:e2e` - Playwright E2E
- `npm run prepare` - Install Husky git hooks

---

## License

MIT License - free to use for learning and personal projects.
