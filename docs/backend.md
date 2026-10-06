# Life Tracker Backend

Go (Gin) REST API for the Life Tracker platform: authentication, user profiles, habits & activities, finances, notes, time tracking, routines, social, and screen time.

This doc covers the backend **logic only** — domain models/schemas, business rules, and the HTTP API. For how the app is built, deployed, and run (AWS-shaped stack, floci emulation), see [architecture.md](./architecture.md) and [deployment-modes.md](./deployment-modes.md). For run commands, see [getting-started.md](./getting-started.md).

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
├── infrastructure/   ← cross-cutting: image storage (S3), secrets, pagination, monitoring
└── middleware/       ← JWT auth, CORS, timezone, metrics
```

**Storage split**

| Storage | Domains | Why |
|---|---|---|
| PostgreSQL (GORM) | auth, user, activity, note, time, routine, social | Relational, relational queries (follows, subscriptions, ownership) |
| MongoDB (mongo-driver) | activity records, finance (transactions/payments), screentime visits | Document data, write-heavy time-series-like records |

Migrations are versioned SQL files under `internal/database/migrations/` (naming convention `{6-digit-number}_{description}.{up|down}.sql`).

---

## Tech Stack

- **Go** (Gin HTTP framework)
- **GORM** — PostgreSQL ORM
- **mongo-driver** — MongoDB client
- **JWT** — access & refresh token auth
- **bcrypt** — password hashing
- **godotenv** — env file loading

---

## Domain Modules

### Auth — `domain/auth`

Credentials live in the `auth` table; profiles in the `user` table (1:1 via `userId`).

**Schema**

| Field | Type | Notes |
|---|---|---|
| id | uint | PK |
| user_id | uint | FK to user |
| email | string | unique, not null |
| username | string | unique, not null, max 64 |
| password_hash | string | never serialized |

**Logic**
- `POST register` — validates uniqueness (email/username), hashes password (bcrypt), creates auth + user records, returns token pair.
- `POST login` — verifies credentials, returns **access token** (short-lived JWT) + **refresh token**.
- `POST refresh` — validates the refresh token and issues a new token pair (rotation).
- `PUT password` / `PUT email` — protected; email change re-issues tokens. Tokens embed `userId`, `email`, and expiry.

### User — `domain/user`

**Schema** (`user` table)

| Field | Type | Notes |
|---|---|---|
| id | uint | PK |
| first_name / last_name | string | not null |
| profile_pic_url / thumbnail_url | string * | from image upload |
| timezone | string * | IANA name; fallback UTC |
| profile_privacy_status | string | `public` (default) \| `private` |

**Logic**
- Profile CRUD, username update with format validation + availability check.
- Profile image upload/delete — stored via the image store (S3) with thumbnail generation.
- Username/email availability checks used by the frontend during registration.
- Prefix search over users (public profile cards).

### Activity (Habits) — `domain/activity`

Activity definitions live in PostgreSQL; **completion records in MongoDB**.

**Schema** (`activities` table)

| Field | Type | Notes |
|---|---|---|
| id / user_id | uint | PK / FK |
| title, description | string | title max 255 |
| frequency | enum | `daily` \| `weekly` \| `monthly` |
| day_frequency | string | optional text (e.g. specific weekdays) |
| day_time | enum | `notSpecified` \| `morning` \| `afternoon` \| `evening` |
| privacy_status | enum | `public` \| `private` (default) |
| completion_amount | int | required completions to count as done (default 1) |
| is_active | bool | soft toggle, default false |

`ActivityRecord` (Mongo): `activityId`, `userId`, `completionDate`, `notes`.

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

**Schema**

| Field | Type | Notes |
|---|---|---|
| title, description | string | title max 255 |
| due_at | timestamptz | deadline, required |
| active_from | timestamptz | optional; defaults to now (completion window) |
| completed_at | timestamptz | set on completion |
| privacy_status | enum | `public` \| `private` (default) |

**Logic**
- Status is derived client-side (`getReminderStatus`): `locked` (before `activeFrom`) → `active` → `missed` (past `dueAt`) / `completed`.
- Creating/updating enforces `active_from` before `due_at`.
- Complete/revert only set/clear `completed_at`.

### Finance — `domain/finance`

All finance data lives in MongoDB. Categories are a fixed built-in catalog.

**Built-in categories** (12) — income: `Primary Income`, `Side Income`, `Investments`, `Other Income`; outcome: `Housing & Utilities`, `Food & Groceries`, `Transportation`, `Health & Fitness`, `Education`, `Entertainment & Travel`, `Taxes & Fees`, `Pets & Misc`. Each has a type (`income`/`outcome`) and applies to a frequency (`fixed`/`variable`).

**Schemas**

`Transaction` (Mongo)

| Field | Type | Notes |
|---|---|---|
| type | enum | `income` \| `outcome` |
| frequency | enum | `fixed` \| `variable` |
| payment_frequency | enum | `monthly` \| `bimonthly` \| `yearly` (fixed only) |
| amount | float | |
| category | string | one of the built-in categories |
| description | string | optional |
| date | time | |

`Payment` (Mongo): `transactionId`, `amount`, `date` — a concrete payment event attached to a fixed transaction.

**Logic**
- **Transactions** — variable transactions are single events; fixed transactions are templates that accrue payments over time.
- **Period bucketing** — `GetPeriodKey` maps a payment date to its period key (`YYYY-MM` for monthly, `YYYY-MM` of the 2-month block for bimonthly, `YYYY` for yearly), used to determine whether the current period is paid.
- **Fixed transaction view** — returns the fixed template plus `totalPaid`, the payment list, and the current-period payment.
- **Movements feed** — paginated, filterable list (type, category, date range, month/year).
- **Summary** — totals by category and type over a date range.
- **Monthly stats** — per-month aggregates for a year.

### Note — `domain/note`

**Schema** (`notes` table): `id`, `userId`, `title` (max 255), `content` (text).

Simple CRUD + filtering (title/content search).

### Time — `domain/time`

**Schema** (`time_records` table)

| Field | Type | Notes |
|---|---|---|
| category | string | max 100, not null |
| description | string | |
| duration_minutes | int | not null |

CRUD with filter support, plus `GET /stats` aggregating total time per category.

### Routine — `domain/routine`

**Schemas** (`routines` + join table `routine_activities`)

| Field | Type | Notes |
|---|---|---|
| title, description | string | title max 255 |
| privacy_status | enum | `public` \| `private` (default) |
| routine_activities | (routine_id, activity_id) composite PK | ordered by `position` |

**Logic**
- A routine is an ordered collection of the owner's activities.
- Creation/update validates that all referenced activities belong to the user (`validateActivitiesOwnership`).
- Public routines can be listed for other users.

### Social — `domain/social`

**Schemas** (`follows`, `subscriptions`)

`Follow` — composite PK `(follower_id, followee_id)`; `status` `pending` \| `accepted`; `acceptedAt` nullable.

`Subscription` — `subscriberUserId`, `sourceUserId`, `sourceType` (`activity` \| `routine`), `sourceId`, `clonedId`.

**Logic**
- **Follow system** — request/accept flow: follow creates a `pending` request (or `accepted` if the target profile is public), the owner accepts/rejects, and followers/following lists are paginated.
- **Visibility** — `visibility.go` enforces profile/content privacy: private content is only visible to the owner or accepted followers.
- **Subscriptions** — subscribe to another user's public activity or routine; the subscription clones the source into the subscriber's space (`clonedId`).

### Screen Time — `domain/screentime`

**Schema** (`web_visits`, Mongo): `userId`, `domain`, `visitedAt`.

- `POST /visits` — records a visit (from the Chrome extension).
- `GET /visits` — filterable by domain and date range.
- `GET /stats` — aggregate time per domain.

---

## API Reference

All routes are mounted under the `/api` prefix. "Public" routes need no token; "Protected" routes require `Authorization: Bearer <access_token>`.

### Auth — `/api/auth`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /auth/register | Public | Create account, returns token pair |
| POST | /auth/login | Public | Login, returns token pair |
| POST | /auth/refresh | Public | Rotate refresh token |
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
| DELETE | /users/:id | Protected | Delete user |
| GET | /users/check-username?username= | Public | Username availability |
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

### Screen Time — `/api/screen-time`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /screen-time/visits | Protected | Record a web visit |
| GET | /screen-time/visits | Protected | List visits (domain/date filters) |
| GET | /screen-time/stats | Protected | Aggregate time per domain |

### System

| Method | Path | Description |
|---|---|---|
| GET | /health | Service health incl. PostgreSQL + MongoDB status |
| GET | /metrics | Prometheus metrics |

Postman collections for all domains are available in `../backend/postman/`.

---

## License

MIT — see `LICENSE`.
