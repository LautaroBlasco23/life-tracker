# AGENTS.md — Life Tracker

Monorepo for a personal life-tracking app: web frontend, Android (Expo) mobile
app, backend API, and shared packages.

## Repository layout

- `frontend/` — Next.js 15 web app (Tailwind v4 + shadcn/ui)
- `apps/mobile/` — Expo / React Native Android app (NativeWind)
- `backend/` — API
- `packages/shared/` — code shared by web + mobile (types, services, i18n, theme)
- `docs/` — per-area documentation (`frontend.md`, `mobile.md`, `backend.md`, …)

## Before starting

- **UI / styling / component work:** read [`styles.md`](styles.md) first. It defines
  the cross-platform token source of truth (`packages/shared/src/lib/theme-colors.ts`),
  reuse rules (shadcn on web, `apps/mobile/components/ui` on mobile), and the
  baseline visual look.
- Feature-specific context: [`docs/frontend.md`](docs/frontend.md),
  [`docs/mobile.md`](docs/mobile.md), [`docs/backend.md`](docs/backend.md).

## Ground rules

- Reuse existing components and utilities before creating new ones.
- Keep business logic in `packages/shared`; platform code stays in its app.
- Match existing conventions per app; don't refactor unrelated code.
