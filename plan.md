# Plan: `apps/mobile` — React Native/Expo → Native Kotlin (Jetpack Compose)

> Status: **IN PROGRESS** — worktree `mobile-app-refactor`.
> Progress log lives at the bottom of this file ([Progress](#progress)). Update it after every phase.

## Objective

Replace the Expo/React Native/TypeScript mobile app (`apps/mobile/`) with a native Android app
written in Kotlin + Jetpack Compose, feature-parity with today's app, integrated with the existing
Go backend, Makefile, and CI — via an in-place big-bang rewrite (per user decisions:
in-place, Jetpack Compose, plain Kotlin module for shared logic, Android-only).

**What does not change:** backend, frontend, docker-compose, `packages/shared` (stays as the web
app's shared code; mobile simply stops consuming it).

## Context (codebase inventory)

- 13 expo-router routes (~3,500 LOC), 27 component files (~4,600 LOC) in `apps/mobile`.
- Mobile-consumed half of `packages/shared`: 13 services (~2,500 LOC), 12 type files (~700 LOC),
  `lib/` (theme-colors, activity-templates, datetime, storage adapter, config), i18n en/es (~890 keys each).
- Backend API: 13 domains (auth, activities, routines, reminders, time-records, calendar-events,
  notes, note-groups, sticky-notes, finances, follows, users, subscriptions, data export/import),
  JWT Bearer with refresh-on-401.
- No offline relational DB (expo-sqlite used only as kv-store); data fetched live from API.
- No push notifications; deep links declared but unused.
- APK today: local Gradle over `expo prebuild` (`apps/mobile/android/`, git-ignored).
  Package id `com.lifetracker.mobile`, scheme `lifetracker`.
- Navigation: Stack-only + custom header nav (6 items) + hamburger slide-down panel. No tab navigator.
- Special cases: markdown render (notes only), gifted-charts (finance dashboard only),
  drag-reorder (notes only), image upload (profile avatar), document pick/share (backup),
  external API `dolarapi.com` (exchange rate).
- Tooling touched by mobile: root Makefile targets (`mobile`, `mobile-rebuild`, `mobile-logs`,
  `mobile-stop`, `test-mobile`), `.github/workflows/mobile-ci.yml`, root `package.json` workspaces.

## Target architecture

### Stack decisions

| Concern | Today (RN) | Target (Kotlin) |
|---|---|---|
| Language / UI | TypeScript + React Native | Kotlin 2.x + Jetpack Compose, Material 3 |
| Navigation | expo-router (Stack) + custom header/hamburger | Navigation Compose, one nav graph, custom header scaffold (replicate current UX) |
| Networking | `fetch` in shared services | Retrofit + OkHttp + kotlinx.serialization |
| Auth tokens | expo-secure-store + write-through cache | EncryptedSharedPreferences (Android Keystore) behind `TokenRepository` (suspend + mutex) |
| Other kv (apiUrl, currentUser, language, theme) | expo-sqlite kv-store | Jetpack DataStore (Preferences) |
| Auth refresh-on-401 | auth-service singleton | OkHttp `Authenticator` + single-flight token refresh (mutex) |
| DI | none (service singletons) | Hilt |
| State | `useState` + service singletons | ViewModel per screen + `StateFlow`; services → repositories |
| Theme | NativeWind + `theme-colors.ts` | `core/designsystem` — port `theme-colors.ts` to Kotlin tokens + `MaterialTheme` mapping |
| i18n | `messages/{en,es}.json` via LanguageProvider | Same JSON files as assets, kotlinx.serialization + `Translator` + language in DataStore |
| Icons | lucide-react-native | compose-icons Lucide pack |
| Charts | gifted-charts (finance only) | Vico |
| Markdown | react-native-markdown-display (notes only) | richtext-commonmark |
| Drag-reorder | draggable-flatlist (notes only) | `sh.calvin.reorderable` |
| Image pick/upload | expo-image-picker | `ActivityResultContracts.PickVisualMedia` + Coil + OkHttp multipart |
| Backup export/import | document-picker/file-system/sharing | `OpenDocument`/`CreateDocument` + `FileProvider` + `ACTION_SEND` |
| Splash | expo-splash-screen | `core-splashscreen` + Compose |
| Tests | jest-expo + vitest | JUnit + Turbine + Compose UI tests + MockWebServer |

### Gradle structure

```
apps/mobile/
├── settings.gradle.kts, build.gradle.kts, gradle/libs.versions.toml
├── app/                  # Application, nav graph, MainActivity, Hilt wiring
├── core/
│   ├── network/          # Retrofit, OkHttp, authenticator, interceptors, API interfaces
│   ├── storage/          # TokenRepository, SettingsRepository (DataStore)
│   ├── designsystem/     # theme tokens, reusable composables (port of components/ui/)
│   └── i18n/             # Translator, en/es assets, enum-translation utils
├── domain/               # models, repositories per feature (port of shared services)
└── feature/
    ├── auth/  ├── activities/  ├── time/  ├── notes/
    ├── finance/  ├── social/  ├── profile/  (incl. public profile + backup)
```

No Room/database module — parity with today: domain data live from API; only kv state persisted.

### Repo-level consequences

- Root `package.json` workspaces drop `apps/mobile` (keep `packages/shared` for web).
- Makefile targets + `mobile-ci.yml` rewritten (Phase 5).
- Keep `applicationId com.lifetracker.mobile`, `versionCode` higher than last RN release.
- `network_security_config.xml`: debug allows cleartext to `10.0.2.2`; release https-only
  (replaces `plugin/withCleartextManifest.js` semantics).
- API base URL: build-time default via `BuildConfig` (prod https), runtime https-only override in
  Profile persisted to DataStore (port of `lib/storage-init.ts` semantics).

## Phases

### Phase 0 — Baseline & safety net
- [ ] Tag/archive last working RN APK artifact.
- [ ] QA checklist per screen (10 screens + modals) → parity definition of done (add to this file).
- [ ] API contract doc (endpoint → DTO list) used for Retrofit interfaces.
- [ ] Long-lived branch/worktree (this worktree); merge only at cutover.

### Phase 1 — Gradle skeleton
- [ ] Multi-module project, Compose + Hilt + Navigation wired.
- [ ] `MainActivity`, splash, theme tokens ported from `theme-colors.ts`.
- [ ] i18n loader + en/es assets; empty nav graph with all 10 destinations stubbed.
- [ ] `network_security_config.xml`, package id + versionCode continuity.
- [ ] CI updated to `gradlew assembleDebug` (branch always buildable).
- Gate: app installs, shows login stub in both themes/languages.

### Phase 2 — Core layer
- [ ] Retrofit interfaces for all 13 domains + kotlinx.serialization models (port of `types/`).
- [ ] `TokenRepository` (EncryptedSharedPreferences) + `AuthInterceptor` + refresh
      `Authenticator` with single-flight mutex (port of auth-service refresh-on-401,
      logout-on-failed-refresh → login).
- [ ] `SettingsRepository` (DataStore: apiUrl, language, theme, session bootstrap).
- [ ] Port `lib/` pure logic: `calendar-week`, `format-time`, `datetime`, `filter-options`,
      `category-labels`, `activity-templates`, `dolarapi` client.
- Gate: login works, tokens persist across restarts, refresh-on-401 verified.

### Phase 3 — Features in dependency order
1. [ ] Auth (login, multi-step register incl. username/email checks)
2. [ ] Activities (list, form modal, today/streak, records, stats) + routines + templates modals
3. [ ] Time (records, active sessions, calendar view, event form)
4. [ ] Notes (markdown render, drag-reorder for notes/groups, sticky notes) — heaviest screen
5. [ ] Finance (transactions, dashboard w/ Vico charts, payment modal, fixed transactions, summary)
6. [ ] Social (follows, pending requests, subscriptions, public profile)
7. [ ] Profile (email/password modals, avatar upload, API URL override, backup export/import)
- Design-system primitives built just-in-time as screens need them.
- Gate: each feature passes its QA checklist section against `make dev` backend.

### Phase 4 — Tests
- [ ] Port logic tests to JUnit: `calendar-week`, `format-time`, auth refresh (MockWebServer),
      theme tokens, i18n key-parity (en/es same key sets).
- [ ] Compose UI tests: login/register happy path, activity create/record, note reorder,
      finance dashboard render.
- Gate: `gradlew :app:test` + `assembleDebug` green.

### Phase 5 — Tooling & repo integration
- [ ] Rewrite Makefile targets: `make mobile` (assembleDebug + adb install + API + logcat),
      `mobile-rebuild`, `mobile-logs` (logcat + API), `mobile-stop`; drop Metro.
- [ ] Rewrite `mobile-ci.yml`: paths `apps/mobile/**` only; Gradle build + tests + lint gate.
- [ ] Update docs: `docs/mobile.md`, `docs/getting-started.md`, `README.md` table, `styles.md`,
      root `AGENTS.md`.
- [ ] Root `package.json` workspace cleanup.

### Phase 6 — Cutover & deletion
- [ ] Full manual QA pass (both languages, both themes, emulator + real device, prod + dev URL).
- [ ] Install-over test: same `applicationId`, bumped `versionCode` (users re-login once — known).
- [ ] Merge branch to main; delete RN sources (`app/`, `components/`, `lib/`, `plugin/`),
      `eas.json`, jest config, Metro config, RN devDependencies. Keep nothing dead.

## Tradeoffs

- Big-bang: no shippable updates during ~6–8 weeks; mitigated by branch-based rollback.
- Permanent duplication of shared logic: web keeps TS `packages/shared`, mobile gets Kotlin port
  that can drift. Backend DTOs are the only true contract.
- i18n as JSON assets (not `strings.xml`): fast port + runtime switching + parity test;
  loses Android resource tooling (per-locale layouts, platform plurals).
- Token/session reset at cutover: every device logs in again after installing the Kotlin APK.
- Custom header/hamburger nav preserved instead of adopting BottomNavigation (parity over idiom).

## Risks

- Notes screen (976 LOC) + drag-reorder: prototype reorder early in Phase 3.
- Kotlin models vs backend DTO drift: contract doc + (future) OpenAPI codegen.
- Refresh-on-401 races: single-flight mutex MUST be tested with MockWebServer.
- CI gap window: update `mobile-ci.yml` in the same commit that removes the RN scaffold.
- Cleartext/emulator dev loop: replicate debug-vs-release cleartext semantics or local dev breaks.

---

## Progress

### Phase 0 — Baseline & safety net
- **Status:** in progress
- Worktree `mobile-app-refactor` created and session moved into it.
- `plan.md` written (this file).
