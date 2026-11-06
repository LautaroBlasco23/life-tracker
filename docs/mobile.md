# Mobile App (Android)

> **Rewritten in Kotlin (Jetpack Compose)** — the React Native/Expo app was replaced by a
> native Android app. See `plan.md` in the `mobile-app-refactor` worktree history for the
> migration design; the `rn-final` git tag preserves the last RN release for rollback.

The Android app lives in [`apps/mobile/`](../apps/mobile/) — a **Gradle multi-module Kotlin
project** (AGP 8.10 / Kotlin 2.2 / Compose) that talks to the Go backend through a generated
Retrofit layer.

## Layout

```
apps/mobile/
├── android-app/          # :app — MainActivity, Application, nav graph (Routes), splash, icons
├── core/
│   ├── network/          # Retrofit interfaces (endpoints/), wire models (model/), OkHttp
│   │                     # runtime: dynamic base-URL override, Bearer + X-Timezone,
│   │                     # refresh-on-401 SessionAuthenticator (single-flight)
│   ├── storage/          # SecureStore (EncryptedSharedPreferences tokens/user) + DataStore
│   │                     # SettingsRepository (apiUrl, language, theme)
│   ├── designsystem/     # theme tokens (Warm Minimalism, ported from shared theme-colors)
│   │                     # + primitives: LbButton/Card/TextField/OptionSelect/SegmentedTabs/
│   │                     #   ModalSheet/DeleteConfirm, ToastHost, AppHeader hamburger nav
│   └── i18n/             # Translator over messages/{en,es}.json assets, runtime switch
├── domain/               # Repositories per feature (Retrofit-backed) + pure logic (domain/lib)
└── feature/<feature>/    # Compose screens + Hilt ViewModels: auth, activities, time, notes,
                          # finance, social, profile
```

Shared business logic STAYS TypeScript in [`packages/shared/`](../packages/shared/) for the
web app only; the mobile Kotlin copies exist inside this project (DTo shapes documented in
the migration's `kotlin-refactor/api-contract.md` — the Go DTOs are the real contract).

## Building & running

```bash
make mobile          # boots the Windows AVD, gradlew :app:assembleDebug, adb install,
                     # starts the API (:8080), launches the app; [R] rebuild + reinstall,
                     # Enter relaunches, q quits
make mobile-rebuild  # incremental gradle build + reinstall
make mobile-logs     # tail the API log
make mobile-stop     # stop the detached API
```

Dev API URL: Profile → API URL override → `http://10.0.2.2:8080/api` (debug builds accept
cleartext to `10.0.2.2` via `network_security_config.xml`; release builds are https-only).
Without the override the app talks to the baked production `BuildConfig.API_BASE_URL`.

Version continuity: `applicationId com.lifetracker.mobile`; `versionCode 100` must stay
above any RN APK ever installed (users keep their app install; sessions reset once).

## Tests

```bash
make test-mobile     # Kotlin unit tests (all Gradle modules):
                     # auth MockWebServer flow, calendar-week port, i18n key parity
cd apps/mobile && ./gradlew :app:assembleDebug   # compile gate
make e2e-mobile      # pre-push smoke gate (Maestro): boots the local AVD,
                     # starts the API, installs a debug APK baked to
                     # http://10.0.2.2:8080/api, then apps/mobile/e2e/flows/smoke.yaml:
                     # register throwaway user → hamburger nav → login (needs the
                     # Android SDK on ANDROID_HOME + Maestro in ~/.maestro/bin).
```

CI: `.github/workflows/mobile-ci.yml` (`kotlin-build` job — assembleDebug + unit tests).

## Architecture rules

- **Theme**: edit `core/designsystem/src/main/kotlin/.../AppColors.kt` (the Kotlin mirror of
  `packages/shared/src/lib/theme-colors.ts` keep both in sync; WCAG AA pairs enforced by the
  shared test after every change).
- **i18n**: `I18n.t("group.key")` with `{param}` interpolation via `t()`; runtime es/en switch.
- **Networking**: all backend access via the Retrofit interfaces in `core/network/endpoints`;
  auth/refresh handling is centralized — never hand-roll token retries.
- **New screens**: route in `android-app/.../AppHost.kt` (`Routes` + `mapNavKey`), screen in
  its `feature/<name>` module, ViewModel via `@HiltViewModel`; AppHeader carries the nav.
