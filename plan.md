# Life Tracker — Mobile (Android) Migration Plan

Goal: an Android app (iOS later) as similar to the web app as possible, sharing code with it.

## Approach

Extract the web frontend's platform-agnostic TypeScript layer into a shared package consumed by both the web app and a new Expo React Native app. UI is rebuilt per platform (Radix/DOM components are not reusable), but services, types, DTOs, i18n, and styling conventions are shared.

Stack: **Expo SDK 57 (React Native 0.86, React 19) + expo-router + NativeWind (Tailwind)**.

## Repo layout

```
life-tracker/
  frontend/                # Next.js 14 web app (kept in place — see decisions)
  packages/shared/src/     # shared business layer (services, types, dtos, i18n, contexts, config)
  apps/mobile/             # Expo React Native app (Android-first)
  package.json             # npm workspaces: ["apps/mobile", "packages/shared"] (frontend NOT a workspace)
```

`packages/shared/src`:
- `services/` — auth, activity, routine, time, note, user, finance, health, social services (all REST + JWT)
- `types/`, `dtos/`, `utils/translateEnums.ts`
- `contexts/language-context.tsx` — i18n provider + `useTranslations` (en/es JSON in `messages/`)
- `lib/config.ts` — API URL: web uses `window.__ENV__`; native uses `setApiUrl()` override
- `lib/storage.ts` — storage adapter: web=localStorage, native must call `setStorageAdapter()` at startup (before any service import)
- `lib/theme-colors.ts` — light/dark color tokens (pure data)
- `index.ts` — barrel (dtos excluded: dead code, name-collides with types)

## DONE

### Phase 0 — monorepo restructure (web refactor, zero behavior change) ✅ verified
- Moved 27 files from `frontend/` to `packages/shared/src/` via `git mv` (history preserved).
- Rewrote shared internal imports to relative paths; web imports now use `@shared/*` alias.
- Added platform adapters: `storage.ts` + `setStorageAdapter()`, `setApiUrl()` in config.
- Refactored `auth-service.ts` + `language-context.tsx` off `localStorage`/`window` guards → storage adapter (native persistence now possible).
- Updated `frontend/tsconfig.json`: `@shared` paths + shared source in `include` + `typeRoots`.
- Updated `frontend/Dockerfile` (build context = repo root, shared copied into image), `.github/workflows/frontend-ci.yml` (context `.`, `dockerfile: frontend/Dockerfile`, path filters now include `packages/shared/**`), added root `.dockerignore`.
- Verified: `npm run type-check` ✅, `npm run build` (static export) ✅, `docker build` ✅. Lint (`next lint`) fails pre-existing — repo has no ESLint config; CI never runs lint.

### Phase 1 — mobile scaffold ✅ verified
- `apps/mobile/` created with `create-expo-app` (blank-typescript), then added expo-router + deps, nativewind + tailwindcss 3, lucide-react-native, react-native-mmkv, clsx/tailwind-merge.
- Root `package.json` workspaces added; all deps hoisted to root `node_modules`. Metro auto-detects workspace (`watchFolders` includes `packages/shared`).
- `packages/shared` peer range widened to `react: ^18 || ^19` (web=18, mobile=19).
- Configs written: `package.json` (`main: expo-router/entry`), `app.json` (scheme, android package, expo-router plugin), `babel.config.js` (nativewind + module-resolver `@shared` alias), `metro.config.js` (withNativeWind), `tailwind.config.js` (shared palettes as `dark:`-prefixed colors), `global.css`, `tsconfig.json` (paths + `nativewind/types`), `global.d.ts` (css module decl).
- Verified: `npx tsc --noEmit` ✅, `npx expo export --platform android` ✅ (Metro bundles shared + NativeWind).

### 2. Auth flow ✅
- `lib/storage-init.ts` (imported FIRST in `_layout`): storage adapter via `expo-sqlite/kv-store` (sync API, works in **Expo Go** — no dev build needed) + `setApiUrl` (default `http://10.0.2.2:8080/api` for emulator; override via `EXPO_PUBLIC_API_URL`, see `.env.example`).
- `lib/theme-provider.tsx`: theme state + persistence + `Appearance.setColorScheme` (drives NativeWind `dark:` variants).
- Screens: `app/login.tsx`, `app/register.tsx` (debounced username/email availability), `app/index.tsx` (auth redirect), `app/(tabs)/profile.tsx` (user info, theme/language toggles, logout).
- UI primitives: `components/ui/button.tsx`, `form-field.tsx`, `activity-card.tsx`, `screen-placeholder.tsx`.

### 3. Core screens ✅
- **Activities** ✅: today view grouped by day-time category, global streak card, optimistic record/revert with rollback, long-press action sheet (edit/revert/delete), create/edit modal (frequency, weekly days, day-time, target).
- **Time** ✅: live stopwatch (start/pause/resume/save/discard), period filter (thisWeek/thisMonth/lastMonth/allTime), records list with totals, save modal (category + description), long-press delete.
- **Routines** ✅: list, create modal with activity picker + up/down ordering, detail modal, long-press delete.
- **Notes** ✅: list, debounced search, create/edit modal (title + multiline content), long-press delete.
- **Profile** ✅: user info, theme toggle, language toggle, logout.

### 4. Wave 2 ✅
- **Finance** ✅: movements feed (day-grouped, infinite scroll, filters month/year/category), dashboard (summary cards, dolarapi widget, monthly bar chart via react-native-gifted-charts, category breakdown, upcoming bills), bills (fixed transactions + payment modal with history/delete), create/edit transaction modal.
- **Social** ✅: user search + follow/unfollow, pending requests accept/reject, public profile screen (`app/user/[username]`) with subscribe/unsubscribe to public activities/routines, private-profile lock state.
- **Health** ✅: nutrition (meal CRUD modal, daily totals + calories chart), gym (workout CRUD with nested exercise/sets form, exercise manager with muscle-group picker, muscle-volume + weekly-volume charts).
- **Polish** ✅: notes markdown preview (react-native-markdown-display), avatar upload/delete (expo-image-picker → `{uri,name,type}` FormData), activity filters (frequency/dayTime/scheduledFor), routine edit (title/description/privacy/ordered activities).

### 5. Android hardening & release ✅
- Safe-area top inset via root `SafeAreaView` (SafeAreaProvider), KeyboardAvoidingView on all bottom-sheet modals, splash-screen plugin config, 8-tab layout (activities/routines/time/notes/finance/health/social/profile).
- Shared utils moved: `frontend/utils/{formatNumbers,dateLabels}.ts` → `packages/shared/src/utils/format.ts` (date-fns dependency dropped; web imports updated).
- `userService.uploadProfilePicture` accepts `File | { uri, name, type }` (web + RN).
- CI: `.github/workflows/mobile-ci.yml` (type-check + `expo export --platform android`).
- Release: `eas.json` has `preview` profile (APK, internal distribution) and `production` (app-bundle).

## Key decisions / deviations from original plan
- **`frontend/` kept in place** (not moved to `apps/web`): CI/Docker/README reference `frontend/**` paths; moving added churn with no benefit. Same end state.
- **No npm workspaces for web**: `frontend` is deliberately excluded from root workspaces to keep its self-contained `npm ci` (CI + Docker) working. Mobile + shared install via root workspace.
- **`dtos/` moved but dead code**: web never imported them; excluded from barrel due to name collisions with `types/`. Candidate for deletion later.
- **`theme-context.tsx` stayed web-only**: it applies CSS vars to `document`; mobile needs its own theme provider using shared `theme-colors`.
- **`eslint` for web**: pre-existing broken config, out of scope.

## Verification commands
```bash
# web (must stay green)
cd frontend && npm run type-check && npm run build && test -f out/index.html

# shared (standalone)
./frontend/node_modules/.bin/tsc --noEmit -p packages/shared/tsconfig.json

# mobile
cd apps/mobile && npx tsc --noEmit && npx expo export --platform android

# docker (frontend image)
docker build -f frontend/Dockerfile -t lt-test .
```
