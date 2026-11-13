package com.lifetracker.feature.time

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lifetracker.core.network.model.CalendarEventResponse
import com.lifetracker.core.network.model.CreateCalendarEventRequest
import com.lifetracker.core.network.model.EventScope
import com.lifetracker.core.network.model.TimeRecordResponse
import com.lifetracker.core.network.model.UpdateCalendarEventRequest
import com.lifetracker.domain.calendar.CalendarRepository
import com.lifetracker.domain.lib.calendarweek.getWeekRange
import com.lifetracker.domain.lib.calendarweek.getWeekStart
import com.lifetracker.domain.lib.time.formatDuration
import com.lifetracker.domain.time.parseInstant
import com.lifetracker.domain.time.ActiveTimeSession
import com.lifetracker.domain.time.ActiveTimeSessionStore
import com.lifetracker.domain.time.TimeRepository
import com.lifetracker.domain.time.elapsedSeconds
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.ThreadLocalRandom
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Port of the RN Time screen state holders:
 * `app/(app)/time.tsx` (records list, period/filter, stats, delete),
 * `hooks/use-active-sessions.ts` (timer sessions persisted through storage)
 * and `components/time/calendar-view.tsx` (events of the visible week).
 */
@HiltViewModel
class TimeViewModel @Inject constructor(
    private val timeRepo: TimeRepository,
    private val calendarRepo: CalendarRepository,
    private val sessionStore: ActiveTimeSessionStore,
) : ViewModel() {

    private val zone: ZoneId = ZoneId.systemDefault()
    private val clock: () -> Long = System::currentTimeMillis

    private val _uiState = MutableStateFlow(TimeUiState(now = clock()))
    val uiState: StateFlow<TimeUiState> = _uiState.asStateFlow()

    /**
     * Screen-side feedback: load failures fired by the async effects plus the
     * active-session toasts (the session cards live deep in the records tab).
     * Modal-owned actions (create/edit/delete) toast at the call site.
     */
    private val _events = MutableSharedFlow<TimeEvent>(extraBufferCapacity = 16)
    val events: SharedFlow<TimeEvent> = _events.asSharedFlow()

    /// ---- active sessions ----

    private var tickerJob: Job? = null

    init {
        // RN hydrates from storage on mount; running sessions restore with
        // their elapsed time preserved after kill + reopen.
        val restored = sessionStore.load()
        if (restored.isNotEmpty()) {
            _uiState.update { it.copy(sessions = restored) }
        }
        ensureTicker()
    }

    /**
     * RN `start`: without a category the `categoryRequired` toast fires and
     * nothing is created; the caller clears its inputs on success only.
     */
    fun startSession(category: String, description: String): Boolean {
        if (category.isEmpty()) {
            _events.tryEmit(TimeEvent.SessionCategoryRequired)
            return false
        }
        mutateSessions { sessions ->
            sessions + ActiveTimeSession(
                id = newSessionId(),
                category = category,
                description = description,
                startedAt = clock(),
                accumulatedSeconds = 0,
            )
        }
        _uiState.update { it.copy(now = clock()) }
        return true
    }

    /** RN `pause`: freezes the running seconds into the accumulated counter. */
    fun pauseSession(id: String) {
        mutateSessions { sessions ->
            sessions.map { session ->
                if (session.id == id && session.startedAt != null) {
                    session.copy(accumulatedSeconds = elapsedSeconds(session, clock()), startedAt = null)
                } else {
                    session
                }
            }
        }
    }

    /** RN `resume`: restarts the wall clock for this session only. */
    fun resumeSession(id: String) {
        mutateSessions { sessions ->
            sessions.map { session ->
                if (session.id == id && session.startedAt == null) {
                    session.copy(startedAt = clock())
                } else {
                    session
                }
            }
        }
    }

    /** RN `discard` — trash icon, immediate removal without confirmation. */
    fun discardSession(id: String) {
        mutateSessions { sessions -> sessions.filterNot { it.id == id } }
    }

    /**
     * RN `save`: elapsed seconds round to minutes (min 1) and create a record;
     * on success the session disappears and the list reloads; on failure the
     * session stays (the caller shows the error toast).
     */
    suspend fun saveActiveSession(session: ActiveTimeSession): Boolean {
        if (session.category.isEmpty()) {
            _events.tryEmit(TimeEvent.SessionCategoryRequired)
            return false
        }
        if (session.description.isBlank()) {
            _events.tryEmit(TimeEvent.SessionDescriptionRequired)
            return false
        }
        _uiState.update { it.copy(savingSessionId = session.id) }
        val elapsed = elapsedSeconds(session, clock())
        // Same >= 60 s round-to-minutes rule as the shared service (min 1 min).
        val totalMinutes = maxOf(1, Math.round(elapsed / 60.0).toInt())
        val created = runCatching {
            timeRepo.create(
                category = session.category,
                description = session.description,
                durationMinutes = totalMinutes,
            )
        }
        _uiState.update { it.copy(savingSessionId = null) }
        return created.fold(
            onSuccess = {
                _events.tryEmit(TimeEvent.SessionSaved(formatDuration(totalMinutes), session.category))
                mutateSessions { sessions -> sessions.filterNot { it.id == session.id } }
                loadRecords()
                true
            },
            onFailure = { error ->
                _events.tryEmit(TimeEvent.SessionSaveFailed(error.message ?: "An error occurred"))
                false
            },
        )
    }

    /// ---- records ----

    /**
     * RN `loadRecords`, fired by the records-tab focus effect (`itemKey` on the
     * visible period + filter): server filters for month/year periods, client
     * filter on the created-at instant for "this week".
     */
    fun loadRecords() {
        viewModelScope.launch {
            val snapshot = _uiState.value
            _uiState.update { it.copy(isLoadingRecords = true) }
            try {
                val now = ZonedDateTime.now(zone)
                val (paramsMonth, paramsYear) = periodParams(snapshot.period, now)
                val week = if (snapshot.period == TimePeriod.THIS_WEEK) weekBounds(now) else null
                val month = if (snapshot.period == TimePeriod.ALL_TIME) snapshot.filter.month?.toIntOrNull() else paramsMonth
                val year = if (snapshot.period == TimePeriod.ALL_TIME) snapshot.filter.year?.toIntOrNull() else paramsYear
                var data = timeRepo.getRecords(
                    category = snapshot.filter.category,
                    month = month,
                    year = year,
                )
                if (week != null) {
                    val (start, end) = week
                    data = data.filter { record ->
                        val createdAt = parseInstant(record.createdAt, zone)
                        createdAt != null && createdAt >= start && createdAt <= end
                    }
                }
                _uiState.update { it.copy(records = data, isLoadingRecords = false) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoadingRecords = false) }
                // RN: `showToast({ title: t('failedToLoad'), variant: 'destructive' })`.
                _events.tryEmit(TimeEvent.RecordsLoadFailed)
            }
        }
    }

    /// ---- manual record create / edit (Record form modal) ----

    /** `null` = success; otherwise the server/transport error message for the toast. */
    suspend fun createManualRecord(category: String, description: String, durationMinutes: Int): String? =
        runCatching {
            timeRepo.create(category = category, description = description, durationMinutes = durationMinutes)
        }.fold(
            onSuccess = {
                loadRecords()
                null
            },
            onFailure = { error -> error.message ?: "An error occurred" },
        )

    suspend fun updateManualRecord(id: Long, category: String, description: String, durationMinutes: Int): String? =
        runCatching {
            timeRepo.update(id = id, category = category, description = description, durationMinutes = durationMinutes)
        }.fold(
            onSuccess = {
                loadRecords()
                null
            },
            onFailure = { error -> error.message ?: "An error occurred" },
        )

    /**
     * RN `handleDeleteRecord`: optimistic removal restored on failure (the
     * RN modal handler re-throws so the confirm modal stays open — in Compose
     * we keep it mounted until this returns `null`).
     */
    suspend fun deleteRecord(record: TimeRecordResponse): String? {
        val snapshot = _uiState.value.records
        _uiState.update { it.copy(records = snapshot.filterNot { it.id == record.id }) }
        return runCatching { timeRepo.delete(record.id) }.fold(
            onSuccess = { null },
            onFailure = { error ->
                _uiState.update { it.copy(records = snapshot) }
                error.message ?: "An error occurred"
            },
        )
    }

    /// ---- period / filter / tab ----

    fun setView(view: TimeView) {
        _uiState.update { it.copy(view = view) }
    }

    /** RN `handlePeriodChange`: switching period clears the filter. */
    fun setPeriod(period: TimePeriod) {
        _uiState.update { it.copy(period = period, filter = TimeFilter()) }
    }

    /** RN `handleApplyFilter`: a month/year pick forces "all time" mode. */
    fun applyFilter(filter: TimeFilter) {
        _uiState.update {
            it.copy(
                filter = filter,
                period = if (filter.month != null || filter.year != null) TimePeriod.ALL_TIME else it.period,
            )
        }
    }

    /// ---- calendar ----

    /**
     * RN calendar `useFocusEffect`: the events overlapping the visible week;
     * `from`/`to` always travel together (backend rejects a single bound).
     */
    fun loadEvents(weekStart: ZonedDateTime) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingEvents = true) }
            try {
                val range = getWeekRange(weekStart)
                val events = calendarRepo.getEvents(range.from, range.to)
                _uiState.update { it.copy(events = events, isLoadingEvents = false) }
            } catch (error: Exception) {
                _uiState.update { it.copy(events = emptyList(), isLoadingEvents = false) }
                _events.tryEmit(TimeEvent.EventsLoadFailed(error.message))
            }
        }
    }

    /** RN bump of `reloadKey` — the calendar effect refetches on change. */
    private fun reloadCalendar() {
        _uiState.update { it.copy(eventsReloadKey = it.eventsReloadKey + 1) }
    }

    /** Event create; the form modal owns validation and toast text. */
    suspend fun createEvent(request: CreateCalendarEventRequest): String? =
        runCatching { calendarRepo.create(request) }.fold(
            onSuccess = {
                reloadCalendar()
                null
            },
            onFailure = { error -> error.message ?: "An error occurred" },
        )

    /** Event update; `scope` rides inside the update body (occurrence/series). */
    suspend fun updateEvent(id: Long, request: UpdateCalendarEventRequest): String? =
        runCatching { calendarRepo.update(id, request) }.fold(
            onSuccess = {
                reloadCalendar()
                null
            },
            onFailure = { error -> error.message ?: "An error occurred" },
        )

    /** Agenda is refetched after a delete (no optimistic list surgery in RN). */
    suspend fun deleteEvent(id: Long, scope: EventScope?): String? =
        runCatching { calendarRepo.delete(id, scope) }.fold(
            onSuccess = {
                reloadCalendar()
                null
            },
            onFailure = { error -> error.message ?: "An error occurred" },
        )

    /// ---- internals ----

    /**
     * Session mutation with write-through persistence, mirroring the RN effect
     * that stores the sessions JSON on every state change.
     */
    private fun mutateSessions(block: (List<ActiveTimeSession>) -> List<ActiveTimeSession>) {
        val next = block(_uiState.value.sessions)
        sessionStore.save(next)
        _uiState.update { it.copy(sessions = next) }
        ensureTicker()
    }

    /** 1 s ticker while any session runs (`setInterval` in the RN hook). */
    private fun ensureTicker() {
        val running = _uiState.value.sessions.any { it.startedAt != null }
        if (running && tickerJob == null) {
            tickerJob = viewModelScope.launch {
                while (true) {
                    delay(1000)
                    _uiState.update { it.copy(now = clock()) }
                }
            }
        } else if (!running) {
            tickerJob?.cancel()
            tickerJob = null
            _uiState.update { it.copy(now = clock()) }
        }
    }

    /** RN `createSessionId()`: `t-$epoch-$sixRandomBase36Chars`. */
    private fun newSessionId(): String {
        val alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
        val random = ThreadLocalRandom.current()
        val token = buildString(6) {
            repeat(6) { append(alphabet[random.nextInt(alphabet.length)]) }
        }
        return "t-${clock()}-$token"
    }

    private fun weekBounds(now: ZonedDateTime): Pair<ZonedDateTime, ZonedDateTime> {
        // Same local Monday 00:00 the JS `getPeriodParams` startOfWeek computes.
        val start = getWeekStart(now)
        val end = ZonedDateTime.of(
            start.toLocalDate().plusDays(6L),
            java.time.LocalTime.of(23, 59, 59, 999_000_000),
            zone,
        )
        return start to end
    }

    /** `month`/`year` request params for the four period chips. */
    private fun periodParams(period: TimePeriod, now: ZonedDateTime): Pair<Int?, Int?> =
        when (period) {
            TimePeriod.THIS_MONTH -> now.monthValue to now.year
            TimePeriod.LAST_MONTH -> {
                val lastMonth = if (now.monthValue == 1) 12 else now.monthValue - 1
                val lastYear = if (now.monthValue == 1) now.year - 1 else now.year
                lastMonth to lastYear
            }
            else -> null to null
        }
}

/// ---- shared screen models ----

enum class TimeView { RECORDS, CALENDAR; }

/** The four period chips; `key` is the i18n key under `time.`. */
enum class TimePeriod(val key: String) {
    THIS_WEEK("thisWeek"),
    THIS_MONTH("thisMonth"),
    LAST_MONTH("lastMonth"),
    ALL_TIME("allTime");
}

/** Filter modal result (month/year/category option values, null = all). */
data class TimeFilter(
    val month: String? = null,
    val year: String? = null,
    val category: String? = null,
) {
    val activeCount: Int get() = listOf(month, year, category).count { it != null }
}

/** Screen state, composed from the three RN pieces listed in the KDoc. */
data class TimeUiState(
    val view: TimeView = TimeView.RECORDS,
    val period: TimePeriod = TimePeriod.THIS_MONTH,
    val filter: TimeFilter = TimeFilter(),
    val records: List<TimeRecordResponse> = emptyList(),
    val isLoadingRecords: Boolean = true,
    val sessions: List<ActiveTimeSession> = emptyList(),
    /** Shared 1 s tick driving the running timer displays. */
    val now: Long = 0,
    val savingSessionId: String? = null,
    // calendar
    val events: List<CalendarEventResponse> = emptyList(),
    val isLoadingEvents: Boolean = true,
    /** Bumped by VM actions (create/update/delete) to refetch the agenda. */
    val eventsReloadKey: Int = 0,
) {
    val filterCount: Int get() = filter.activeCount
}

/** One-shot feedback consumed by the screen root and mapped to toasts. */
sealed interface TimeEvent {
    data object RecordsLoadFailed : TimeEvent
    data class EventsLoadFailed(val error: String?) : TimeEvent
    data object SessionCategoryRequired : TimeEvent
    data object SessionDescriptionRequired : TimeEvent
    data class SessionSaveFailed(val error: String) : TimeEvent
    data class SessionSaved(val duration: String, val category: String) : TimeEvent
}
