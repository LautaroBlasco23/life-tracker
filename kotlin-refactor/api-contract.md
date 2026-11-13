# API Contract — Kotlin Rewrite (mobile client → Go backend)

Source of truth: `backend/internal/domain/<name>/{controller,routes,dto}`.
Cross-checked against the actual fetch calls in `packages/shared/src/services/` —
this document describes the **mobile-facing surface**. Backend endpoints no
service calls appear in a table marked **(unused by mobile)**.

The Go `json` struct tags ARE the wire format. Every field name below is taken
verbatim from those tags.

---

## 1. Global conventions

### 1.1 Base & headers

| Concern | Value |
|---|---|
| Base URL | configured API URL (`getConfig().apiUrl` current; becomes OkHttp base) |
| `Authorization` | `Bearer <accessToken>` on **every authenticated request** |
| `X-Timezone` | IANA timezone string (e.g. `America/Argentina/Salta`) sent on **every authenticated request** and on `login`/`register`. Consumed by a global middleware for day-boundary logic (streaks, activity date filtering). Invalid values silently fall back to UTC. |
| `Content-Type` | `application/json` for JSON bodies; **never** set it manually for multipart |
| Body limit | large-body protection exists server-side (`internal/middleware/body_limit.go`); import upload max = **32 MB** enforced in the data controller |

### 1.2 Field naming

The backend emits **camelCase** for all JSON body fields and all envelope keys
(`message`, `data`, `count`, `error`, `details`, `items`, `total`, `limit`,
`offset`, `pages`). The only snake_case anywhere on the wire is in the **XLSX
export workbook column headers** (not parsed by clients, only re-uploaded).
Kotlin DTOs therefore need explicit `@SerialName` for nothing at the field level
if field names match, but must annotate enum names with lowercase backends
values (see §8).

### 1.3 Timestamps

All `time.Time` fields serialize as **RFC3339 with UTC offset or offset of the
requesting timezone**, e.g. `"2026-11-06T10:30:00Z"`. Use `Instant` + a custom
kotlinx/OkHttp-style converter that parses RFC3339 leniently. Exceptions:

- Query-parameter dates in finance summary/transactions/payments and
  time-records filters use plain **`YYYY-MM-DD`** (`start_date`, `end_date`).
- Calendar `from`/`to` query params are RFC3339 instants (`time.RFC3339`).
- `targetDate` in activity revert must parse as RFC3339.

### 1.4 IDs

| Domain | ID type on wire |
|---|---|
| activities, routines, reminders, time-records, calendar-events, notes, note-groups, sticky-notes, users, subscriptions | numeric (`uint` → JSON number). Mapped to Postgres rows. |
| activity records (Mongo) | **string** (hex ObjectId) |
| transactions, fixed transactions, payments (Mongo) | **string** (hex ObjectId) |
| calendar `seriesId` | **string** |
| follow request param `followerId` | numeric |

### 1.5 Response envelopes

There is **no global interceptor**; each handler wraps manually, so a few
envelope shapes coexist:

| Shape | JSON | Used by |
|---|---|---|
| List envelope | `{ "message": string, "data": T[], "count": int }` | most GET lists: activities, notes, note-groups, sticky-notes, reminders, time-records, all `finances/*` lists, `users`, `follows/pending`, `subscriptions`, `users/search` |
| Single envelope | `{ "message": string, "data": T }` | most GET/PUT/POST singletons |
| Create envelope | `{ "message": string, "data": T }` with HTTP **201** | POST creates (activities, notes, note-groups, sticky-notes, reminders, time-records, calendar-events, routines, subscriptions (no `message`), transactions, payments) |
| Paged envelope | `{ "data": { "items": T[], "total": int64, "limit": int, "offset": int, "pages": int }, }` | `/users/:username/followers`, `/users/:username/following` |
| Movements envelope | `{ "message": string, "data": T[], "count": int, "total": int }` | `finances/movements` |
| Monthly-stats envelope | `{ "message": string, "data": T[], "year": int }` | `finances/monthly-stats` |
| Auth envelope | `{ "message": string, "data": { "tokens": TokenResponse, "user": UserResponse } }` | login, register |
| Refresh/token envelope | `{ "message": string, "data": TokenResponse }` | refresh, password, email update |
| Bare | `{ "data": T }` (no `message`) | `POST /follows/:username`, `GET /users/:username` (public card) |
| Availability | `{ "available": bool, "username"?: string, "email"?: string }` (no envelope) | check-username, check-email |
| Delete only | `{ "message": string }` | DELETEs |
| Error | `{ "error": string, "details"?: string }` | most 4xx/5xx (**exceptions**: note-group controller errors return `{ "message": string }` for 4xx — parse defensively) |

Notes:

- `data` in list envelopes is `null` (not `[]`) when the collection is empty in
  some handlers (`data: [] | null` per shared-service typing). Always
  null-tolerant: `data ?: emptyList()`.
- `notes` on activity records and `dayFrequency` have `omitempty` — absent when
  empty. Treat unknown/absent fields as nullable Kotlin fields.

### 1.6 Serialization requirements (kotlinx.serialization)

- Field names are camelCase server-side; if Kotlin property names are camelCase
  too they match exactly — but **do not rely on that**: explicit `@SerialName`
  on every field is the safe migration path (the doc lists wire names).
- `encodeDefaults = true` so optional request fields always emitted is NOT
  desired: request DTOs use `omitempty` semantics server-side only to *skip*
  validation; for PATCH/PUT-style updates with `*pointer` fields, **omit
  rather than send `null`** — the backend treats `null` and absent
  differently for binding (`*string` nil = unchanged). Use `explicitNulls =
  false`, or model update bodies with nullable wrapper fields that are skipped
  when null.
- Enums: keep raw values exactly as listed in §8. Annotate each enum constant
  with `@SerialName("<rawValue>")`.

---

## 2. Auth scheme & the 401-refresh flow

### 2.1 Tokens

- JWT access + refresh tokens. Backend issues on `login`, `register`, and
  **also returns a fresh pair** from `PUT /auth/password` and `PUT /auth/email`
  (changing password/email rotates refresh tokens server-side — the old ones
  are revoked).
- Wire shape `TokenResponse`:

  | Field | Type |
  |---|---|
  | `accessToken` | string |
  | `refreshToken` | string |
  | `tokenType` | string (`"Bearer"`) |
  | `expiresIn` | number (seconds) |

- Login/register wrap it: `{ message, data: { tokens: TokenResponse, user: UserResponse } }`.

### 2.2 Endpoints — auth

| Method | Path | Purpose | Auth | Status |
|---|---|---|---|---|
| POST | `/auth/register` | Create account, returns tokens + user | No | 201 |
| POST | `/auth/login` | Login with email **or username** in `identifier` | No | 200 |
| POST | `/auth/refresh` | Exchange refresh token → new token pair | No (body carries the refresh token) | 200 |
| PUT | `/auth/password` | Change password; returns fresh token pair | Yes | 200 |
| PUT | `/auth/email` | Change email (password-confirmed); returns fresh token pair | Yes | 200 |
| POST | `/auth/logout` | Revoke refresh token(s) | Yes | 200 |

These three public endpoints are per-IP rate limited; expect 429 under retries.

#### Request / response DTOs (auth)

`POST /auth/register` — mobile sends:

| Field | Type | Optional |
|---|---|---|
| `email` | string (email format) | no |
| `password` | string (8–72 chars) | no |
| `firstName` | string (2–50) | no |
| `lastName` | string (2–50) | no |
| `username` | string (3–30) | no |
| `timezone` | string | yes — **mobile sends it**, backend DTO ignores it (unknown field). The authoritative timezone channel is the `X-Timezone` header. |

Response: auth envelope (`data.tokens`, `data.user: UserResponse`). Degraded
path (user fetch fails): `200/201` with `data = TokenResponse` (no nested
`tokens`/`user`) — code for both.

`POST /auth/login`:

| Field | Type | Optional |
|---|---|---|
| `identifier` | string (email or username, 3–255) | no |
| `password` | string | no |

Response: same auth envelope as register.

`POST /auth/refresh`:

| Field | Type | Optional |
|---|---|---|
| `refreshToken` | string | no |

Response: `{ "message": string, "data": TokenResponse }`. Failure: `401 { "error": string }` → **client must log out**.

`PUT /auth/password` (auth):

| Field | Type |
|---|---|
| `currentPassword` | string |
| `newPassword` | string (8–72 chars) |

Response: `{ "message": string, "data": TokenResponse }` — **store the returned pair**.

`PUT /auth/email` (auth):

| Field | Type |
|---|---|
| `password` | string |
| `newEmail` | string (email format) |

Response: `{ "message": string, "data": TokenResponse }` — store pair; update locally cached user email.

`POST /auth/logout` (auth):

| Field | Type | Optional |
|---|---|---|
| `refreshToken` | string | yes — omit (or absent body) ⇒ **revoke all sessions** for the user |

Response: `{ "message": "Logged out successfully" }`. This call is **best-effort**: never block local sign-out on its failure.

Error body: `{ error: string, details?: string }` — `details` holds backend
validator fragments like `'Password' failed on the 'min' tag` (web maps that to
a friendly message; replicate).

#### 2.3 Client session logic (to be implemented as OkHttp `Authenticator` + interceptor)

Exact behavior from `packages/shared/src/services/auth-service.ts`:

1. Session state = `accessToken`, `refreshToken`, `currentUser` (persist all
   three; invalidate the cache together).
2. **Proactive refresh:** before a request, if `accessToken == null` but
   `refreshToken != null` → refresh first. If refresh throws → logout() and
   throw "Session expired". If both are null → logout() and fail fast.
3. **Never overwrite `Authorization` for FormData bodies with a wrong
   Content-Type** — multipart bodies must not get `application/json`.
4. Attach `Authorization: Bearer <accessToken>` and `X-Timezone` to every
   authenticated request.
5. **On 401 response:**
   - if `refreshToken` exists → `POST /auth/refresh { refreshToken }`
     - **on success**: replace both tokens in storage, rebuild
       `Authorization` header, **retry the original request exactly once**.
       If the retry is 401 again → logout() + throw "Session expired".
     - **on failure (non-2xx or thrown)**: logout() and throw "Session expired".
   - if there is **no refresh token** → logout() and throw "Session expired".
6. `logout()` = attempt `POST /auth/logout` with current Bearer + body
   `{ refreshToken }` (network errors swallowed), then clear tokens + user from
   storage and notify observers (`isAuthenticated=false`).

`Authenticator` mapping notes: run refresh inside `authenticate()`; guard with
a single in-flight refresh (concurrent 401s must share one refresh call — the
refresher token rotates, so two parallel refreshes invalidate each other);
attempt the retry at most once (track via a header like
`X-Retried-Auth` or priorResponse count); on any failure, emit a
"force logout" event and return `null` from `authenticate()`.

#### Public availability checks (no auth, use plain client — no refreshing)

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/users/check-username` | `username` | `{ "available": bool, "username": string }` |
| GET | `/users/check-email` | `email` | `{ "available": bool, "email": string }` |

Both rate limited (account-enumeration protection).

---

## 3. Activities

Routes group: `/activities`. All require auth except none (all authed).

| Method | Path | Purpose | Auth | Used |
|---|---|---|---|---|
| POST | `/activities` | Create activity | Yes | ✔ (201) |
| GET | `/activities` | List / filter activities | Yes | ✔ |
| GET | `/activities/today` | Today's scheduled activities (timezone-aware) | Yes | ✔ |
| GET | `/activities/streak` | Global completion streak `{current, longest}` | Yes | ✔ |
| GET | `/activities/:id` | Single activity | Yes | ✔ |
| PUT | `/activities/:id` | Partial update (pointer fields) | Yes | ✔ |
| DELETE | `/activities/:id` | Delete | Yes | ✔ |
| POST | `/activities/:id/record` | Record one completion | Yes | ✔ (201) |
| GET | `/activities/:id/records` | Completion history | Yes | ✔ |
| GET | `/activities/:id/stats` | Stats for one activity | Yes | ✔ |
| DELETE | `/activities/:id/revert` | Revert last completion (optional body `targetDate`) | Yes | ✔ |

### DTOs (activities)

`CreateActivityRequest` (POST /activities):

| Field | Type | Optional | Notes |
|---|---|---|---|
| `title` | string (1–255) | no | |
| `description` | string (≤1000) | no | |
| `frequency` | enum | no | `daily \| weekly \| monthly` |
| `dayFrequency` | string | yes | **JSON-encoded array as a string**: mobile does `JSON.stringify(['monday',...])`; values are lowercase day names (`monday…sunday`); absent/empty for daily |
| `dayTime` | enum | no | `notSpecified \| morning \| afternoon \| evening` |
| `completionAmount` | int (≥1) | no | completions required per period |
| `privacyStatus` | — | — | **NOT accepted on create** (mobile payload may include it; backend ignores unknown fields — do not rely on it) |

`UpdateActivityRequest` (PUT /activities/:id) — all fields optional, omit when unchanged:

| Field | Type |
|---|---|
| `title` | string |
| `description` | string |
| `completionAmount` | int |
| `frequency` | enum |
| `dayFrequency` | string (JSON-encoded day array) |
| `dayTime` | enum |
| `isActive` | bool |
| `privacyStatus` | enum `public \| private` |

`ActivityResponse` (list item + single):

| Field | Type | Optional |
|---|---|---|
| `id` | number | |
| `userId` | number | |
| `title` | string | |
| `description` | string | |
| `frequency` | enum string | |
| `dayFrequency` | string | yes (omitempty) — JSON string to parse with `JSON.parse` |
| `dayTime` | enum string | |
| `completionAmount` | int | |
| `todayCompletions` | int | |
| `isActive` | bool | |
| `isCompletedToday` | bool | |
| `privacyStatus` | enum string | |
| `streak` | `StreakInfo` | yes (omitempty) |
| `routines` | `RoutineRef[]` | yes (omitempty) |
| `createdAt` | RFC3339 | |
| `updatedAt` | RFC3339 | |

`StreakInfo`: `{ current: int, longest: int }`.
`RoutineRef`: `{ id: number, title: string }`.

`RecordActivityRequest` (POST /:id/record):

| Field | Type | Optional |
|---|---|---|
| `completionDate` | RFC3339 | yes — defaults to now |
| `notes` | string (≤500) | yes |

`ActivityRecordResponse`:

| Field | Type |
|---|---|
| `id` | **string** (Mongo) |
| `activityId` | number |
| `userId` | number |
| `completionDate` | RFC3339 |
| `notes` | string (omitempty) |
| `createdAt` | RFC3339 |

`ActivityStatsResponse` (GET /:id/stats):

| Field | Type |
|---|---|
| `activityId` | number |
| `title` | string |
| `totalCompletions` | int64 |
| `currentStreak` | int |
| `longestStreak` | int |
| `completionRate` | double (0–1) |
| `recentRecords` | `ActivityRecordResponse[]` |

`RevertCompletionRequest` (DELETE /:id/revert, optional body): `{ "targetDate": RFC3339? }` → `{ "message": string }`.

Query params for `GET /activities` (mobile `ActivityFilter`):

| Param | Meaning |
|---|---|
| `frequency` | `daily \| weekly \| monthly` |
| `day_time` | `notSpecified \| morning \| afternoon \| evening` (snake_case param name!) |
| `scheduled_for` | `YYYY-MM-DD` date filter (ISO date) |

---

## 4. Routines

Routes group: `/routines`. Update is **PATCH** (not PUT).

| Method | Path | Purpose | Auth | Used |
|---|---|---|---|---|
| POST | `/routines` | Create routine | Yes | ✔ (201) |
| GET | `/routines/me` | My routines (list envelope) | Yes | ✔ |
| GET | `/routines/:id` | Single routine | Yes | ✔ |
| PATCH | `/routines/:id` | Partial update | Yes | ✔ |
| DELETE | `/routines/:id` | Delete | Yes | ✔ |

`CreateRoutineRequest`:

| Field | Type | Optional | Notes |
|---|---|---|---|
| `title` | string (1–255) | no | |
| `description` | string (≤1000) | no | |
| `privacyStatus` | enum | no | `public \| private` |
| `status` | enum | yes | `draft \| active \| stopped` |
| `dayTime` | enum | yes | `notSpecified \| morning \| afternoon \| evening` |
| `dayFrequency` | string | yes | JSON-encoded day-name array (same encoding as activities) |
| `activityIds` | `ActivityIDPosition[]` | no | ≥1 item |

`ActivityIDPosition`: `{ "activityId": number (required), "position": int }`.

`UpdateRoutineRequest`: same fields, all optional (`activityIds` optional).

`RoutineResponse`:

| Field | Type | Optional |
|---|---|---|
| `id` | number | |
| `userId` | number | |
| `title` | string | |
| `description` | string | |
| `privacyStatus` | enum string | |
| `status` | enum string | |
| `dayTime` | enum string | |
| `dayFrequency` | string | yes (omitempty) |
| `activities` | `RoutineActivityItem[]` | |
| `isCompletedToday` | bool | |
| `createdAt` / `updatedAt` | RFC3339 | |

`RoutineActivityItem`:

| Field | Type | Optional |
|---|---|---|
| `activityId` | number | |
| `activityTitle` | string | |
| `description` | string | |
| `frequency` | enum string | |
| `dayFrequency` | string | yes (omitempty) |
| `dayTime` | enum string | |
| `privacyStatus` | enum string | |
| `completionAmount` | int | |
| `position` | int | |
| `todayCompletions` | int | |
| `scheduledToday` | bool | |

---

## 5. Reminders

Routes group: `/reminders`.

| Method | Path | Purpose | Auth | Used |
|---|---|---|---|---|
| POST | `/reminders` | Create | Yes | ✔ (201) |
| GET | `/reminders` | List mine | Yes | ✔ |
| GET | `/reminders/:id` | Get one | Yes | ✔ |
| PUT | `/reminders/:id` | Partial update | Yes | ✔ |
| DELETE | `/reminders/:id` | Delete | Yes | ✔ |
| POST | `/reminders/:id/complete` | Mark complete | Yes | ✔ |
| DELETE | `/reminders/:id/complete` | Revert completion | Yes | ✔ |

`CreateReminderRequest`:

| Field | Type | Optional |
|---|---|---|
| `title` | string (1–255) | no |
| `description` | string (≤1000) | no |
| `dueAt` | RFC3339 | no |
| `activeFrom` | RFC3339 | yes |
| `privacyStatus` | enum | yes (`public \| private`) |

`UpdateReminderRequest`: same fields, all optional.

`ReminderResponse`:

| Field | Type | Optional |
|---|---|---|
| `id` | number | |
| `userId` | number | |
| `title` / `description` | string | |
| `dueAt` | RFC3339 | |
| `activeFrom` | RFC3339 | yes |
| `completedAt` | RFC3339 | yes |
| `privacyStatus` | enum string | |
| `createdAt` / `updatedAt` | RFC3339 | |

---

## 6. Time records

Routes group: `/time-records`.

| Method | Path | Purpose | Auth | Used |
|---|---|---|---|---|
| POST | `/time-records` | Create | Yes | ✔ (201) |
| GET | `/time-records` | List with filters | Yes | ✔ |
| GET | `/time-records/stats` | Aggregate stats | Yes | ✔ |
| GET | `/time-records/:id` | Get one | Yes | ✔ |
| PUT | `/time-records/:id` | Partial update | Yes | ✔ |
| DELETE | `/time-records/:id` | Delete | Yes | ✔ |

`CreateTimeRecordRequest`:

| Field | Type | Optional |
|---|---|---|
| `category` | string (1–100) | no |
| `description` | string (≤1000) | no |
| `durationMinutes` | int (≥1) | no |

`UpdateTimeRecordRequest`: same fields, all optional.

`TimeRecordResponse`:

| Field | Type |
|---|---|
| `id` | number |
| `category` | string |
| `description` | string |
| `durationMinutes` | int |
| `createdAt` / `updatedAt` | RFC3339 |

GET filters (query): `category`, `month` (1–12), `year` (2000–2100),
`start_date`/`end_date` (`YYYY-MM-DD`). Note: mobile only sends
category/month/year.

`TimeStatsResponse`:

| Field | Type |
|---|---|
| `categoryTotals` | map<string, int> (category → minutes) |
| `topCategory` | string |
| `topCategoryMinutes` | int |
| `totalMinutes` | int |
| `recordCount` | int |

---

## 7. Calendar events

Routes group: `/calendar-events`.

| Method | Path | Purpose | Auth | Used |
|---|---|---|---|---|
| POST | `/calendar-events` | Create (optionally a recurring series) | Yes | ✔ (201) |
| GET | `/calendar-events` | List, optional `from`/`to` range | Yes | ✔ |
| GET | `/calendar-events/:id` | Get one | Yes | ✔ |
| PUT | `/calendar-events/:id` | Update; `scope` in body | Yes | ✔ |
| DELETE | `/calendar-events/:id?scope=…` | Delete; `scope` in **query** | Yes | ✔ |

`GET /calendar-events` query: `from` and `to`, **RFC3339, must be sent
together** (400 if only one). Returns events overlapping `[from, to)`.

`CreateCalendarEventRequest`:

| Field | Type | Optional |
|---|---|---|
| `title` | string (1–255) | no |
| `description` | string (≤1000) | no |
| `category` | string (1–100) | no |
| `startAt` | RFC3339 | no |
| `endAt` | RFC3339 | no |
| `recurrence` | object | yes |

`recurrence` object (`CalendarRecurrenceRequest`):

| Field | Type | Optional | Notes |
|---|---|---|---|
| `rule` | string | no | currently only `"weekly"` is supported |
| `interval` | int | yes | validated by service |
| `until` | RFC3339 | yes | bounded in practice (last occurrence) |

`UpdateCalendarEventRequest` (all optional):

| Field | Type |
|---|---|
| `title` | string |
| `description` | string |
| `category` | string |
| `startAt` | RFC3339 |
| `endAt` | RFC3339 |
| `scope` | enum `occurrence \| series` (default `occurrence` when absent) |

`CalendarEventResponse`:

| Field | Type | Optional |
|---|---|---|
| `id` | number | |
| `title` / `description` / `category` | string | |
| `startAt` / `endAt` | RFC3339 | |
| `seriesId` | **string** | yes |
| `occurrenceIndex` | int | yes |
| `recurrenceRule` | string | yes |
| `recurrenceUntil` | RFC3339 | yes |
| `recurrenceInterval` | int | yes |
| `createdAt` / `updatedAt` | RFC3339 | |

DELETE scope is a **query** parameter (`?scope=occurrence|"series"`); PUT scope
is inside the JSON body. Asymmetric — encode accordingly.

---

## 8. Notes & Note groups & Sticky notes

### Notes — `/notes`

| Method | Path | Purpose | Auth | Used |
|---|---|---|---|---|
| POST | `/notes` | Create | Yes | ✔ (201) |
| GET | `/notes` | List; `q` = search text | Yes | ✔ |
| GET | `/notes/:id` | Get one | Yes | ✔ |
| PUT | `/notes/:id` | Partial update | Yes | ✔ |
| POST | `/notes/reorder` | Reorder | Yes | ✔ |
| DELETE | `/notes/:id` | Delete | Yes | ✔ |

`CreateNoteRequest`: `{ "title": string (1–255), "content": string (≤50000) }`.
`UpdateNoteRequest`: `title`, `content` optional.
`NoteResponse`:

| Field | Type | Optional |
|---|---|---|
| `id` | number | |
| `userId` | number | |
| `title` / `content` | string | |
| `groupId` | number | yes |
| `position` | int | |
| `createdAt` | RFC3339 | |
| `editedAt` | RFC3339 | |

`POST /notes/reorder` body:

```json
{ "items": [ { "id": 1, "groupId": 2, "position": 0 }, … ] }
```

`groupId` nullable (number | null). Response `{ "message": string }`.

### Note groups — `/note-groups`

| Method | Path | Purpose | Auth | Used |
|---|---|---|---|---|
| POST | `/note-groups` | Create | Yes | ✔ (201) |
| GET | `/note-groups` | List | Yes | ✔ |
| GET | `/note-groups/:id` | Get one | Yes | (unused by mobile) |
| PUT | `/note-groups/:id` | Update name | Yes | ✔ |
| POST | `/note-groups/reorder` | Reorder | Yes | ✔ |
| DELETE | `/note-groups/:id` | Delete | Yes | ✔ |

`CreateNoteGroupRequest`: `{ "name": string (1–255) }`. Update: name optional.
`NoteGroupResponse`: `{ id, userId, name, position, createdAt, editedAt }`
(`createdAt`/`editedAt` RFC3339).
`POST /note-groups/reorder` body: `{ "items": [ { "id": 1, "position": 0 } ] }`.
**Caution:** this controller's 4xx error bodies use `{ "message": … }` instead
of `{ "error": … }` — parse defensively.

### Sticky notes — `/sticky-notes`

| Method | Path | Purpose | Auth | Used |
|---|---|---|---|---|
| POST | `/sticky-notes` | Create | Yes | ✔ (201) |
| GET | `/sticky-notes` | List | Yes | ✔ |
| GET | `/sticky-notes/:id` | Get one | Yes | (unused by mobile) |
| PUT | `/sticky-notes/:id` | Update | Yes | ✔ |
| DELETE | `/sticky-notes/:id` | Delete | Yes | ✔ |

`CreateStickyNoteRequest` — **both fields optional** (a sticky note may have
only title, only description, or both):

| Field | Type | Optional |
|---|---|---|
| `title` | string (≤255) | yes |
| `description` | string (≤10000) | yes |

`UpdateStickyNoteRequest`: same, optional.
`StickyNoteResponse`: `{ id, userId, title, description, createdAt, editedAt }`.

---

## 9. Finances

Routes group: `/finances`. All request/response IDs for transactions, fixed
transactions, and payments are **hex ObjectId strings**. All endpoints authed;
envelope always `{ message, data[, count] }`.

| Method | Path | Purpose | Query / Body | Used |
|---|---|---|---|---|
| GET | `/finances/categories` | Category catalog | q: `type`?, `frequency`? | ✔ |
| POST | `/finances/transactions` | Create transaction | JSON | ✔ (201) |
| GET | `/finances/transactions` | List with filters + `limit` | q: `type`,`frequency`,`start_date`,`end_date`,`month`,`year`,`category`,`limit` (default 100) | ✔ |
| GET | `/finances/transactions/:id` | Get one | — | ✔ |
| PUT | `/finances/transactions/:id` | Partial update | JSON | ✔ |
| DELETE | `/finances/transactions/:id` | Delete | — | ✔ |
| GET | `/finances/fixed-transactions` | Fixed bills w/ totals | q: `month`?, `year`? | ✔ |
| GET | `/finances/fixed-transactions/:id` | Fixed bill + payments | — | ✔ |
| GET | `/finances/movements` | Unified feed | q: `type`,`category`,`month`,`year`,`limit`,`offset` | ✔ |
| POST | `/finances/payments` | Pay a fixed transaction | JSON | ✔ (201) |
| GET | `/finances/payments` | Payments list | q: `transaction_id`?, `start_date`?, `end_date`?, `limit` (default 100) | ✔ |
| DELETE | `/finances/payments/:id` | Delete payment | — | ✔ |
| GET | `/finances/summary` | Category totals | q: **`start_date` + `end_date` required** (`YYYY-MM-DD`) | ✔ |
| GET | `/finances/monthly-stats` | Per-month aggregates | q: `year` (default current) | ✔ |

Mobile response additions to know:

- `finances/movements` envelope contains `total` **and** `count`.
- `finances/monthly-stats` envelope contains `year`.

### DTOs (finances)

`CreateTransactionRequest`:

| Field | Type | Optional | Notes |
|---|---|---|---|
| `date` | RFC3339 | yes (mobile always fills with `new Date().toISOString()` if missing) | |
| `type` | enum | no | `income \| outcome` |
| `frequency` | enum | no | `fixed \| variable` |
| `paymentFrequency` | enum | yes | `monthly \| bimonthly \| yearly` |
| `description` | string (≤500) | yes (omitempty) | |
| `amount` | double (≥0) | no | |
| `category` | string | no | category **name** |

`UpdateTransactionRequest`: same, all optional.

`TransactionResponse`:

| Field | Type | Optional |
|---|---|---|
| `id` | **string** (ObjectId) | |
| `userId` | number | |
| `type` | enum string | |
| `frequency` | enum string | |
| `paymentFrequency` | enum string | yes |
| `categoryName` | string | |
| `description` | string | yes |
| `amount` | double | |
| `date` | RFC3339 | |
| `createdAt` / `updatedAt` | RFC3339 | |

`FixedTransactionResponse`:

| Field | Type | Optional |
|---|---|---|
| `id` | string | |
| `type` | enum | |
| `frequency` | enum | |
| `paymentFrequency` | enum | |
| `categoryName` | string | |
| `description` | string | yes |
| `totalPaid` | double | |
| `payments` | `PaymentSummary[]` | yes |
| `currentPeriodPayment` | `PaymentSummary` | yes |
| `createdAt` / `updatedAt` | RFC3339 | |

`PaymentSummary`: `{ "id": string, "amount": double, "date": RFC3339 }`.

`CreatePaymentRequest`:

| Field | Type | Optional |
|---|---|---|
| `transactionId` | string (ObjectId) | no |
| `amount` | double (> 0) | no |
| `date` | RFC3339 | yes (mobile fills default ISO-now) |

`PaymentResponse`: `{ "id": string, "transactionId": string, "amount": double, "date": RFC3339, "createdAt": RFC3339 }`.
(date/createdAt RFC3339).

`CategoryResponse` (GET /finances/categories items):

| Field | Type | Optional |
|---|---|---|
| `name` | string | |
| `type` | enum string (`income`/`outcome`) | |
| `icon` | string | yes |
| `applicableToFreq` | enum string (`fixed`/`variable`) | |

`MovementResponse` (feed item):

| Field | Type | Optional |
|---|---|---|
| `id` | string | |
| `sourceType` | enum string | `"transaction" \| "payment" \| "fixed"` |
| `type` | enum | |
| `amount` | double | |
| `category` | string | |
| `description` | string | yes |
| `date` | RFC3339 | |
| `paid` | bool (false = pending bill of a fixed transaction) | |
| `transactionId` | string | yes |

`FinanceSummaryResponse`:

| Field | Type |
|---|---|
| `period` | string |
| `incomeByCategory` | `CategorySummary[]` |
| `outcomeByCategory` | `CategorySummary[]` |
| `totalIncome` | double |
| `totalOutcome` | double |
| `balance` | double |

`CategorySummary`: `{ "categoryName": string, "total": double, "percentage": double, "count": int64 }`.

`MonthlyStatsResponse` (items of the monthly-stats list):

| Field | Type |
|---|---|
| `month` | string |
| `year` | int |
| `totalIncome` | double |
| `totalOutcome` | double |
| `balance` | double |
| `transactionCount` | int64 |

---

## 10. Follows & Subscriptions & Users (social surface)

### Follows — `/follows`

| Method | Path | Purpose | Auth | Used |
|---|---|---|---|---|
| POST | `/follows/:username` | Request to follow (or auto-accept if target public) | Yes | ✔ — response `{ "data": { "status": string } }` (no `message`) |
| DELETE | `/follows/:username` | Unfollow | Yes | ✔ — `{ "message": string }` |
| GET | `/follows/pending` | Incoming pending requests | Yes | ✔ — `{ "data": FollowerItem[], "count": int }` |
| POST | `/follows/pending/:followerId/accept` | Accept request | Yes | ✔ — `{ "message": string }` |
| POST | `/follows/pending/:followerId/reject` | Reject request | Yes | ✔ — `{ "message": string }` |

`FollowerItem`: `{ "userId": number, "username": string, "firstName": string, "lastName": string }`.

`status` values (`FollowStatus`): `"pending" | "accepted" | "none"`.

### Subscriptions — `/subscriptions` (clone a public activity or routine)

| Method | Path | Purpose | Auth | Used |
|---|---|---|---|---|
| POST | `/subscriptions` | Subscribe | Yes | ✔ — **201**, `{ "data": SubscriptionResponse }` (no `message`) |
| GET | `/subscriptions` | My subscriptions | Yes | ✔ — `{ "data": SubscriptionResponse[], "count": int }` |
| DELETE | `/subscriptions/:id` | Unsubscribe (removes the clone) | Yes | ✔ — `{ "message": string }` |

`POST /subscriptions` body: `{ "sourceType": "activity" | "routine", "sourceId": number }`.

`SubscriptionResponse`: `{ "id": number, "sourceType": "activity"|"routine", "sourceId": number, "clonedId": number }` — `clonedId` is **the local copy's id** the app should use afterwards.

### Users — `/users`

| Method | Path | Purpose | Auth | Used |
|---|---|---|---|---|
| GET | `/users/me` | My profile (UserResponse) | Yes | ✔ |
| PUT | `/users/me` | Update profile | Yes | ✔ |
| POST | `/users/me/image` | Upload avatar (**multipart**, field `image`) | Yes | ✔ |
| DELETE | `/users/me/image` | Clear avatar | Yes | ✔ |
| GET | `/users` | All users | Yes | ✔ |
| GET | `/users/search` | Search users | Yes | ✔ — `{ "data": PublicUserCard[], "count": int }` |
| GET | `/users/check-username` | Availability | No (rate limited) | ✔ |
| GET | `/users/check-email` | Availability | No (rate limited) | ✔ |
| GET | `/users/:username` | Try as numeric ID (UserResponse) else as username (PublicUserCard) | Yes | ✔ |
| GET | `/users/:username/profile` | Public profile (counts + content if visible) | Yes | ✔ |
| GET | `/users/:username/followers` | Followers (paged) | Yes | ✔ |
| GET | `/users/:username/following` | Following (paged) | Yes | ✔ |

`GET /users/:username` dual dispatch: if the path param parses as a number the
server returns a full `UserResponse` (via user envelope), otherwise it returns
a `PublicUserCard`. Model both.

`UpdateUserRequest` (PUT /users/me — all optional):

| Field | Type | Notes |
|---|---|---|
| `firstName` | string (2–50) | |
| `lastName` | string (2–50) | |
| `username` | string (3–30) | |
| `profilePicUrl` | string | |
| `timezone` | string (IANA) | |
| `profilePrivacyStatus` | enum | `public \| private` |

`UserResponse`:

| Field | Type | Optional |
|---|---|---|
| `id` | number | |
| `username` | string | |
| `firstName` / `lastName` | string | |
| `email` | string | |
| `profilePicUrl` | string | yes |
| `thumbnailUrl` | string | yes (imagestore-generated small variant) |
| `timezone` | string | yes |
| `profilePrivacyStatus` | enum string | yes (omitempty) |
| `createdAt` / `updatedAt` | RFC3339 | |

`PublicUserCard`:

| Field | Type | Optional |
|---|---|---|
| `id` | number | |
| `username` | string | |
| `firstName` / `lastName` | string | |
| `profilePicUrl` | string | yes |
| `profilePrivacyStatus` | enum string | |
| `followStatus` | enum string (`pending \| accepted \| none`) | |
| `isFollowing` | bool | |

Search request query: `q` (1–30 chars), `limit` (1–50).

`GET /users/:username/profile` — `PublicProfileResponse` (embedded PublicUserCard fields +):

| Field | Type |
|---|---|
| `followersCount` | int64 |
| `followingCount` | int64 |
| `publicRoutinesCount` | int64 |
| `publicActivitiesCount` | int64 |
| `canViewContent` | bool |
| `routines` | `PublicRoutineCard[]` |
| `activities` | `PublicActivityCard[]` |

`PublicRoutineCard`: `{ id, title, description, activities: RoutineActivityItem[], subscribed: bool, streak?: StreakInfo? }`.
`PublicActivityCard`: `{ id, title, description, frequency, dayTime, completionAmount, subscribed: bool, dayFrequency?: string?, streak?: StreakInfo? }`.

All enclosed in `{ "data": … }` single envelope.

Followers/Following endpoints return a real **page envelope**:

```json
{ "data": { "items": PublicUserCard[], "total": 12, "limit": 25, "offset": 0, "pages": 1 } }
```

`limit` defaults 25, max 100; mobile sends `limit`/`offset` explicitly.

---

## 11. Multipart endpoints

### POST `/users/me/image` (auth)

- `multipart/form-data`
- **File part name: `image`**
- Response: `{ "message": string, "data": UserResponse }` (updated user with new `profilePicUrl`/`thumbnailUrl`)
- Mobile (RN) sends `{ uri, name, type }` — OkHttp path: build the part with the native MIME from `type`.

### POST `/users/me/data/import` (auth)

- `multipart/form-data`
- **File part name: `file`** (the XLSX backup)
- Max size: 32 MB (larger → 400 `{ "error": "File is too large" }`)
- Success: `{ "message": "Data restored successfully", "data": RestoreCounts }`
- **Destructive**: wipes the user's current data before restore.

`RestoreCounts`:

| Field | Type |
|---|---|
| `activities` | int |
| `timeRecords` | int |
| `calendarEvents` | int |
| `notes` | int |
| `routines` | int |
| `routineActivities` | int |
| `activityRecords` | int |
| `transactions` | int |
| `payments` | int |

### GET `/users/me/data/export` (auth)

- Returns an XLSX binary (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
- `Content-Disposition: attachment; filename="life-tracker-backup-YYYY-MM-DD.xlsx"`
- Workbook is produced by the backend schema v2 (`_meta` + 9 entity sheets:
  activities, time_records, calendar_events, notes, routines,
  routine_activities, activity_records, transactions, payments). The client
  never parses it — only saves the bytes and (ideally) the filename.
- Mobile re-uploads it unmodified to `/users/me/data/import`.

---

## 12. Enum / raw-value registry

All values are sent/received **exactly lowercase** — add them via
`@SerialName` on enum entries:

| Enum / string field | Allowed raw values |
|---|---|
| activity/routine `frequency` | `daily` `weekly` `monthly` |
| `dayTime` | `notSpecified` `morning` `afternoon` `evening` |
| `privacyStatus`, `profilePrivacyStatus` | `public` `private` |
| routine `status` | `draft` `active` `stopped` |
| dayNames inside `dayFrequency` JSON string | `monday` `tuesday` `wednesday` `thursday` `friday` `saturday` `sunday` |
| calendar recurrence `rule` | `weekly` (only supported value so far) |
| calendar `scope` | `occurrence` `series` |
| finance transaction `type` | `income` `outcome` |
| finance `frequency` | `fixed` `variable` |
| finance `paymentFrequency` | `monthly` `bimonthly` `yearly` |
| movement `sourceType` | `transaction` `payment` `fixed` |
| subscription `sourceType` | `activity` `routine` |
| `followStatus` | `pending` `accepted` `none` |

Note: `dayFrequency` is a **string containing JSON** (e.g.
`"[\"monday\",\"friday\"]"`), not a JSON array, in both activities and routines —
company contract worth a dedicated serializer.

---

## 13. Non-paginated list endpoints

No list endpoint is paginated server-side except `/users/:username/followers`,
`/users/:username/following` (limit/offset), `finances/movements`
(limit/offset), and the implicit limits on `finances/transactions` (default
100) and `finances/payments` (default 100). **Everything else — activities,
today's activities, activity records, notes, note-groups, sticky-notes,
reminders, time records, calendar events, routines/me, fixed transactions,
categories, monthly-stats, follows/pending, subscriptions, users — returns the
full set** in one envelope with `count`. Mobile code must keep relying on
`count` only as a hint, and tolerate `data: null`.

---

## 14. Checklist for codegen

Common wrappers (shared file):

- [ ] `BackendListResponse<T>` `{ message: String, data: T?, count: Int }`
- [ ] `BackendSingleResponse<T>` `{ message: String?, data: T }`
- [ ] `PagedResponse<T>` `{ items: List<T>, total: Long, limit: Int, offset: Int, pages: Int }`
- [ ] `MovementsResponse<T>` `{ message: String, data: List<Movement>, count: Int, total: Int }`
- [ ] `MonthlyStatsResponse` `{ message: String, data: List<MonthlyStats>, year: Int }`
- [ ] `AuthEnvelope` `{ message: String, data: AuthData{ tokens: TokenResponse, user: UserResponse } }` (also tolerate `data: TokenResponse` directly on the degraded path)
- [ ] `TokenEnvelope` `{ message: String, data: TokenResponse }`
- [ ] `TokenResponse` `{ accessToken, refreshToken, tokenType, expiresIn: Long }`
- [ ] `ErrorResponse` `{ error: String?, details: String? }` (+ defensive `message` variant for note-group errors)
- [ ] `MessageOnly` `{ message: String }`
- [ ] `AvailabilityResponse` `{ available: Boolean, username: String?, email: String? }`

Enums: `Frequency`, `DayTime`, `PrivacyStatus`, `RoutineStatus`, `DayOfWeek`,
`RecurrenceRule`, `EventScope`, `TransactionType`, `TransactionFrequency`,
`PaymentFrequency`, `MovementSourceType`, `SubscriptionSourceType`,
`FollowStatus`.

### AuthApi
- [ ] `LoginRequest` `{ identifier, password }`
- [ ] `RegisterRequest` `{ email, password, firstName, lastName, username }` (+ optional `timezone` sent by app, ignored by server)
- [ ] `RefreshRequest` `{ refreshToken }`
- [ ] `UpdatePasswordRequest` `{ currentPassword, newPassword }`
- [ ] `UpdateEmailRequest` `{ password, newEmail }`
- [ ] `LogoutRequest` `{ refreshToken: String? }`

### ActivitiesApi
- [ ] `CreateActivityRequest` `{ title, description, completionAmount, frequency, dayFrequency?, dayTime }`
- [ ] `UpdateActivityRequest` `{ title?, description?, completionAmount?, frequency?, dayFrequency?, dayTime?, isActive?, privacyStatus? }`
- [ ] `ActivityResponse` (incl. `StreakInfo`, `RoutineRef`, `dayFrequency`-as-string)
- [ ] `RecordActivityRequest` `{ completionDate?, notes? }`
- [ ] `ActivityRecordResponse` (`id: String`)
- [ ] `ActivityStatsResponse`
- [ ] `RevertCompletionRequest` `{ targetDate? }`

### RoutinesApi
- [ ] `CreateRoutineRequest` `{ title, description, privacyStatus, status?, dayTime?, dayFrequency?, activityIds }`
- [ ] `UpdateRoutineRequest` (same, optional)
- [ ] `ActivityIDPosition` `{ activityId, position }`
- [ ] `RoutineResponse` (incl. `RoutineActivityItem`)

### RemindersApi
- [ ] `CreateReminderRequest` `{ title, description, dueAt, activeFrom?, privacyStatus? }`
- [ ] `UpdateReminderRequest` (same, optional)
- [ ] `ReminderResponse`

### TimeRecordsApi
- [ ] `CreateTimeRecordRequest` `{ category, description, durationMinutes }`
- [ ] `UpdateTimeRecordRequest` (same, optional)
- [ ] `TimeRecordResponse`
- [ ] `TimeStatsResponse`

### CalendarEventsApi
- [ ] `CreateCalendarEventRequest` `{ title, description, category, startAt, endAt, recurrence? }`
- [ ] `CalendarRecurrenceRequest` `{ rule, interval?, until? }`
- [ ] `UpdateCalendarEventRequest` `{ title?, description?, category?, startAt?, endAt?, scope? }`
- [ ] `CalendarEventResponse`

### NotesApi
- [ ] `CreateNoteRequest` `{ title, content }`
- [ ] `UpdateNoteRequest` `{ title?, content? }`
- [ ] `NoteResponse`
- [ ] `ReorderNotesRequest` `{ items: List<NotePositionItem> }`, `NotePositionItem` `{ id, groupId: Long?, position }`

### NoteGroupsApi
- [ ] `CreateNoteGroupRequest` `{ name }`
- [ ] `UpdateNoteGroupRequest` `{ name? }`
- [ ] `NoteGroupResponse`
- [ ] `ReorderNoteGroupsRequest` `{ items: List<NoteGroupPositionItem> }`, `NoteGroupPositionItem` `{ id, position }`

### StickyNotesApi
- [ ] `CreateStickyNoteRequest` `{ title?, description? }`
- [ ] `UpdateStickyNoteRequest` `{ title?, description? }`
- [ ] `StickyNoteResponse`

### FinancesApi
- [ ] `CreateTransactionRequest` `{ date?, type, frequency, paymentFrequency?, description?, amount, category }`
- [ ] `UpdateTransactionRequest` (same, optional)
- [ ] `TransactionResponse` (`id: String`)
- [ ] `FixedTransactionResponse`
- [ ] `PaymentSummary`
- [ ] `CreatePaymentRequest` `{ transactionId, amount, date? }`
- [ ] `PaymentResponse`
- [ ] `CategoryResponse`
- [ ] `MovementResponse`
- [ ] `FinanceSummaryResponse` + `CategorySummary`
- [ ] `MonthlyStatsResponse` + outer `MonthlyStatsEnvelope`

### FollowsApi
- [ ] `FollowResponse` `{ status }`
- [ ] `FollowerItem` `{ userId, username, firstName, lastName }`

### SubscriptionsApi
- [ ] `SubscribeRequest` `{ sourceType, sourceId }`
- [ ] `SubscriptionResponse` `{ id, sourceType, sourceId, clonedId }`

### UsersApi
- [ ] `UpdateUserRequest` `{ firstName?, lastName?, username?, profilePicUrl?, timezone?, profilePrivacyStatus? }`
- [ ] `UserResponse`
- [ ] `PublicUserCard`
- [ ] `SearchUsersQuery` params (`q`, `limit`)
- [ ] Multipart specs: `image` part (upload), `file` part (import)

### UsersApi (profile / social)
- [ ] `PublicProfileResponse` (extends PublicUserCard + counts + content lists)
- [ ] `PublicRoutineCard`
- [ ] `PublicActivityCard`
- [ ] `FollowerPage` → `PagedResponse<PublicUserCard>`

### DataApi
- [ ] `RestoreCounts`
- [ ] `ExportResponse` (binary w/ `Content-Disposition`)
