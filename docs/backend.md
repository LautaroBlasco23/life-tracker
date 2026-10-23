# Life Tracker Backend

Go (Gin) REST API for the Life Tracker platform: authentication, user profiles, habits & activities, reminders, finances, notes & note groups, time tracking, routines, social, screen time, and full-account data export/import.

This doc covers the backend **logic only** — business rules and the HTTP API. For how the app is built, deployed, and run (container stack), see [architecture.md](./architecture.md) and [deployment-modes.md](./deployment-modes.md). For run commands, see [getting-started.md](./getting-started.md). For the data model (what is stored and how it relates), see [data-schemas.md](./data-schemas.md).

---

## Architecture

Domain-driven structure: each domain is self-contained with its own controller, service, repository, model, DTOs, and routes. The HTTP layer (controller) depends on the business layer (service), which depends on the data layer (repository). Models map to storage: **GORM structs for PostgreSQL** and **BSON structs for MongoDB**.

```
internal/
├── domain/{domain}/
│   ├── controller/   ← HTTP handlers (parse requests, map DTOs)
│   ├── service/      ← business logic
│   ├── repository/   ← data access (GORM / mongo-driver)
│   ├── model/        ← DB structs + domain enums
│   ├── dto/          ← request/response types
│   └── routes/       ← route registration
├── config/           ← env-based configuration
├── database/         ← connections + versioned SQL migrations
├── infrastructure/   ← cross-cutting: image storage (S3), secrets (incl. AWS Secrets
│                        Manager for the prod JWT secret), pagination, monitoring
└── middleware/       ← JWT auth, CORS, timezone, rate limiting, body limits,
                        security headers, recovery, request ID, request logging, metrics
```

**Storage split**

| Storage | Domains | Why |
|---|---|---|
| PostgreSQL (GORM) | auth (+ refresh tokens), user, activity, reminder, note, note-group, time, routine, social | Relational, relational queries (follows, subscriptions, ownership) |
| MongoDB (mongo-driver) | activity records, finance (transactions/payments), screentime visits (also read by `data` for export) | Document data, write-heavy time-series-like records |

Migrations are versioned SQL files under `internal/database/migrations/` (naming convention `{6-digit-number}_{description}.{up|down}.sql`).

---

## Tech Stack

- **Go** (Gin HTTP framework)
- **GORM** — PostgreSQL ORM
- **mongo-driver** — MongoDB client
- **JWT** — access & refresh token auth
- **bcrypt** — password hashing
- **godotenv** — env file loading
- **golang-migrate** — embedded versioned SQL migrations (run on every API start)
- **excelize** — Excel export/import (`data` domain)
- **AWS SDK** — S3 image storage + Secrets Manager (prod JWT secret; LocalStack emulator in dev via `AWS_ENDPOINT_URL`)
- **prometheus client_golang** — `/metrics`

---

## Domain Modules

Each domain below shows its main resource as JSON — one representative request + response. The examples are illustrative (optional fields may be omitted); the full shapes live in the domain DTOs (`internal/domain/<domain>/dto/`), and the data model is documented in [data-schemas.md](./data-schemas.md).

### Auth — `domain/auth`

Credentials live in the `auth` table; profiles in the `user` table (1:1 via `userId`).

**Refresh tokens** are also stored **server-side** (`refresh_tokens` table, SHA-256 hashed) so sessions are revocable: password or email change invalidates existing sessions.

**Example** — `POST /auth/register` request:

```json
{
  "email": "ada@example.com",
  "password": "correct-horse-battery",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "username": "ada"
}
```

Register, login, and refresh all return a token pair:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "b7c1d9f04e2a...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

**Logic**
- `POST register` — validates uniqueness (email/username), hashes password (bcrypt), creates auth + user records, returns token pair.
- `POST login` — verifies credentials (by email **or** username via `identifier`), returns **access token** (short-lived JWT) + **refresh token** (persisted server-side).
- `POST refresh` — validates the refresh token and issues a new token pair (rotation).
- `POST logout` — revokes the server-side refresh token.
- `PUT password` / `PUT email` — protected; email change re-issues tokens and revokes old sessions. Tokens embed `userId`, `email`, and expiry.

### User — `domain/user`

**Example** — `GET /users/me` response:

```json
{
  "id": 1,
  "username": "ada",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "email": "ada@example.com",
  "profilePicUrl": "https://cdn.example.com/ada.jpg",
  "thumbnailUrl": "https://cdn.example.com/ada-sm.jpg",
  "timezone": "America/Argentina/Buenos_Aires",
  "profilePrivacyStatus": "public",
  "createdAt": "2026-01-10T09:00:00Z",
  "updatedAt": "2026-01-15T10:30:00Z"
}
```

**Logic**
- Profile CRUD, username update with format validation + availability check.
- Profile image upload/delete — stored via the image store (S3) with thumbnail generation.
- Username/email availability checks used by the frontend during registration.
- Prefix search over users (public profile cards).

### Activity (Habits) — `domain/activity`

Activity definitions live in PostgreSQL; **completion records in MongoDB**.

**Example** — `POST /activities` request:

```json
{
  "title": "Morning stretch",
  "description": "10 minutes of mobility work",
  "frequency": "weekly",
  "dayFrequency": "mon,wed,fri",
  "dayTime": "morning",
  "completionAmount": 1
}
```

Response (with `GET /activities/:id/stats` adding the streak/records block):

```json
{
  "id": 7,
  "userId": 1,
  "title": "Morning stretch",
  "description": "10 minutes of mobility work",
  "frequency": "weekly",
  "dayFrequency": "mon,wed,fri",
  "dayTime": "morning",
  "completionAmount": 1,
  "privacyStatus": "private",
  "isActive": true,
  "todayCompletions": 1,
  "isCompletedToday": true,
  "streak": { "current": 12, "longest": 21 },
  "routines": [{ "id": 3, "title": "Morning routine" }]
}
```

`todayCompletions`, `isCompletedToday`, `streak`, and `routines` are computed, not stored — see [data-schemas.md](./data-schemas.md#activity-habits).

Recording a completion — `POST /activities/:id/record` (`completionDate` optional, defaults to now):

```json
{ "completionDate": "2026-01-15T08:30:00Z", "notes": "felt great" }
```

```json
{
  "id": "68f0c1a2e4b0a1b2c3d4e5f6",
  "activityId": 7,
  "userId": 1,
  "completionDate": "2026-01-15T08:30:00Z",
  "notes": "felt great",
  "createdAt": "2026-01-15T08:30:00Z"
}
```

**Logic**
- CRUD with a dynamic update map (only provided fields change).
- **Record completion** — idempotency per day handled by `completionAmount`; `todayCompletions` and `isCompletedToday` are computed from the records.
- **Scheduling** — `shouldShowToday` decides if an activity is due today based on frequency, day frequency, and time-of-day.
- **Streaks** — `CalculateStreak` computes current + longest streak and completion rate, with separate algorithms for daily / weekly / monthly frequencies.
- **Stats** — total completions, current/longest streak, completion rate, recent records.
- **Revert** — removes the last completion (optionally for a target date).
- Public activities can be listed for other users (used by social subscriptions).

### Reminder — `domain/reminder`

One-time events with a deadline. In Postgres (`reminders` table).

**Example** — `POST /reminders` request:

```json
{
  "title": "Renew passport",
  "description": "Book the appointment",
  "dueAt": "2026-02-01T12:00:00Z",
  "activeFrom": "2026-01-20T00:00:00Z"
}
```

Response (adds the server-set fields):

```json
{
  "id": 5,
  "userId": 1,
  "title": "Renew passport",
  "description": "Book the appointment",
  "dueAt": "2026-02-01T12:00:00Z",
  "activeFrom": "2026-01-20T00:00:00Z",
  "completedAt": null,
  "privacyStatus": "private"
}
```

**Logic**
- Status is derived client-side (`getReminderStatus`): `locked` (before `activeFrom`) → `active` → `missed` (past `dueAt`) / `completed`.
- Creating/updating enforces `active_from` before `due_at`.
- Complete/revert only set/clear `completed_at`.

### Finance — `domain/finance`

All finance data lives in MongoDB. Categories are a fixed built-in catalog.

**Built-in categories** (12) — income: `Primary Income`, `Side Income`, `Investments`, `Other Income`; outcome: `Housing & Utilities`, `Food & Groceries`, `Transportation`, `Health & Fitness`, `Education`, `Entertainment & Travel`, `Taxes & Fees`, `Pets & Misc`. Each has a type (`income`/`outcome`) and applies to a frequency (`fixed`/`variable`).

**Example** — `POST /finances/transactions` (variable transaction) request:

```json
{
  "type": "outcome",
  "frequency": "variable",
  "amount": 42.5,
  "category": "Food & Groceries",
  "description": "Weekly groceries",
  "date": "2026-01-15T12:00:00Z"
}
```

Response:

```json
{
  "id": "68f0c1a2e4b0a1b2c3d4e5f7",
  "type": "outcome",
  "frequency": "variable",
  "amount": 42.5,
  "categoryName": "Food & Groceries",
  "description": "Weekly groceries",
  "date": "2026-01-15T12:00:00Z"
}
```

Recording a payment for a fixed transaction — `POST /finances/payments`:

```json
{ "transactionId": "68f0b9e2e4b0a1b2c3d4e5f1", "amount": 850, "date": "2026-01-05T10:00:00Z" }
```

The movements feed (`GET /finances/movements`) merges variable transactions, fixed payments, and pending fixed bills into one list:

```json
{
  "id": "68f0b9e2e4b0a1b2c3d4e5f2",
  "sourceType": "payment",
  "type": "outcome",
  "amount": 850,
  "category": "Housing & Utilities",
  "date": "2026-01-05T10:00:00Z",
  "paid": true,
  "transactionId": "68f0b9e2e4b0a1b2c3d4e5f1"
}
```

**Logic**
- **Transactions** — variable transactions are single events; fixed transactions are templates that accrue payments over time.
- **Period bucketing** — `GetPeriodKey` maps a payment date to its period key (`YYYY-MM` for monthly, `YYYY-MM` of the 2-month block for bimonthly, `YYYY` for yearly), used to determine whether the current period is paid.
- **Fixed transaction view** — returns the fixed template plus `totalPaid`, the payment list, and the current-period payment.
- **Movements feed** — paginated, filterable list (type, category, date range, month/year).
- **Summary** — totals by category and type over a date range.
- **Monthly stats** — per-month aggregates for a year.

### Note — `domain/note`

**Example** — `POST /notes` request:

```json
{ "title": "Book ideas", "content": "## To read\n- The Pragmatic Programmer" }
```

Response:

```json
{
  "id": 4,
  "userId": 1,
  "title": "Book ideas",
  "content": "## To read\n- The Pragmatic Programmer",
  "groupId": 2,
  "position": 3
}
```

Manual ordering — `POST /notes/reorder`:

```json
{
  "items": [
    { "id": 4, "groupId": 2, "position": 0 },
    { "id": 5, "groupId": null, "position": 1 }
  ]
}
```

**Logic**

CRUD + filtering (title/content search), plus `POST /notes/reorder` for manual ordering.

### Note Group — `domain/note-group`

Notes can be grouped. Full CRUD over `note_groups` (`id`, `userId`, `name`, `position`), plus `POST /note-groups/reorder`:

```json
{
  "items": [
    { "id": 2, "position": 0 },
    { "id": 1, "position": 1 }
  ]
}
```

### Time — `domain/time`

**Example** — `POST /time-records` request:

```json
{ "category": "Deep work", "description": "Docs refactor", "durationMinutes": 90 }
```

Response:

```json
{
  "id": 9,
  "category": "Deep work",
  "description": "Docs refactor",
  "durationMinutes": 90,
  "createdAt": "2026-01-15T14:00:00Z",
  "updatedAt": "2026-01-15T14:00:00Z"
}
```

**Logic**

CRUD with filter support, plus `GET /stats` aggregating total time per category.

### Routine — `domain/routine`

**Example** — `POST /routines` request (ordered activity references):

```json
{
  "title": "Morning routine",
  "description": "Start the day right",
  "privacyStatus": "private",
  "dayTime": "morning",
  "dayFrequency": "mon,tue,wed,thu,fri",
  "activityIds": [
    { "activityId": 7, "position": 0 },
    { "activityId": 9, "position": 1 }
  ]
}
```

Response (activities expanded inline):

```json
{
  "id": 3,
  "userId": 1,
  "title": "Morning routine",
  "description": "Start the day right",
  "status": "active",
  "privacyStatus": "private",
  "dayTime": "morning",
  "dayFrequency": "mon,tue,wed,thu,fri",
  "activities": [
    {
      "activityId": 7,
      "activityTitle": "Morning stretch",
      "position": 0,
      "todayCompletions": 1,
      "scheduledToday": true
    }
  ],
  "isCompletedToday": false
}
```

**Logic**
- A routine is an ordered collection of the owner's activities.
- Creation/update validates that all referenced activities belong to the user (`validateActivitiesOwnership`).
- Public routines can be listed for other users.

### Social — `domain/social`

**Example** — subscribing to a public activity (`POST /subscriptions`):

```json
{ "sourceType": "activity", "sourceId": 7 }
```

```json
{ "id": 12, "sourceType": "activity", "sourceId": 7, "clonedId": 15 }
```

Public profile view (`GET /users/:username/profile`) — content is only populated when the viewer may see it:

```json
{
  "id": 2,
  "username": "grace",
  "firstName": "Grace",
  "lastName": "Hopper",
  "profilePrivacyStatus": "public",
  "followStatus": "accepted",
  "isFollowing": true,
  "followersCount": 18,
  "followingCount": 4,
  "canViewContent": true,
  "activities": [
    { "id": 7, "title": "5k run", "frequency": "daily", "completionAmount": 1, "subscribed": false }
  ],
  "routines": []
}
```

**Logic**
- **Follow system** — request/accept flow: follow creates a `pending` request (or `accepted` if the target profile is public), the owner accepts/rejects, and followers/following lists are paginated.
- **Visibility** — `visibility.go` enforces profile/content privacy: private content is only visible to the owner or accepted followers.
- **Subscriptions** — subscribe to another user's public activity or routine; the subscription clones the source into the subscriber's space (`clonedId`).

### Screen Time — `domain/screentime`

**Schema** (`web_visits`, Mongo): `userId`, `domain`, `visitedAt`.

**Example** — `POST /screen-time/visits` (from the Chrome extension):

```json
{ "domain": "github.com", "visitedAt": "2026-01-15T14:22:00Z" }
```

Stats (`GET /screen-time/stats`) aggregate visit counts per domain:

```json
{ "domain": "github.com", "count": 142 }
```

**Logic**
- `POST /visits` — records a visit (from the Chrome extension).
- `GET /visits` — filterable by domain and date range.
- `GET /stats` — aggregate **visit count** per domain (the model stores no duration).

### Data — `domain/data`

Full-account backup: **Excel export/import** of the user's data (excelize), reading from PostgreSQL + MongoDB collections.

- `GET /users/me/data/export` — produces an Excel workbook of all the user's records.
- `POST /users/me/data/import` — imports an uploaded workbook (body capped by `MaxBodyBytes` config, ~32 MB).

Consumed by both clients via the shared `data-service` (`packages/shared/src/services/`).

---

## API Reference

All routes are mounted under the `/api` prefix. "Public" routes need no token; "Protected" routes require `Authorization: Bearer <access_token>`.

### Auth — `/api/auth`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /auth/register | Public | Create account, returns token pair |
| POST | /auth/login | Public | Login, returns token pair |
| POST | /auth/refresh | Public | Rotate refresh token |
| POST | /auth/logout | Protected | Revoke the refresh token (session) |
| PUT | /auth/password | Protected | Update password |
| PUT | /auth/email | Protected | Update email, re-issues tokens |

### User — `/api/users`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | /users/me | Protected | Own profile |
| PUT | /users/me | Protected | Update profile |
| POST | /users/me/image | Protected | Upload profile image |
| DELETE | /users/me/image | Protected | Delete profile image |
| GET | /users | Protected | List users |
| GET | /users/search?prefix= | Protected | Prefix search |
| GET | /users/:username | Protected | Get profile by username |
| GET | /users/check-username?username= | Public | Username availability (rate-limited) |
| GET | /users/check-email?email= | Public | Email availability |

### Activity — `/api/activities`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /activities | Protected | Create activity |
| GET | /activities | Protected | List activities (optionally incl. inactive) |
| GET | /activities/today | Protected | Activities due today |
| GET | /activities/:id | Protected | Get activity |
| PUT | /activities/:id | Protected | Update activity |
| DELETE | /activities/:id | Protected | Delete activity |
| POST | /activities/:id/record | Protected | Record a completion |
| GET | /activities/:id/records | Protected | Completion history |
| GET | /activities/:id/stats | Protected | Completions + streak stats |
| DELETE | /activities/:id/revert | Protected | Revert last completion |

**Extra:** `GET /activities/streak` — global streak across all the user's activities.

### Reminder — `/api/reminders`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /reminders | Protected | Create reminder |
| GET | /reminders | Protected | List reminders |
| GET | /reminders/:id | Protected | Get reminder |
| PUT | /reminders/:id | Protected | Update reminder |
| DELETE | /reminders/:id | Protected | Delete reminder |
| POST | /reminders/:id/complete | Protected | Mark completed |
| DELETE | /reminders/:id/complete | Protected | Revert completion |

### Finance — `/api/finances`

| Method | Path | Access | Description |
|---|---|---|---|
| GET | /finances/categories | Protected | Built-in categories (filterable by type/frequency) |
| POST | /finances/transactions | Protected | Create transaction |
| GET | /finances/transactions | Protected | List transactions (type/frequency/date/category filters) |
| GET | /finances/transactions/:id | Protected | Get transaction |
| PUT | /finances/transactions/:id | Protected | Update transaction |
| DELETE | /finances/transactions/:id | Protected | Delete transaction |
| GET | /finances/fixed-transactions | Protected | Fixed templates with payments for a period |
| GET | /finances/fixed-transactions/:id | Protected | Fixed template detail |
| GET | /finances/movements | Protected | Paginated movements feed |
| POST | /finances/payments | Protected | Create payment for a fixed transaction |
| GET | /finances/payments | Protected | List payments |
| DELETE | /finances/payments/:id | Protected | Delete payment |
| GET | /finances/summary | Protected | Totals by category over a date range |
| GET | /finances/monthly-stats | Protected | Per-month aggregates for a year |

### Note — `/api/notes`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /notes | Protected | Create note |
| GET | /notes | Protected | List notes (filterable) |
| GET | /notes/:id | Protected | Get note |
| PUT | /notes/:id | Protected | Update note |
| DELETE | /notes/:id | Protected | Delete note |
| POST | /notes/reorder | Protected | Manual note ordering |

### Note Group — `/api/note-groups`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /note-groups | Protected | Create group |
| GET | /note-groups | Protected | List groups |
| GET | /note-groups/:id | Protected | Get group |
| PUT | /note-groups/:id | Protected | Update group |
| DELETE | /note-groups/:id | Protected | Delete group |
| POST | /note-groups/reorder | Protected | Manual group ordering |

### Time — `/api/time-records`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /time-records | Protected | Create time record |
| GET | /time-records | Protected | List records (filterable) |
| GET | /time-records/stats | Protected | Total time per category |
| GET | /time-records/:id | Protected | Get record |
| PUT | /time-records/:id | Protected | Update record |
| DELETE | /time-records/:id | Protected | Delete record |

### Routine — `/api/routines`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /routines | Protected | Create routine |
| GET | /routines/me | Protected | My routines |
| GET | /routines/:id | Protected | Get routine |
| PATCH | /routines/:id | Protected | Update routine |
| DELETE | /routines/:id | Protected | Delete routine |

### Social

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /follows/:username | Protected | Follow user |
| DELETE | /follows/:username | Protected | Unfollow user |
| GET | /follows/pending | Protected | Pending follow requests |
| POST | /follows/pending/:followerId/accept | Protected | Accept request |
| POST | /follows/pending/:followerId/reject | Protected | Reject request |
| GET | /users/:username/followers | Protected | Follower list |
| GET | /users/:username/following | Protected | Following list |
| POST | /subscriptions | Protected | Subscribe to a public activity/routine |
| GET | /subscriptions | Protected | My subscriptions |
| DELETE | /subscriptions/:id | Protected | Unsubscribe |
| GET | /users/:username/profile | Public | Public profile view |

### Screen Time — `/api/screen-time`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /screen-time/visits | Protected | Record a web visit |
| GET | /screen-time/visits | Protected | List visits (domain/date filters) |
| GET | /screen-time/stats | Protected | Aggregate visit count per domain |

### System

| Method | Path | Description |
|---|---|---|
| GET | /health | Service health incl. PostgreSQL + MongoDB status |
| GET | /metrics | Prometheus metrics |

Postman collections for a subset of domains (activities, authentication, finances, health, routines, users) are available in `../backend/postman/`. CI uploads plain per-domain JSON endpoint files from `backend/endpoints/` as an artifact instead (see [ci-cd.md](./ci-cd.md)).

---

## License

MIT — see `LICENSE`.
