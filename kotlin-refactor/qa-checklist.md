# Mobile QA Checklist — Kotlin rewrite acceptance/parity gate

A screen rewrite is done only when every item in its section passes. Run every
check in both languages (es/en) and both themes (light/dark) unless noted.
Source of truth: `apps/mobile/` in this repo.

## Auth & entry (index.tsx, login.tsx, register.tsx)

- [ ] Logged-out app launch lands on `/login`; logged-in launch lands on `/activities` (index redirect).
- [ ] Login button disabled until both fields non-empty; shows "Signing in…" while loading.
- [ ] Login with wrong credentials shows an inline error message; form values survive.
- [ ] Login with username OR with email both work.
- [ ] Success navigates to `/activities` (back button does not return to login).
- [ ] Language toggle button (top-right) flips all login labels es↔en instantly without reload.
- [ ] "Sign up" link opens register; back link from register opens login.
- [ ] Register is a single form (not multi-step): firstName, lastName, username, email, password, confirmPassword all visible at once.
- [ ] Submit button disabled until all 6 fields non-empty.
- [ ] Username prefilled with 3+ chars shows a "checking" → "available"/"taken" state (500 ms debounce); taken shows inline error.
- [ ] Valid email shows "available"/"taken" after 500 ms debounce; invalid email shows no status.
- [ ] Password < 8 chars → submit blocked with "too short" error.
- [ ] Passwords don't match → submit blocked with mismatch error (mismatch checked before length).
- [ ] Server registration error appears inline; loader stops.
- [ ] Successful register lands on `/activities`.
- [ ] Password fields are masked; identifier/username not auto-capitalized.

## Activities (app/(app)/activities.tsx)

- [ ] Full-screen spinner on first load; group headers only for non-empty categories (Any moment/Morning/Afternoon/Evening), in that order.
- [ ] Global streak banner visible when streak > 0 (badge + current + longest text); absent at 0.
- [ ] Empty state: "no activities today" text + "Create first activity" button → opens create modal.
- [ ] Load failure shows inline error text; reminders failing to load never blocks the activity list.
- [ ] Tap card → +1 completion immediately (optimistic progress `n/m`); reaching target turns card green and bumps streak badge.
- [ ] Tap an already-completed activity → toast "already completed", count unchanged.
- [ ] Revert optimistic change on server error: card restores previous count + destructive toast.
- [ ] Long-press card → menu: Edit, Revert last (only if completions > 0), Delete (destructive), Cancel.
- [ ] "Revert last" decrements count; decrementing below target un-greens the card.
- [ ] Delete → confirmation modal (name shown); confirm removes the card. If server fails: toast keeps card, modal stays open.
- [ ] FAB (+, bottom-right) opens create modal; modal dismisses via Cancel and Android back.
- [ ] Filter button opens filter modal: frequency select, time-of-day select, scheduled-for date; count shown as "Filters (n)".
- [ ] Applying a filter refetches the filtered list; "Clear filters" button appears and resets.
- [ ] Reminders section (own card stack) renders above the activity groups, sorted overdue → active → upcoming → completed; hidden when no reminders.
- [ ] Reminder states visible: missed (red badge + expired date), locked (opens at + countdown), active (due by + countdown), completed (strikethrough, faded + undo icon).
- [ ] Reminders re-derive status every 30 s (overdue flips without refetch).
- [ ] Tap active/missed reminder → complete (success toast); tap completed → revert; undo icon on completed also reverts.
- [ ] Long-press reminder → status-appropriate menu (Complete now / Revert completion / Edit / Delete).
- [ ] Edit from reminder long-press opens the reminder form pre-filled due date/time and active window.
- [ ] Delete reminder → confirm modal showing title, description, due date; failure keeps card and reopens modal.

### Activity/reminder form modal (components/activity/activity-form-modal.tsx)

- [ ] Unlocked create shows the "Reminder" checkbox; toggling swaps activity fields ↔ reminder fields in place.
- [ ] Activity fields: frequency chips (daily/weekly/monthly), days-of-week chips only for weekly, time-of-day chips, numeric target amount (default 1).
- [ ] Validation: empty title → alert; target < 1 or non-numeric → alert; weekly with 0 days → alert.
- [ ] Edit activity opens pre-filled incl. selected weekly days; edit mode locked to activity (no checkbox).
- [ ] Reminder fields: due date YYYY-MM-DD, end time HH:MM, "active window" checkbox revealing start+end times.
- [ ] Reminder validation: bad date format, bad time format, or start ≥ due → destructive toast ("window must be before deadline").
- [ ] Activity save failure → alert dialog with server message, modal stays open.
- [ ] Reminder save shows created/updated toast; failure shows destructive toast, modal stays open.
- [ ] Create from template prefill (title, amount, frequency, dayTime, weekly days pre-selected).

### Routines modal (components/activity/routines-modal.tsx)

- [ ] Opens as full modal with search input + status chips (All/draft/active/stopped); search filters title+description; chips filter status.
- [ ] Loading spinner first visit; empty list shows "no routines" vs "no matching routines" depending on filter.
- [ ] Tap routine → detail view: back chevron, title, status badge, privacy label, Stop/Start button (active ↔ stopped), edit pencil, delete trash.
- [ ] Detail shows activities sorted by position, each numbered with today's completions `n/m`, frequency/dayTime/privacy chips; completed-today ones green-bordered.
- [ ] Detail with no activities shows empty text.
- [ ] Status change is optimistic; failure reverts status + destructive toast.
- [ ] Delete routine → confirm modal ("routine keeps its activities" message); confirm removes it; failure keeps item, modal stays open.
- [ ] Routine form: title, description, status select, privacy select, ordered selected-activities list (up/down arrows disabled at ends, X to remove), pool of remaining activities to add by tap.
- [ ] Form validation: empty title toast; zero selected activities toast.
- [ ] Create/update success toast + entry in list; failure toast, form stays open.
- [ ] No activities exist → "no activities to pick" text in form.

### Templates modal (components/activity/templates-modal.tsx)

- [ ] Category chips switch template lists; selection resets when reopened.
- [ ] Multi-select with checkboxes + per-row metadata chips (frequency, days, time, amount).
- [ ] Pencil icon ("Customize") per row: closes modal and opens create form prefilled with the template.
- [ ] Selected count text + "Create selected (n)" button disabled at 0.
- [ ] Success: created-count toast, modal closes, list reloads. All-fail: no close. Mixed: partial-failure toast.

## Time (app/(app)/time.tsx)

- [ ] Segmented tabs switch Records ↔ Calendar; records tab reloads on focus, calendar tab doesn't touch records.
- [ ] Period chips: this week / this month (default) / last month / all time; description line updates; changing period clears the filter.
- [ ] Filters (month/year/category) + count badge; applying month/year forces "all time" mode; open filter shows current values.
- [ ] Load failure → destructive toast.
- [ ] Stats cards (total time, entries, top category "N/A"-safe) match the visible list.
- [ ] Records grouped by category with per-category totals and accent colors; most-recent-first sections; category sections with 0 entries not rendered.
- [ ] Empty state differentiated: "no entries for period" vs "no entries match" (active filter) with adjusted copy.
- [ ] Long-press record → Edit / Delete / Cancel menu; edit opens prefilled modal; delete opens confirm with category + duration.
- [ ] Delete is optimistic with toast; failure restores record + destructive toast + modal stays open (re-throws).
- [ ] Start-recording card: category select + description field + Start.
- [ ] Start without category → destructive toast, no session created.
- [ ] Multiple simultaneous sessions allowed; counter badge shows `n`.
- [ ] Active session card: running timer (mono, ticks 1 s), category chip, description fallback to category.
- [ ] Stop (pause) freezes the timer; then Resume restarts and Save appears; Save disabled-look state while saving.
- [ ] Save requires description (empty → toast) and category; rounds to minutes (min 1) and creates a record (success toast, card disappears, list reloads).
- [ ] Save failure → session stays with error toast.
- [ ] Discard (trash) removes session immediately (no confirmation).
- [ ] Kill and reopen the app: running sessions restore with elapsed time preserved (persisted via storage).
- [ ] Log Time button opens create modal; modal validation: duration ≤ 0 → toast; no category → toast (Save also disabled).
- [ ] Manual log success reloads list; edit success updates entry.

### Calendar tab (components/time/calendar-view.tsx)

- [ ] 7-day strip for current week; selected day highlighted; today highlighted when unselected; week label localized (es-ES / en-US).
- [ ] Prev/next week chevrons shift the strip and selection; "Today" button returns to the current week.
- [ ] Agenda shows selected day's events sorted by start time, with color accent bar per category, time range, description, category chip.
- [ ] Events overlapping at day boundaries (ending past midnight with "ends next day") appear on both days.
- [ ] Empty day state: icon + "no events" + "New event" button.
- [ ] Load failure → empty agenda + destructive toast.
- [ ] Tap event opens edit modal; tap "New event" opens prefill (selected day, 09:00–10:00 default).
- [ ] Delete event → confirm modal with occurrence/series scope select (only for series events); success toast + agenda reload; failure keeps event.

### Event form modal (components/time/calendar-event-form-modal.tsx)

- [ ] Fields: title, category select, date, separate hours:minutes inputs (numeric, 2-char max), description (multiline).
- [ ] "Ends next day" toggle: end time never reinterpreted; toggling extends the computed end to the next calendar day (overnight events).
- [ ] Validation (each in order): empty title, invalid date, invalid time, end ≤ start, duration over max — each with its own destructive toast.
- [ ] Create only: repeat select (none/weekly); picking weekly pre-fills "until" with +4 weeks; empty or before-start "until" blocked with toasts.
- [ ] Edit hides repeat selects; series events (seriesId) show "Apply to: occurrence/series" select with hint text.
- [ ] Edit prefills title, category, date, times, recurrence state, and next-day-end state.
- [ ] Buttons: Delete (destructive) only in edit; Cancel; Save shows saving/updating label.
- [ ] Save failure → destructive toast, modal stays open.

## Notes (app/(app)/notes.tsx)

- [ ] Initial load spinner; load failure → destructive toast.
- [ ] List layout: ungrouped notes first, then per group (header row with name, count badge, collapse chevron, ⋮ menu) with notes indented.
- [ ] Note card: drag handle (hidden while searching), title (or "Untitled"), warning dot if unsaved draft exists, trash icon.
- [ ] Group collapse/expand on header tap; chevron direction flips; collapsed groups hide their notes.
- [ ] Search box: 400 ms debounce → server search; client-side rows filtered by title/content; while searching: group headers force-expanded, empty groups hidden, drag handles hidden; empty state "no notes found".
- [ ] Clearing search restores positions/structure.
- [ ] Truly empty list: "no notes yet" + New note CTA (search-empty has no CTA).
- [ ] Drag reorder (long-press the grip, 200 ms drag delay, scale animation): notes reorder within section; group headers reorder; visual lift scale during drag.
- [ ] Dragging a note across a group header moves it to that group (membership inferred from final position — notes before first header are ungrouped); dropping after a collapsed header makes it the first note there.
- [ ] Order persisted via reorderNotes with per-section reindex; failure reverts positions + error toast.
- [ ] Group reorder persists reorderNoteGroups; failure reverts + toast.
- [ ] Tapping a note opens editor; long-press opens delete confirm (also via trash icon); deleting has success/error toasts.
- [ ] Editor modal: title + content fields; Preview toggle renders markdown (headings, links, bold, blockquote, code, hr) in a bordered scroll panel; toggle back to Edit.
- [ ] Editing shows "last edited" date + " • unsaved changes" while dirty, plus a Discard link that resets to last-saved values (removes draft).
- [ ] Unsaved edits auto-persist as drafts; leaving without saving + reopening restores the draft with "draft restored" toast (draft storage per note id).
- [ ] Save success: note created/updated (new notes prepend), toast, draft cleared, modal closes; Save failure → modal stays with error toast; Cancel keeps the draft.
- [ ] Group create via "Add group" button → name modal (max 100 chars); create disabled when name blank; success toast + group prepended.
- [ ] Group ⋮ menu: Rename / Delete (destructive); delete confirm explains notes are kept and moved to ungrouped; optimistic revert on failure; refetch after deleting a group.
- [ ] Deleting a group removes its header, un-collapses state, and its notes appear ungrouped (after refetch).

## Finance (app/(app)/finance/dashboard.tsx and finance/transactions.tsx)

Note: mobile keeps **two separate routes** — dashboard and transactions — each with its
own Navigation bar. There are no finance tabs on mobile and no redirect shims;
`finance/dashboard` and `finance/transactions` are real screens.

### Dashboard (finance-dashboard.tsx)

- [ ] Full-screen spinner on screen load until summary/stats settle.
- [ ] Three summary cards: total income (green), total outcome (red), balance (green if ≥0, red if <0); degrade to $0 values if fetch fails (no error toast, remaining cards render).
- [ ] Dollar rate cards (oficial/blue) with buy/sell values; "unavailable" text when the external fetch fails.
- [ ] Monthly trend bar chart: alternating income (green, up) / outcome (red, negative) bars per month, last 6 months up to current, offline-neutral styling; "no chart data" empty text.
- [ ] Income/outcome-by-category breakdown with percentage progress bars and localized category names; "no categories" empty text per side.
- [ ] Upcoming bills = fixed transactions with no payment in the current period: name, description, payment frequency, "Record payment" button.
- [ ] "No upcoming bills" empty state.
- [ ] Payment modal opens pre-filled for the bill; record payment refreshes the fixed list (bill leaves upcoming).

### Movements / Transactions (finance/transactions.tsx)

- [ ] Movements feed grouped by day ("Today", "Yesterday", date labels); pending fixed movements marked "· pending" and tappable to open the payment modal.
- [ ] Amounts colored +green (income) / −red (expense) with currency formatting.
- [ ] Filter modal (month/year/category) with count badge and "Clear all"; applying reloads (category options come from server); empty state differs for filtered vs unfiltered.
- [ ] Bills section (footer): per income/expense blocks with accent left-border, totals, `paid/total` counter; each bill shows this-period amount and Paid/Pending badge (warning icon when pending).
- [ ] Tap a bill → payment modal; long-press a bill or a movement → Edit / Delete / Cancel menu.
- [ ] Delete movement/bill optimistic with toasts; failure restores + modal stays open.
- [ ] Edit movement opens the form as "update transaction" (variable: amount+date prefilled; fixed: amount hidden, payment frequency shown); edit fixed uses fixed.createdAt date semantics.
- [ ] Infinite scroll: footer list + `onEndReached` pagination (30/page), stops when all loaded; load-more spinner not shown separately but next batch appends.
- [ ] Load failure → destructive toast.
- [ ] FAB opens create modal.
- [ ] "No bills yet" empty state when fixed list empty.
- [ ] Movements/bills refresh after creating or editing a transaction or recording a payment.

### Transaction form modal (components/finance/transaction-form-modal.tsx)

- [ ] Type select (expense/income) filters the category list by type.
- [ ] Frequency select (variable/fixed); fixed hides amount+date and shows payment frequency (monthly/bimonthly/yearly). Title changes ("new expense" vs fixed).
- [ ] Create validation: no category → alert; variable with invalid/≤0 amount → alert (amount stored as 0 for fixed).
- [ ] Amount input formats thousands separators as typed; date defaults to today.
- [ ] Edit prefills all fields (amount=0 for fixed shows empty).
- [ ] Save failure → generic error alert, modal stays open; success closes and triggers parent reload.

### Payment modal (components/finance/payment-modal.tsx)

- [ ] Opens with transaction description + total paid; fetches payment history (loading text, then roster of date+amount rows with delete buttons).
- [ ] Amount + date (date defaults today); invalid/≤0 amount → destructive toast.
- [ ] Record success: toast with amount, modal closes, parent lists reload.
- [ ] Record failure: modal stays open with destructive toast.
- [ ] Delete a payment via confirm modal; optimistic removal of row + total paid; failure restores both.
- [ ] Close button + Android back closes the modal.

## Social (app/(app)/social.tsx)

- [ ] Segmented tabs: Find friends / Requests; request count "(n)" appended to tab label and updates after accept/reject/screen focus.
- [ ] Search: 300 ms debounce, 20 results max; button-less; initial state shows placeholder hint (pre-search), no results after search shows "try different" state, searching shows spinner.
- [ ] Result card: name, @username, opens the tap-to-navigate public profile area; "Private" badge for private profiles.
- [ ] Follow button states: Follow → tap sends request or follows directly; pending shows gray "Pending" chip; following shows outline "Following"; spinner while processing.
- [ ] Result card toast text differs: request sent vs now following.
- [ ] Unfollow works from the same button; success/failure toasts.
- [ ] Errors (search/follow/unfollow) → destructive toasts with server message.
- [ ] Requests tab: list of name/@username + "wants to follow", Accept/Reject buttons with individual loading states; accepted/rejected toasts; row removed immediately.
- [ ] Empty requests: icon + "no pending requests" state; requests load failure → destructive toast.
- [ ] Requests reload on screen focus (accepting from profile reflects back here).

## Public profile (app/user/[username].tsx)

- [ ] Loading spinner first; unknown user → "not found" state with outline button back.
- [ ] Not-found/pencil: back chevron returns to the previous screen; title `@username`; full name; followers/following counts.
- [ ] Self profile: "This is you" label, no follow button.
- [ ] Other profile: follow button states — Follow / Pending (alert on request) / Following (outline); activating unfollows; error → alert; button shows spinner while processing.
- [ ] Private profile without access: lock icon + locked message; no content sections rendered.
- [ ] Allowed content: "Public activities (count)" and "Public routines (count)" sections; cards show title, description, frequency · dayTime (activities) or activity count (routines), streak badge.
- [ ] Empty sections show "no public …" text.
- [ ] Subscribe buttons hidden on own cards; subscribed state shows outline variant; tap subscribes/unsubscribes with alert-toast and refreshed state; failures alert.
- [ ] Section reload on screen focus (follow state refresh after social-screen actions).

## Profile (app/(app)/profile.tsx)

- [ ] Screen focus refreshes the profile from the server; failure keeps cached user (no error toast).
- [ ] Avatar: image if present, otherwise initial-letter placeholder circle.
- [ ] "Change picture" runs the media-library permission flow; canceling picker/upload canceled does nothing; success updates avatar; failure toast.
- [ ] Imaging picker cropped to square (1:1 aspect, quality 0.8).
- [ ] "Delete" picture button visible only when a picture exists; removal updates avatar; failure toast.
- [ ] Privacy row: tap toggles public ↔ private optimistically; label updates; failure reverts + toast.
- [ ] Theme row: tap toggles light/dark; label shows current value; entire screen re-themes.
- [ ] Language row: tap flips language locale; all profile labels update instantly.
- [ ] API URL row: shows current URL (single line); opens edit modal prefilled; Save trims trailing slashes, persists to storage, updates immediately, toast confirm; empty input does nothing.
- [ ] URL validation: non-https rejected with an alert (in release/dev-protected mode; dev allows http for LAN).
- [ ] Cancel/android back of the URL modal does not change the URL.
- [ ] Change password modal: current/new/confirm fields (all masked), min-8 hint, mismatch toast, <8 chars toast, update success toast + modal closes + form resets; failure toast keeps modal; Cancel resets all fields.
- [ ] Change email modal: current email shown read-only; new email with debounced availability check (available/taken states; same-as-current skipped); password field; "same email" blocked pre-submit; success toast + header cached profile updates; form resets on close; failure toast keeps modal.
- [ ] Backup export: "Exporting…" state; success toast; failure toast with reason. Errors don't clear the disabled state.
- [ ] Backup import: file picker; picked file opens a destructive confirm modal naming the file and warning that restore replaces server data; Cancel aborts; confirm shows "Importing…" then success toast with item count; profile refreshed after import; failure toast; import/export buttons disable each other while running.
- [ ] Sign out button (destructive style): logs out, toast, navigates to login; back cannot return to profile.

## Cross-cutting checks

### Navigation (components/navigation.tsx) — runs on every screen

- [ ] Hamburger toggles to X; opening the drawer dims the screen with a backdrop; tapping the backdrop closes.
- [ ] Drawer lists 6 items with icons: Activities, Time tracker, Notes, Finance transactions, Finance dashboard, Social. Active item highlighted (icon + label primary + tinted row).
- [ ] Tapping an item closes the drawer and navigates; correct highlight on the current route (including `/finance/...` paths).
- [ ] Hamburger + "LifeTracker" title + (theme toggle + profile avatar) fit in the 56 px bar; tapping the avatar opens /profile; avatar reflects back when navigated.
- [ ] Theme toggle (sun/moon icon) switches the entire app instantly and persists across restarts.
- [ ] Drawer positioned correctly below the header on every screen (no overlap, backdrop spans screen).
- [ ] Language es/en: nav labels, titles, buttons, validation messages, toasts, date labels all localized — no English strings left when the locale is Spanish (and vice versa).
- [ ] Toasts: auto-dismiss, stacked when several fire, colored (neutral success / destructive red variant); don't block navigation modals or fail to appear after a lang change.
- [ ] Keyboard: bottom-sheet modals rise/resize-resize the keyboard on Android and don't block Cancel/Save.

### Theme

- [ ] Every screen renders fully in both themes: cards, chips, borders, badges (success/danger/warning accents), charts, markdown preview, calendar strip.
- [ ] Toggle mid-session: form modal and drawer re-theme without restart; persisted theme survives app restart.

### Auth-redirect & access (index.tsx)

- [ ] Deep link/logged-out access to a `(app)` screen is impossible via index redirect (only login/register are reachable logged out).
- [ ] After logout, navigating to any app route lands back at login.
- [ ] Public user profile reachable from social search; back from a not-found profile returns cleanly.

### Loading / error / empty states

- [ ] Every list has a loading state (spinner or ListEmpty spinner), an error path (toast/inline), and an empty state; none deadlock after retry.
- [ ] All destructive deletes go through a confirm modal where the modal stays open on failure (item not silently lost).
- [ ] Back navigation (Android hardware back) safely closes modals/drawer/list extras, never crashes.
- [ ] `useFocusEffect` refetch semantics preserved: returning to a tab refreshes its data without a full-screen flash.
