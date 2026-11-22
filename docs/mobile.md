# Mobile App (Android)

> **Rewritten in Kotlin (Jetpack Compose)** — the React Native/Expo app was replaced by a
> native Android app. The migration design (`plan.md`) lives in git history; the `rn-final`
> git tag preserves the last RN release for rollback.

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
│   │                     #   ModalSheet/DeleteConfirm (details + busy slots),
│   │                     #   ToastHost (app-root hosted), AppHeader (title +
│   │                     #   profile + actions), LbBottomNav (5 tabs),
│   │                     #   LbCategoryHeader (day-time/section headers),
│   │                     #   LbHeaderAction, LbMetricCarousel (swipeable
│   │                     #   metric card), LbFab, LbMenuDialog, LbFilterChipsRow
│   └── i18n/             # Translator over messages/{en,es}.json assets, runtime switch
├── domain/               # Repositories per feature (Retrofit-backed) + pure logic (domain/lib)
└── feature/<feature>/    # Compose screens + Hilt ViewModels: auth, activities, time, notes,
                          # finance, social, profile
```

Shared business logic STAYS TypeScript in [`packages/shared/`](../packages/shared/) for the
web app only; the mobile Kotlin copies exist inside this project (the Go DTOs under
`backend/internal/domain/*/dto/` are the real contract).


```bash
make mobile          # boots an AVD, gradlew :app:assembleDebug, adb install, starts the
                     # API (:8080), launches the app; [R] rebuild + reinstall, Enter
                     # relaunches, q quits
make mobile-rebuild  # incremental gradle build + reinstall
make mobile-logs     # tail the API log
make mobile-stop     # stop the detached API
make build-apk       # release APK for a physical phone (from build/mobile-dev-loop)
```

Host auto-detection (pattern from `build/mobile-dev-loop`): **Fedora/Linux is the default
branch** — SDK at `$(HOME)/Android/Sdk` (KVM), `ADB`/ emulator from `ANDROID_HOME`, and
`ANDROID_AVD` falls back to the first available AVD if `Pixel_9` is missing.
`WSL=1` resumes the old Windows-hosted emulator flow (`adb.exe` via interop, mirrored
networking caveats — see the Makefile comment block).

Fedora one-time prerequisites:

```bash
sudo dnf install -y java-21-openjdk-devel android-tools   # JDK 21 + adb
export JAVA_HOME=/usr/lib/jvm/java-21
export ANDROID_HOME=$HOME/Android/Sdk
kvm-ok 2>/dev/null || sudo dnf groupinstall virtualization   # /dev/kvm must be accessible
```

(`local.properties` in apps/mobile holds `sdk.dir` — machine-local, git-ignored — the
Gradle build resolves the SDK without ANDROID_HOME.)

Dev API URL: Profile → API URL override → `http://10.0.2.2:8080/api` (debug builds accept
cleartext to `10.0.2.2` via `network_security_config.xml`; release builds are https-only).
Without the override the app talks to the baked production `BuildConfig.API_BASE_URL`.

Version continuity: `applicationId com.lifetracker.mobile`; `versionCode 100` must stay
above any RN APK ever installed (users keep their app install; sessions reset once).

## Tests

Three layers, each with its own runner. Repo-wide test context and
conventions live in [`tests.md`](./tests.md); this section is the
mobile-specific source of truth.

```bash
make test-mobile     # Gradle unit tests, all modules (JUnit4 + MockWebServer)
make e2e-mobile      # Maestro e2e suite — local pre-push gate (see below)
cd apps/mobile && ./gradlew :app:assembleDebug   # compile gate
```

CI: `.github/workflows/mobile-ci.yml` (`kotlin-build` job — `assembleDebug` +
unit tests across all modules). **Maestro e2e does not run in CI** — it needs
an emulator — it's the local pre-push gate (`make e2e-mobile` prints
"safe to commit/push" on success).

### Unit tests (Gradle JUnit4)

| Module | Test | What it covers |
|---|---|---|
| `:domain` | `AuthRepositoryTest` | login/session persistence, refresh-token swap, error-envelope parsing, logout incl. unreachable backend (MockWebServer) |
| `:domain` | `NotesRepositoryTest` | note update (blank-title omission), multipart image-upload request format |
| `:domain` | `RevertLastRequestTest` | revert-last wire format (DELETE without body) |
| `:domain` | `CalendarWeekTest` | calendar-week logic port |
| `:feature:notes` | `NoteAutosaveControllerTest` | debounce + single-flight autosave semantics |
| `:feature:notes` | `NoteMarkdownStylerTest` | markdown span styling |
| `:core:i18n` | `MessagesParityTest` | en/es message-asset key parity + anchor strings |
| `:core:designsystem` | `AppColorsContrastTest` | WCAG AA contrast pairs of the theme tokens |

Conventions: JUnit4, MockWebServer for transport-level tests,
kotlinx-coroutines-test `runTest` for suspend flows. The AuthRepository
refresh path mirrors the OkHttp `SessionAuthenticator` (single-flight
refresh, retry-once, force-logout events). There are no instrumentation
(`androidTest`) suites — the MockWebServer repository tests are the closest
thing to integration tests.

### E2E tests (Maestro)

`make e2e-mobile` runs the 7 flows in `apps/mobile/e2e/flows/` **in order**:
01-auth must run first (it registers the session user), 07-profile runs last
(it signs out). Every later flow has a session guard that re-logs-in if the
suite is started from an individual flow.

Setup, handled entirely by the target:

- Checks Maestro at `~/.maestro/bin/maestro` (install: `curl -Ls "https://get.maestro.mobile.dev" | bash`).
- Boots AVD `Medium_Phone_API_37.0` if no device is attached (wait, KVM
  segfault guard via `ACCEL=off`).
- Builds `:app:assembleDebug -PapiBaseUrl=http://10.0.2.2:8080/api` and
  `adb install -r` (uninstall+retry on a signature mismatch).
- Brings the API up on :8080 (`api-up`, health-gated; needs `.env` —
  `make setup` first).
- Seeds a social target user via `POST /api/auth/register` (curl), then
  `maestro test apps/mobile/e2e/flows` with `MAESTRO_E2E_USER` /
  `MAESTRO_E2E_EMAIL` / `MAESTRO_E2E_PASS` / `MAESTRO_E2E_TARGET_USER`.

Flow conventions: text selectors are the app's i18n strings
(`core/i18n` messages/en.json) — keep them in sync when strings change;
plain selectors match FULL text. Known limitation: **Maestro's IME injection
dismisses the Compose Dialog on the note editor** (it works on every other
screen), so flow 04 asserts the editor chrome only — note text input is
deliberately not exercised e2e.

#### Happy-path coverage

One table per feature — every user action the app exposes. ✅ covered ·
⚠️ partial (entry point asserted, action not completed) · ❌ not covered —
a gap, not a claim.

**Auth**

| Action | E2E | Status |
|---|---|---|
| Log in (username/email + password) | `01-auth.yaml` | ✅ |
| Register new account (incl. username/email availability checks) | `01-auth.yaml` | ✅ |
| Navigate the bottom-nav tabs | `01-auth.yaml` | ✅ |
| Session wipe → clean relaunch lands on login | `01-auth.yaml` | ✅ |

**Activities**

| Action | E2E | Status |
|---|---|---|
| Create activity — empty-state CTA | `02-activities.yaml` | ✅ |
| Create activity — FAB | `02-activities.yaml` | ✅ |
| Delete activity (long-press → confirm dialog) | `02-activities.yaml` | ✅ |
| Edit activity | — | ❌ |
| Mark activity as done (record completion) | — | ❌ |
| Revert last completion | — | ❌ |
| Filter activities | — | ❌ |
| Create / edit / delete reminder | — | ❌ |
| Complete reminder / revert reminder completion | — | ❌ |
| Create / edit / delete routine | — | ❌ |
| Create activity from template (catalog prefill) | — | ❌ |

**Time**

| Action | E2E | Status |
|---|---|---|
| Start live session (category + description) | `03-time.yaml` | ✅ |
| Stop / pause live session | `03-time.yaml` | ✅ |
| Save live session (duration floors to 1 min) | `03-time.yaml` | ✅ |
| Resume paused session | — | ❌ |
| Discard active session | — | ❌ |
| Update session description while active | — | ❌ |
| Manual records: create / edit / delete | — | ❌ |
| Calendar events: create / edit / delete | — | ❌ |

**Notes**

| Action | E2E | Status |
|---|---|---|
| Open new-note editor (title hint, attach, preview, cancel visible) | `04-notes.yaml` | ✅ |
| Cancel editor without saving | `04-notes.yaml` | ✅ |
| Attach image to note | `04-notes.yaml` | ⚠️ button visible only — no pick/upload |
| Markdown preview | `04-notes.yaml` | ⚠️ button visible only |
| Type / edit note content (autosave) | — | ❌ Maestro IME bug — see above |
| Delete note | — | ❌ |
| Search notes | — | ❌ |
| Note groups: create / rename / delete / reorder | — | ❌ |

**Finance**

| Action | E2E | Status |
|---|---|---|
| Dashboard totals carousel (income → expenses → balance) | `05-finance.yaml` | ✅ |
| Create one-time expense (amount, category, description) | `05-finance.yaml` | ✅ |
| Update transaction | — | ❌ |
| Delete movement / fixed transaction | — | ❌ |
| Filter transactions / pagination | — | ❌ |

**Social**

| Action | E2E | Status |
|---|---|---|
| Search users | `06-social.yaml` | ✅ |
| Follow user (Follow → Following) | `06-social.yaml` | ✅ |
| Unfollow user (Following → Follow) | `06-social.yaml` | ✅ |
| Accept / reject follow request | — | ❌ |
| View public profile | — | ❌ |
| Subscribe to a public activity / routine | — | ❌ |

**Profile**

| Action | E2E | Status |
|---|---|---|
| Open profile from the Activities header | `07-profile.yaml` | ✅ |
| Settings render (picture, privacy, theme, language, password, export) | `07-profile.yaml` | ✅ |
| Sign out | `07-profile.yaml` | ✅ |
| Upload / remove avatar | — | ❌ |
| Toggle profile privacy | — | ❌ |
| Change theme / language | — | ❌ |
| Change password / change email | — | ❌ |
| Export data (backup) | — | ❌ |
| Import data (backup) | — | ❌ |

#### Error paths

Not covered yet — the suite exercises happy paths only (and the ❌/⚠️ rows
above are gaps in even that). When error-path flows land (login failure,
form validation, network errors, permission denials), they get tabled here
the same way.

## Architecture rules

- **Theme**: edit `core/designsystem/src/main/kotlin/.../AppColors.kt` (the Kotlin mirror of
  `packages/shared/src/lib/theme-colors.ts` keep both in sync; WCAG AA pairs enforced by the
  shared test after every change).
- **i18n**: `I18n.t("group.key")` with `{param}` interpolation via `t()`; runtime es/en switch.
- **Networking**: all backend access via the Retrofit interfaces in `core/network/endpoints`;
  auth/refresh handling is centralized — never hand-roll token retries.
- **New screens**: route in `android-app/.../AppHost.kt` (`Routes` + `mapNavKey`), screen in
  its `feature/<name>` module, ViewModel via `@HiltViewModel`; primary navigation is the
  `LbBottomNav` tab bar (add the route to `tabKeyForRoute` + `mainNavTabs`), the `AppHeader`
  carries the profile entry point (and optional actions, e.g. the finance cross-links).
  The profile screen is not a tab but still renders the bar with no tab highlighted
  (`Routes.PROFILE` in `tabKeyForRoute`); `profile/backup`, public profiles and auth
  screens hide it. While profile is on top, `AppHeader`'s avatar shows the same
  12%-primary pill as a selected nav item (`profileSelected = true`) and tapping it
  is a no-op.
