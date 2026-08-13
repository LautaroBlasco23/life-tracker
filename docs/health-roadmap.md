# Health Section — Roadmap

Feature plan for the Health section (Nutrition + Gym tabs). Tracks what is shipped and what is planned next.

## MVP (implemented)

### Nutrition
- [x] Free-form meal log: breakfast / lunch / dinner / snack entries with calories, protein, carbs, fat
- [x] Daily totals cards (calories / protein / carbs / fat)
- [x] Weekly calories summary chart (per-day totals, user timezone)
- [x] Create / edit / delete meals

### Gym
- [x] Exercise catalog per user with muscle groups (chest, back, shoulders, biceps, triceps, forearms, abs, quads, hamstrings, glutes, calves, traps)
- [x] Workout sessions with exercises and sets (reps + weight kg)
- [x] Muscle volume chart (kg moved per muscle group in period)
- [x] Weekly volume trend chart
- [x] Create / edit / delete exercises and sessions

### Data
- [x] MongoDB collections: `meal_logs`, `exercises`, `workout_sessions` (all scoped by `userId`)
- [x] Timezone-aware day bucketing (`X-Timezone` header pattern, same as finance)
- [x] Indexes: `meal_logs {userId, date:-1}`, `exercises {userId, name}`, `workout_sessions {userId, date:-1}`

## Improvement backlog

Prioritized ideas. Pick the next one when the MVP is stable.

### High value
- [ ] **Daily calorie / macro goals** — per-user targets stored with the user or in settings; progress bars against goals on the nutrition tab
- [ ] **Food catalog** — predefined foods (name + macros per serving) with search, favorites, and quick-add; meal entries reference catalog items
- [ ] **Body weight & measurements** — daily weight, optional body-fat / waist; trend chart alongside calorie intake
- [ ] **Per-exercise history + PR tracking** — best set per exercise, 1RM estimate (Epley), progressive-overload detection
- [ ] **Workout templates / splits** — named templates (e.g. Push / Pull / Legs) to start a session from; possible reuse of the existing `routine` domain (Postgres) or a new Mongo template collection
- [ ] **Exercise deletion safety** — block deletion while referenced by sessions, or soft-delete / cascade with re-linking; currently stale references render as "Unknown exercise"

### Medium value
- [ ] **Active workout mode** — start a session with a rest timer between sets
- [ ] **Meal plan / recipe manager** — reusable meal definitions grouped into daily plans
- [ ] **Muscle balance radar** — coverage analysis per week to spot neglected groups
- [ ] **Data export** — CSV/JSON export of meal logs and workouts
- [ ] **Backfill tools** — bulk-add past meals/workouts from a text or CSV paste
- [ ] **Theme-aware charts** — adopt the unused shadcn `ChartContainer` wrapper (finance dashboard currently hard-codes chart colors)
- [ ] **Nutrition aggregation in Mongo** — currently the gym stats are computed in Go; move to aggregation pipelines if they get slow (watch DocumentDB `$lookup`/`$unwind` support)

### Low priority / long-term
- [ ] **Photo food logging** — camera + AI macro estimation per meal
- [ ] **Chrome extension quick-log** — one-click meal or workout entry from the browser (chrome-extension project exists)
- [ ] **Social fitness** — share workouts / compare volume with friends (social domain exists)
- [ ] **Wearable / Apple Health import** — heart rate, sleep, steps into the health domain
- [ ] **Multi-unit support** — lb for weight, imperial vs metric toggle
