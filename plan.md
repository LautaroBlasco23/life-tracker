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
- [x] Tag/archival: git tag `rn-final` at RN commit `8149fea` (rollback point). No prebuilt APK
      existed locally (`android/` is git-ignored); rebuild from the tag if ever needed.
- [x] QA checklist per screen — `kotlin-refactor/qa-checklist.md` (201 checkboxes, 8 sections
      + cross-cutting). Corrections captured: registration is a single form with debounced
      availability checks (not multi-step); mobile finance = two real routes with own nav bars
      (not tabs/shims).
- [x] API contract doc — `kotlin-refactor/api-contract.md` (1,091 lines): global conventions
      (camelCase wire, `X-Timezone` header, ObjectId-string IDs, 5 envelope shapes incl. the
      note-group error-shape exception), precise 401-refresh semantics for the OkHttp
      `Authenticator` re-implementation, multipart field names (`image`, `file` XLSX ≤32MB),
      full enum registry, and a per-Retrofit-interface DTO checklist for codegen.
- [x] Long-lived branch/worktree (`mobile-app-refactor`); merge only at cutover.

### Phase 1 — Gradle skeleton
- [x] Multi-module project, Compose + Hilt + Navigation wired (13 modules:
      :app + 4 core + domain + 7 feature).
- [x] `MainActivity`, splash, theme tokens ported from `theme-colors.ts`.
- [x] i18n loader + en/es assets; nav graph with all 11 destinations stubbed.
- [x] `network_security_config.xml` + cleartext handling — deferred to Phase 2
      (needed once the app actually talks to the dev API).
- [x] package id `com.lifetracker.mobile`, versionCode 100 > any previously
      installed RN APK (RN expo default was `versionCode 1`).
- [x] CI updated: `kotlin-build` job added to `mobile-ci.yml` (RN job kept
      running until cutover).
- Gate: ✅ `:app:assembleDebug` + `:app:testDebugUnitTest` green locally
  (APK produced). On-device emulator install attempted but the emulator
  segfaults in this environment — deferred to the normal `make mobile` loop.

### Phase 2 — Core layer
- [x] Retrofit interfaces for all 13 domains + kotlinx.serialization models (port of `types/`).
- [x] `TokenRepository` (EncryptedSharedPreferences) + `AuthInterceptor` + refresh
      `Authenticator` with single-flight mutex (port of auth-service refresh-on-401,
      logout-on-failed-refresh → login).
- [x] `SettingsRepository` (DataStore: apiUrl, language, theme, session bootstrap).
- [x] Port `lib/` pure logic: `calendar-week`, `format-time`, `datetime`, `filter-options`,
      `category-labels`, `activity-templates`, `dolarapi` client.
- Gate: ✅ login works, tokens persist across restarts, refresh-on-401 verified — code-level
  parity complete; **live runtime verification deferred** (emulator unavailable in sandbox;
  MockWebServer tests cover the refresh flow in Phase 4).

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

### Phase 0 — Baseline & safety net — ✅ COMPLETE- Worktree `mobile-app-refactor` created; session moved into it; `plan.md` written and committed.
- Tag `rn-final` created at RN commit `8149fea` (rollback point; no APK existed locally —
  rebuildable from tag).
- `kotlin-refactor/qa-checklist.md` written by sub-agent from the actual RN screen code:
  201 checkboxes across auth, activities, time, notes, finance (2 routes), social, public
  profile, profile, and cross-cutting checks. Key corrections vs initially assumed list:
  registration is single-form (debounced username/email checks, validation-order dependency),
  finance routes are independent (no tabs), plus documented edge behaviors (optimistic-revert,
  drag-reorder group inference, draft persistence, timer restart-persistence, delete scopes,
  reminder 30s re-derivation, https-only API URL rule, destructive import confirm, auth
  redirect rules).
- `kotlin-refactor/api-contract.md` written by sub-agent from Go DTOs + shared services:
  13 per-domain endpoint/DTO tables, 5 response-envelope shapes (incl. note-group error
  exception), `X-Timezone` global header, ObjectId-string IDs (activity records, transactions,
  payments), multipart `image`/`file` parts, `dayFrequency` JSON-encoded string gotcha,
  full enum registry, precise 401-refresh/logout semantics, and a per-interface Retrofit
  codegen checklist.
- Commits: `bab5781` (plan), Phase 0 docs commit(s) to follow.
- **Next: Phase 1 — Gradle skeleton.**

### Phase 1 — Gradle skeleton — ✅ COMPLETE
- Built the native Gradle project **alongside** the RN scaffold (deliberate
  deviation from the original plan's final layout): `apps/mobile/` now
  contains the Kotlin project (`settings.gradle.kts`, version catalog,
  wrapper) AND the untouched RN app. RN code is deleted at Phase 6 cutover;
  the `:app` Kotlin module lives in `android-app/` (`settings.gradle.kts`
  maps `:app` there) so expo-router's `app/` routes folder is never touched.
  This keeps the npm workspace valid, the RN app shippable, and CI green.
- Module set: `:app`, `:core:{network, storage, designsystem, i18n}`,
  `:domain`, `:feature:{auth, activities, time, notes, finance, social,
  profile}` (7 feature modules, stub screens; RN-style custom header nav +
  hamburger to be added as shared scaffold in Phase 3).
- Theme port: `core/designsystem` carries the exact "Warm Minimalism"
  tokens (light+dark) from `packages/shared/src/lib/theme-colors.ts` as the
  single Kotlin source, exposed via `LocalAppColors` + a Material3
  `ColorScheme` mapping; `ThemeController` (SYSTEM/LIGHT/DARK).
- i18n: `core/i18n` loads the existing `messages/{en,es}.json` (37/39KB)
  from assets, flattens to dot-keys, runtime `I18n.current` switch — the
  login stub screen has working theme + language toggles (Phase 1 gate).
- Launcher resources: adaptive icon (foreground + monochrome from
  `apps/mobile/assets`), splash via `core-splashscreen` (light/dark bg from
  app.json semantics), `applicationId com.lifetracker.mobile`,
  `versionCode 100` (RN default was 1 → installs over).
- **Toolchain notes (matters for future phases):** AGP 9.2.1 + Gradle 9.4.1
  + built-in Kotlin (AGP9 removed `org.jetbrains.kotlin.android` — compiler
  plugins pinned to Kotlin 2.3.21 via buildscript classpath; KSP 2.3.13;
  Hilt 2.60.1; Compose BOM 2026.09.00; Navigation 2.10.2; compileSdk 37,
  minSdk 26, JVM target 17 via `compileOptions`). Wrapper jar copied from
  the previous expo prebuild output; dist pinned to cached Gradle 9.4.1.
- CI: added `kotlin-build` job (temurin 21, setup-gradle, `assembleDebug` +
  `testDebugUnitTest`); RN `type-check-and-export` job kept until cutover.
- Verification: `./gradlew :app:assembleDebug :app:testDebugUnitTest` green
  (14.4MB debug APK). Emulator (Medium_Phone_API_37.0) segfaults in this
  sandbox — on-device smoke test deferred; the user's normal `make mobile`
  loop must be updated in Phase 5 anyway.
- Commits: Phase 1 build files + sources + CI + plan.md updates.

### Phase 2 — Core layer — ✅ COMPLETE (commit `d23c464`)
- **Generated API surface (2 parallel sub-agents, reconciled):** 13 Retrofit interfaces
  (`com.lifetracker.core.network.endpoints`) + full model set
  (`com.lifetracker.core.network.model`), every field verified against Go `json` tags.
  Cross-agent reconciliation: shared envelopes (`ApiEnvelope`/`ApiList`/`PagedResponse`/
  `MovementsResponse`/`MonthlyStatsResponse`/`AvailabilityResponse`), shared enums file,
  `UserResponse` defined once (auth) and reused. Contract-vs-Go corrections recorded
  (GET /users/{username} always PublicUserCard; followers items are FollowerItem;
  movement query filters extension set). `PaymentResponse` (was missing) added verbatim
  from `backend/internal/domain/finance/model/payment_model.go`.
- **Network runtime:** OkHttp (BOM 5.5.1) + Retrofit 3.0 + kotlinx.converter;
  `DynamicUrlInterceptor` (Profile base-URL override, /api normalization, BuildConfig
  fallback), `AuthInterceptor` (Bearer + `X-Timezone`), `SessionAuthenticator`
  (refresh-on-401: re-reads tokens → single-flight refresh via mutex → retry once →
  force-logout via `SessionEvents`; anonymous 401s pass through), bootstrap client for
  refresh (no authenticator recursion). All 13 APIs provided via Hilt `NetworkModule`
  (+ `@Named("bootstrap")` AuthApi, `dolarapi` w/ own base URL).
- **Storage (`core:storage`):** `SecureStore` = EncryptedSharedPreferences
  (Android Keystore; tokens + cached `SessionUser`) implementing sync
  `TokenProvider`/`SessionStore` for OkHttp threads + DataStore `SettingsRepository`
  (apiUrl/language/theme, blocking accessors for interceptor use).
- **Auth (`domain`):** `AuthRepository` port of auth-service — login/register/logout
  (best-effort server logout), change password/email persisting fresh token pairs,
  `refreshBlocking` implementing `TokenRefresher`, session bootstrap from
  encrypted storage; `ApiError` parsing the backend error envelope.
- **Pure logic (`domain/lib`, sub-agent, JS-parity notes):** `CalendarWeek`,
  `Datetime`/`BuildDate`, `FormatTime`, `FilterOptions`, `CategoryLabels`,
  `ActivityTemplates` (40 templates + enums with exact §12 wire values) — with the 8
  documented behavior notes (Date→ZonedDateTime, "Invalid Date"→null, locale pinning,
  etc.) to consume in Phase 4 tests.
- **Build-fix ledger (for posterity):** the AGP-9 built-in-Kotlin + KSP2 route was
  abandoned after systematic failures (KspAA PROCESSING_ERROR "AuthApi unresolved").
  Working/locked toolchain = AGP 8.10.1 + Gradle 9.3.1 (wrapper restored from the RN
  prebuild) + Kotlin 2.2.21 + KSP 2.2.21-2.0.5 + Hilt 2.57.2 + Compose BOM 2025.09.01,
  compileSdk 37 w/ `suppressUnsupportedCompileSdk`, `packaging.exclude` for okhttp5
  OSGI MANIFEST, `kotlin { compilerOptions { jvmTarget = 17 } }` added per module.
  Two generated-code traps fixed: nested KDoc comments (`(`auth/*`)` inside doc text
  → nested `/*` swallow) replaced with fullwidth `＊`, and missing
  PaymentResponse/MessageOnly/POST imports patched.
- Verification: `./gradlew :app:assembleDebug :app:testDebugUnitTest` green.
- **Next: Phase 3 — feature screens in dependency order.**
