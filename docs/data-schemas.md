# Data Schemas

What the app stores and how the entities relate. Diagrams show **relationships only** — entities and their references; the JSON under each diagram carries the field-level detail. Shapes mirror the backend models (`backend/internal/domain/*/model/`) and the shared types in [`packages/shared/src/types/`](../packages/shared/src/types/). Storage split (what lives in PostgreSQL vs MongoDB) is in [backend.md](./backend.md#architecture).

Sections follow the same order as [backend.md](./backend.md), one per domain.

## Auth & user

```
+-------------------+ 1     1 +-------------------------+
|       User        |-------->|      Auth (pg)          |
|    (pg: users)    |  userId |  email, username        |
|  profile + privacy|         |  password_hash (bcrypt) |
+-------------------+         +-------------------------+

+-------------------------+
|  RefreshToken (pg)      |
|  userId, hashed token   |   server-side sessions → revocable
+-------------------------+
```

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
  "profilePrivacyStatus": "public"
}
```

- `password_hash` is never serialized.
- Refresh tokens are stored **hashed** (SHA-256) — password or email change invalidates existing sessions.
- `profilePrivacyStatus` gates content visibility (see [social](#social)).

## Activity (habits)

```
+-------------------------+ 1     * +---------------------------+
|      Activity (pg)      |-------->|    ActivityRecord (Mongo) |
|       id, userId        |activity |   activityId, userId      |
|  definition + schedule  |   Id    |   completionDate, notes   |
+-------------------------+         +---------------------------+
```

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
  "isActive": true
}
```

```json
{
  "id": "68f0c1a2e4b0a1b2c3d4e5f6",
  "activityId": 7,
  "userId": 1,
  "completionDate": "2026-01-15T08:30:00Z",
  "notes": "felt great"
}
```

- `frequency` is `daily` | `weekly` | `monthly` (one-time activities were removed in migration `000015`); `dayFrequency` names the weekdays for weekly; `dayTime` is `notSpecified` | `morning` | `afternoon` | `evening`.
- `completionAmount` is how many completions count as "done" for one day.

**How a completion works** — `POST /activities/:id/record` appends an `ActivityRecord` to Mongo. Everything the client sees on the activity is derived from those records, nothing extra is stored: `todayCompletions` counts today's records, `isCompletedToday` = `todayCompletions >= completionAmount`, and the streak is computed from the completion dates (separate algorithms per frequency).

## Reminder

One-time events with a deadline (`reminders`, Postgres). Stored:

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

- Status is derived client-side: `locked` (before `activeFrom`) → `active` → `missed` (past `dueAt`) / `completed`. Only `completedAt` is ever written on completion.

## Finance

All finance data lives in MongoDB. Categories are a fixed built-in catalog (12), not user data.

```
+-------------------------+          +----------------------------+
|   Transaction (Mongo)   | category |   Category (built-in, 12)  |
|      id, userId         |--------->|   type: income | outcome   |
|   type, frequency       |          |   applicableToFreq?:       |
+------------+------------+          |     fixed | variable       |
             | 1                     +----------------------------+
             | payments *
             v
+-------------------------+
|     Payment (Mongo)     |
|     transactionId       |
|     amount, date        |
+-------------------------+
```

Variable transaction (a single money event):

```json
{
  "id": "68f0c1a2e4b0a1b2c3d4e5f7",
  "userId": 1,
  "type": "outcome",
  "frequency": "variable",
  "amount": 42.5,
  "categoryName": "Food & Groceries",
  "description": "Weekly groceries",
  "date": "2026-01-15T12:00:00Z"
}
```

Payment (a concrete payment attached to a fixed transaction):

```json
{
  "id": "68f0b9e2e4b0a1b2c3d4e5f2",
  "transactionId": "68f0b9e2e4b0a1b2c3d4e5f1",
  "amount": 850,
  "date": "2026-01-05T10:00:00Z"
}
```

- `frequency` is `fixed` | `variable`; fixed transactions also carry `paymentFrequency` (`monthly` | `bimonthly` | `yearly`).

**How a fixed transaction works** — a fixed transaction is a template (e.g. rent, monthly), not a money event. Each payment creates a `Payment` pointing at it. `GetPeriodKey` maps a payment date to its period (`YYYY-MM` monthly, the 2-month block for bimonthly, `YYYY` yearly); the current period counts as paid when a payment falls in it. Two API views are derived on read, not stored:

- **FixedTransaction view** = template + `totalPaid` + `payments` + `currentPeriodPayment`.
- **Movement (feed)** = merged list of variable transactions, fixed payments, and pending fixed bills (`paid: false`) for the current period.

## Notes

```
+----------------------+ 1     * +------------------+
|   NoteGroup (pg)     |-------->|    Note (pg)     |
|  id, userId, name    | groupId?|  id, userId      |
|  position            |         |  title, content  |
+----------------------+         |  position        |
                                 +------------------+
```

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

- `groupId` is optional — ungrouped notes have `null` and mix into the same manual ordering.
- Both notes and groups are ordered by `position` (via `POST /notes/reorder` / `POST /note-groups/reorder`); moving a note in/out of a group is part of the same reorder payload.

## Time

Free-form time log (`time_records`, Postgres). No entity relationships — `category` is free text:

```json
{
  "id": 9,
  "userId": 1,
  "category": "Deep work",
  "description": "Docs refactor",
  "durationMinutes": 90
}
```

## Routine

```
+--------------------+ 1     * +---------------------------+ *     1 +------------+
|    Routine (pg)    |-------->|    routine_activities     |------->| Activity   |
|  id, userId        |routineId|  (routineId, activityId)  |activity|  (pg)      |
|  status, dayTime   |         |  composite PK + position  |   Id   +------------+
+--------------------+         +---------------------------+
```

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
    { "activityId": 7, "activityTitle": "Morning stretch", "position": 0, "scheduledToday": true }
  ],
  "isCompletedToday": false
}
```

- `status` is `draft` | `active` (default) | `stopped`.
- The join table is ordered by `position`; creation/update validates all referenced activities belong to the user.
- `isCompletedToday` is derived from its activities' completions.

## Social

```
+------------+  follower   +----------------------+  followee   +------------+
|    User    |------------>|     Follow (pg)      |------------>|    User    |
+------------+             |  (followerId,        |             +------------+
                           |   followeeId) PK     |
                           |  status, acceptedAt? |
                           +----------------------+

+------------+  subscribes to    +--------------------------+  clones to
+------------+                   |   Subscription (pg)      |   +--------------------+
|    User    |------------------>|  subscriberUserId        |   |  own copy of the   |
+------------+                   |  sourceType: activity |  |   |  source (clonedId) |
                                 |              routine     |   +--------------------+
                                 |  sourceId, clonedId      |
                                 +--------------------------+
```

```json
{
  "followerId": 1,
  "followeeId": 2,
  "status": "accepted",
  "acceptedAt": "2026-01-12T18:00:00Z"
}
```

```json
{
  "id": 12,
  "subscriberUserId": 1,
  "sourceUserId": 2,
  "sourceType": "activity",
  "sourceId": 7,
  "clonedId": 15
}
```

**How following works** — following creates a `pending` request, or `accepted` directly when the target profile is public. The owner accepts/rejects pending requests. Visibility is enforced server-side (`visibility.go`): private content is visible only to the owner and accepted followers — the public profile shell (card + counts) is always returned, with `canViewContent` flagging whether the content lists are populated.

**How subscriptions work** — subscribing to a public activity/routine **clones** it into the subscriber's space; `clonedId` points at the subscriber's own copy, so the source owner's edits don't propagate.

## Screen time

```
+---------------------------+
|    WebVisit (Mongo)       |
|    userId, domain         |
|    visitedAt              |
+---------------------------+
```

```json
{
  "id": "68f0c3aae4b0a1b2c3d4e5f9",
  "userId": 1,
  "domain": "github.com",
  "visitedAt": "2026-01-15T14:22:00Z"
}
```

- Written by the Chrome extension (`POST /screen-time/visits`).
- **No duration is stored** — stats aggregate visit counts per domain (`GET /screen-time/stats`).
