// calendar_event_service_test.go
//
// Subject: internal/domain/calendar/service.CalendarService against real PostgreSQL.
// Scope:   interval validation, CRUD, ownership, range listing, and weekly
//
//	recurrence (occurrence generation, series scope on update/delete).
//
// Out of scope: overlap SQL correctness → calendar_event_repository_test.go
//
//	HTTP contract → calendar_event_controller_test.go
//
// Infrastructure: PostgreSQL (test database via .env.test).
// Data strategy: TRUNCATE calendar_events before each top-level test function.
// Parallel-safe: no — single shared DB connection, no per-test namespace.
package service

import (
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/calendar/dto"
	"life-tracker-backend/internal/domain/calendar/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	testDB *gorm.DB
	cfg    *config.Config
)

func TestMain(m *testing.M) {
	os.Setenv("ENVIRONMENT", "test")
	cfg = config.Load()
	os.Exit(m.Run())
}

func setupTestDatabase(t *testing.T) {
	t.Helper()
	if testDB != nil {
		return
	}

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err, "Failed to connect to PostgreSQL")

	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	require.NoError(t, db.AutoMigrate(&model.CalendarEvent{}))
	testDB = db
}

func cleanDatabase(t *testing.T) {
	t.Helper()
	require.NoError(t, testDB.Exec("TRUNCATE TABLE calendar_events RESTART IDENTITY CASCADE;").Error)
}

func getTestService(t *testing.T) *CalendarService {
	t.Helper()
	setupTestDatabase(t)
	cleanDatabase(t)
	return NewCalendarService(testDB)
}

func baseRequest() *dto.CreateCalendarEventRequest {
	return &dto.CreateCalendarEventRequest{
		Title:       "English class",
		Description: "B2 conversation",
		Category:    "Study",
		StartAt:     time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC),
		EndAt:       time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC),
	}
}

func TestCreateEvent(t *testing.T) {
	svc := getTestService(t)

	tests := []struct {
		name    string
		mutate  func(*dto.CreateCalendarEventRequest)
		wantErr bool
	}{
		{
			name:   "valid_interval_is_persisted",
			mutate: func(*dto.CreateCalendarEventRequest) {},
		},
		{
			name:    "zero_length_rejected",
			mutate:  func(r *dto.CreateCalendarEventRequest) { r.EndAt = r.StartAt },
			wantErr: true,
		},
		{
			name: "reversed_interval_rejected",
			mutate: func(r *dto.CreateCalendarEventRequest) {
				r.EndAt = r.StartAt.Add(-time.Hour)
			},
			wantErr: true,
		},
		{
			name: "longer_than_24h_rejected",
			mutate: func(r *dto.CreateCalendarEventRequest) {
				r.EndAt = r.StartAt.Add(25 * time.Hour)
			},
			wantErr: true,
		},
		{
			name: "exactly_24h_allowed",
			mutate: func(r *dto.CreateCalendarEventRequest) {
				r.EndAt = r.StartAt.Add(24 * time.Hour)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := baseRequest()
			tt.mutate(req)

			resp, err := svc.CreateEvent(7, req, time.UTC)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, resp)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, resp)
			assert.NotZero(t, resp.ID)
			assert.Equal(t, req.Title, resp.Title)
			assert.True(t, req.StartAt.Equal(resp.StartAt))
			assert.True(t, req.EndAt.Equal(resp.EndAt))
		})
	}
}

func TestGetEventsRangeAndIsolation(t *testing.T) {
	svc := getTestService(t)
	userID := uint(42)

	seeds := []*dto.CreateCalendarEventRequest{
		{Title: "monday", Category: "Study", StartAt: time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC), EndAt: time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC)},
		{Title: "next-week", Category: "Study", StartAt: time.Date(2026, time.October, 27, 10, 0, 0, 0, time.UTC), EndAt: time.Date(2026, time.October, 27, 12, 0, 0, 0, time.UTC)},
	}
	for _, seed := range seeds {
		_, err := svc.CreateEvent(userID, seed, time.UTC)
		require.NoError(t, err)
	}

	foreign := &dto.CreateCalendarEventRequest{
		Title:    "foreign",
		Category: "Study",
		StartAt:  time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC),
		EndAt:    time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC),
	}
	_, err := svc.CreateEvent(uint(43), foreign, time.UTC)
	require.NoError(t, err)

	from := time.Date(2026, time.October, 19, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 0, 7)

	t.Run("range_filter_returns_overlapping_event", func(t *testing.T) {
		resp, err := svc.GetEvents(userID, &dto.CalendarEventFilter{From: &from, To: &to})
		require.NoError(t, err)
		require.Len(t, resp, 1)
		assert.Equal(t, "monday", resp[0].Title)
	})

	t.Run("no_filter_returns_all_user_events", func(t *testing.T) {
		resp, err := svc.GetEvents(userID, nil)
		require.NoError(t, err)
		assert.Len(t, resp, 2)
	})

	t.Run("other_user_is_isolated", func(t *testing.T) {
		resp, err := svc.GetEvents(uint(99), nil)
		require.NoError(t, err)
		assert.Empty(t, resp)
	})
}

func TestUpdateEvent(t *testing.T) {
	svc := getTestService(t)
	userID := uint(50)

	created, err := svc.CreateEvent(userID, baseRequest(), time.UTC)
	require.NoError(t, err)

	t.Run("partial_update_keeps_other_fields", func(t *testing.T) {
		title := "English class (moved)"
		resp, err := svc.UpdateEvent(userID, created.ID, &dto.UpdateCalendarEventRequest{Title: &title})
		require.NoError(t, err)
		assert.Equal(t, title, resp.Title)
		assert.True(t, created.StartAt.Equal(resp.StartAt))
	})

	t.Run("empty_update_is_a_noop", func(t *testing.T) {
		resp, err := svc.UpdateEvent(userID, created.ID, &dto.UpdateCalendarEventRequest{})
		require.NoError(t, err)
		assert.Equal(t, created.ID, resp.ID)
	})

	t.Run("invalid_merged_interval_rejected", func(t *testing.T) {
		newStart := created.EndAt.Add(time.Hour)
		resp, err := svc.UpdateEvent(userID, created.ID, &dto.UpdateCalendarEventRequest{StartAt: &newStart})
		assert.Error(t, err)
		assert.Nil(t, resp)
	})

	t.Run("foreign_user_cannot_update", func(t *testing.T) {
		title := "hijacked"
		resp, err := svc.UpdateEvent(uint(51), created.ID, &dto.UpdateCalendarEventRequest{Title: &title})
		assert.Error(t, err)
		assert.Nil(t, resp)
	})
}

func TestDeleteEvent(t *testing.T) {
	svc := getTestService(t)
	userID := uint(60)

	created, err := svc.CreateEvent(userID, baseRequest(), time.UTC)
	require.NoError(t, err)

	assert.Error(t, svc.DeleteEvent(uint(61), created.ID, dto.ScopeOccurrence))
	assert.NoError(t, svc.DeleteEvent(userID, created.ID, dto.ScopeOccurrence))

	resp, err := svc.GetEvent(userID, created.ID)
	assert.Error(t, err)
	assert.Nil(t, resp)
}

// --- Weekly recurrence ---

// weeklyRequest returns a create request for a weekly series ending at until.
func weeklyRequest(until time.Time) *dto.CreateCalendarEventRequest {
	req := baseRequest()
	interval := 1
	req.Recurrence = &dto.CalendarRecurrenceRequest{
		Rule:     dto.RecurrenceRuleWeekly,
		Interval: &interval,
		Until:    &until,
	}
	return req
}

// monday is the first occurrence used by the recurrence tests.
func monday() time.Time {
	return time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC)
}

func TestCreateRecurringEventMaterializesOccurrences(t *testing.T) {
	svc := getTestService(t)
	userID := uint(80)

	start := monday()
	created, err := svc.CreateEvent(userID, weeklyRequest(start.AddDate(0, 0, 21)), time.UTC)
	require.NoError(t, err)
	require.NotNil(t, created)
	require.NotNil(t, created.SeriesID)

	events, err := svc.GetEvents(userID, nil)
	require.NoError(t, err)
	require.Len(t, events, 4)

	for i, event := range events {
		require.NotNil(t, event.SeriesID)
		assert.Equal(t, *created.SeriesID, *event.SeriesID)
		require.NotNil(t, event.OccurrenceIndex)
		assert.Equal(t, i, *event.OccurrenceIndex)
		require.NotNil(t, event.RecurrenceRule)
		assert.Equal(t, dto.RecurrenceRuleWeekly, *event.RecurrenceRule)
		require.NotNil(t, event.RecurrenceInterval)
		assert.Equal(t, 1, *event.RecurrenceInterval)

		// Same weekday and time of day, one week apart.
		expected := start.AddDate(0, 0, 7*i)
		assert.Equal(t, time.Monday, event.StartAt.Weekday())
		assert.True(t, expected.Equal(event.StartAt), "occurrence %d starts at %s", i, event.StartAt)
		assert.True(t, expected.Add(2*time.Hour).Equal(event.EndAt), "occurrence %d ends at %s", i, event.EndAt)
	}
}

func TestCreateRecurringEventUntilBoundary(t *testing.T) {
	svc := getTestService(t)

	start := monday()
	third := start.AddDate(0, 0, 14)

	t.Run("an_occurrence_starting_exactly_at_until_is_included", func(t *testing.T) {
		userID := uint(81)
		_, err := svc.CreateEvent(userID, weeklyRequest(third), time.UTC)
		require.NoError(t, err)

		events, err := svc.GetEvents(userID, nil)
		require.NoError(t, err)
		assert.Len(t, events, 3)
	})

	t.Run("an_occurrence_starting_after_until_is_excluded", func(t *testing.T) {
		userID := uint(82)
		_, err := svc.CreateEvent(userID, weeklyRequest(third.Add(-time.Second)), time.UTC)
		require.NoError(t, err)

		events, err := svc.GetEvents(userID, nil)
		require.NoError(t, err)
		assert.Len(t, events, 2)
	})
}

func TestCreateRecurringEventRejectsInvalidRules(t *testing.T) {
	svc := getTestService(t)
	userID := uint(82)

	start := monday()
	zero := 0
	huge := 53
	beforeStart := start.Add(-time.Hour)

	tests := []struct {
		name       string
		recurrence *dto.CalendarRecurrenceRequest
		wantErr    string
	}{
		{
			name: "missing_until",
			recurrence: &dto.CalendarRecurrenceRequest{
				Rule: dto.RecurrenceRuleWeekly,
			},
			wantErr: "until is required",
		},
		{
			name: "unsupported_rule",
			recurrence: &dto.CalendarRecurrenceRequest{
				Rule:  "daily",
				Until: &start,
			},
			wantErr: "unsupported recurrence rule",
		},
		{
			name: "until_before_start",
			recurrence: &dto.CalendarRecurrenceRequest{
				Rule:  dto.RecurrenceRuleWeekly,
				Until: &beforeStart,
			},
			wantErr: "until must not be before",
		},
		{
			name: "interval_below_one",
			recurrence: &dto.CalendarRecurrenceRequest{
				Rule:     dto.RecurrenceRuleWeekly,
				Interval: &zero,
				Until:    &start,
			},
			wantErr: "interval must be between 1 and 52 weeks",
		},
		{
			name: "interval_above_the_maximum",
			recurrence: &dto.CalendarRecurrenceRequest{
				Rule:     dto.RecurrenceRuleWeekly,
				Interval: &huge,
				Until:    &start,
			},
			wantErr: "interval must be between 1 and 52 weeks",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := baseRequest()
			req.Recurrence = tt.recurrence

			resp, err := svc.CreateEvent(userID, req, time.UTC)
			require.Error(t, err)
			assert.Nil(t, resp)
			assert.Contains(t, err.Error(), tt.wantErr)

			events, err := svc.GetEvents(userID, nil)
			require.NoError(t, err)
			assert.Empty(t, events)
		})
	}
}

func TestCreateRecurringEventRejectsTooManyOccurrences(t *testing.T) {
	svc := getTestService(t)
	userID := uint(83)

	start := monday()

	// 100 occurrences fit in the cap.
	_, err := svc.CreateEvent(userID, weeklyRequest(start.AddDate(0, 0, 99*7)), time.UTC)
	require.NoError(t, err)

	events, err := svc.GetEvents(userID, nil)
	require.NoError(t, err)
	require.Len(t, events, 100)

	// The 101st occurrence is rejected instead of being truncated.
	_, err = svc.CreateEvent(userID, weeklyRequest(start.AddDate(0, 0, 100*7)), time.UTC)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "maximum of 100 occurrences")

	events, err = svc.GetEvents(userID, nil)
	require.NoError(t, err)
	assert.Len(t, events, 100)
}

func TestUpdateEventSeriesScope(t *testing.T) {
	svc := getTestService(t)
	userID := uint(84)

	start := monday()
	created, err := svc.CreateEvent(userID, weeklyRequest(start.AddDate(0, 0, 21)), time.UTC)
	require.NoError(t, err)

	t.Run("occurrence_scope_touches_a_single_occurrence", func(t *testing.T) {
		title := "Only this one"
		resp, err := svc.UpdateEvent(userID, created.ID, &dto.UpdateCalendarEventRequest{
			Title: &title,
			Scope: dto.ScopeOccurrence,
		})
		require.NoError(t, err)
		assert.Equal(t, title, resp.Title)

		events, err := svc.GetEvents(userID, nil)
		require.NoError(t, err)
		require.Len(t, events, 4)
		assert.Equal(t, title, events[0].Title)
		assert.Equal(t, "English class", events[1].Title)
	})

	t.Run("series_scope_touches_every_occurrence", func(t *testing.T) {
		title := "Whole series"
		resp, err := svc.UpdateEvent(userID, created.ID, &dto.UpdateCalendarEventRequest{
			Title: &title,
			Scope: dto.ScopeSeries,
		})
		require.NoError(t, err)
		assert.Equal(t, title, resp.Title)

		events, err := svc.GetEvents(userID, nil)
		require.NoError(t, err)
		require.Len(t, events, 4)
		for _, event := range events {
			assert.Equal(t, title, event.Title)
		}
	})

	t.Run("series_scope_shifts_every_occurrence", func(t *testing.T) {
		newStart := created.StartAt.Add(time.Hour)
		newEnd := newStart.Add(2 * time.Hour)

		_, err := svc.UpdateEvent(userID, created.ID, &dto.UpdateCalendarEventRequest{
			StartAt: &newStart,
			EndAt:   &newEnd,
			Scope:   dto.ScopeSeries,
		})
		require.NoError(t, err)

		events, err := svc.GetEvents(userID, nil)
		require.NoError(t, err)
		require.Len(t, events, 4)
		for i, event := range events {
			expected := newStart.AddDate(0, 0, 7*i)
			assert.True(t, expected.Equal(event.StartAt), "occurrence %d starts at %s", i, event.StartAt)
			assert.True(t, expected.Add(2*time.Hour).Equal(event.EndAt), "occurrence %d ends at %s", i, event.EndAt)
		}
	})

	t.Run("series_scope_on_a_single_event_behaves_like_an_occurrence", func(t *testing.T) {
		single, err := svc.CreateEvent(userID, baseRequest(), time.UTC)
		require.NoError(t, err)

		title := "Renamed"
		resp, err := svc.UpdateEvent(userID, single.ID, &dto.UpdateCalendarEventRequest{
			Title: &title,
			Scope: dto.ScopeSeries,
		})
		require.NoError(t, err)
		assert.Equal(t, title, resp.Title)
	})
}

func TestDeleteEventSeriesScope(t *testing.T) {
	svc := getTestService(t)
	userID := uint(85)

	start := monday()
	created, err := svc.CreateEvent(userID, weeklyRequest(start.AddDate(0, 0, 21)), time.UTC)
	require.NoError(t, err)

	events, err := svc.GetEvents(userID, nil)
	require.NoError(t, err)
	require.Len(t, events, 4)

	t.Run("occurrence_scope_removes_a_single_occurrence", func(t *testing.T) {
		require.NoError(t, svc.DeleteEvent(userID, events[1].ID, dto.ScopeOccurrence))

		remaining, err := svc.GetEvents(userID, nil)
		require.NoError(t, err)
		assert.Len(t, remaining, 3)
	})

	t.Run("series_scope_removes_every_occurrence", func(t *testing.T) {
		require.NoError(t, svc.DeleteEvent(userID, created.ID, dto.ScopeSeries))

		remaining, err := svc.GetEvents(userID, nil)
		require.NoError(t, err)
		assert.Empty(t, remaining)
	})

	t.Run("series_scope_on_a_single_event_removes_it", func(t *testing.T) {
		single, err := svc.CreateEvent(userID, baseRequest(), time.UTC)
		require.NoError(t, err)

		require.NoError(t, svc.DeleteEvent(userID, single.ID, dto.ScopeSeries))

		_, err = svc.GetEvent(userID, single.ID)
		assert.Error(t, err)
	})
}

// TestRecurrenceKeepsLocalTimeAcrossDST verifies that a weekly series keeps
// its wall-clock time when the user's timezone changes its UTC offset. The
// series starts before the spring-forward transition (2026-03-08 in New York),
// so the occurrences after it must still be at 10:00 local time.
func TestRecurrenceKeepsLocalTimeAcrossDST(t *testing.T) {
	svc := getTestService(t)

	loc, err := time.LoadLocation("America/New_York")
	require.NoError(t, err)

	// 2026-03-02 10:00 in New York (EST, UTC-5) = 15:00 UTC.
	start := time.Date(2026, time.March, 2, 15, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Hour)
	until := start.AddDate(0, 0, 21)

	created, err := svc.CreateEvent(77, &dto.CreateCalendarEventRequest{
		Title:    "English class",
		Category: "Study",
		StartAt:  start,
		EndAt:    end,
		Recurrence: &dto.CalendarRecurrenceRequest{
			Rule:  dto.RecurrenceRuleWeekly,
			Until: &until,
		},
	}, loc)
	require.NoError(t, err)
	require.NotNil(t, created)

	events, err := svc.GetEvents(77, &dto.CalendarEventFilter{From: &start, To: &until})
	require.NoError(t, err)
	require.Len(t, events, 4)

	for _, event := range events {
		local := event.StartAt.In(loc)
		assert.Equal(t, 10, local.Hour(), "occurrence %s must stay at 10:00 local", event.StartAt)
		assert.Equal(t, 0, local.Minute(), "occurrence %s must stay at 10:00 local", event.StartAt)
	}

	// The first occurrence is before the transition (15:00 UTC), the second
	// after it (14:00 UTC) - one hour less in UTC, same time on the clock.
	assert.Equal(t, 15, events[0].StartAt.UTC().Hour())
	assert.Equal(t, 14, events[1].StartAt.UTC().Hour())
}

// TestCreateRecurringEventWithWeekdays covers weekly series that repeat on
// several week days, the persisted echo of the normalized day list, and the
// validation feedback drawn from bad day names.
func TestCreateRecurringEventWithWeekdays(t *testing.T) {
	svc := getTestService(t)
	userID := uint(88)

	// 2026-10-19 is a Monday; until is exactly four busy weeks later.
	start := monday()
	until := start.AddDate(0, 0, 27)

	req := weeklyRequest(until)
	// Unsorted, with a duplicate: the series must receive a clean list.
	req.Recurrence.Weekdays = []string{"friday", "wednesday", "monday", "monday"}
	created, err := svc.CreateEvent(userID, req, time.UTC)
	require.NoError(t, err)
	require.NotNil(t, created)
	require.NotNil(t, created.RecurrenceWeekdays)
	assert.Equal(t, "monday,wednesday,friday", *created.RecurrenceWeekdays)

	events, err := svc.GetEvents(userID, nil)
	require.NoError(t, err)
	require.Len(t, events, 12) // 3 week days × 4 weeks

	dayOffsets := []int{0, 2, 4} // monday, wednesday, friday
	for i, event := range events {
		expected := start.AddDate(0, 0, (i/3)*7+dayOffsets[i%3])
		assert.True(t, expected.Equal(event.StartAt),
			"occurrence %d must start at %s local, got %s", i, expected, event.StartAt)
		weekday := strings.ToLower(event.StartAt.Weekday().String())
		assert.Contains(t, []string{"monday", "wednesday", "friday"}, weekday,
			"occurrence %s must land on a selected day", event.StartAt)
	}

	t.Run("an_unknown_day_name_is_rejected", func(t *testing.T) {
		req := weeklyRequest(until)
		req.Recurrence.Weekdays = []string{"funday"}
		_, err := svc.CreateEvent(userID+1, req, time.UTC)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unsupported recurrence weekday")
	})

	t.Run("omitted_weekdays_repeat_on_the_start_day_like_before", func(t *testing.T) {
		resp, err := svc.CreateEvent(userID+2, weeklyRequest(until), time.UTC)
		require.NoError(t, err)
		require.NotNil(t, resp.RecurrenceWeekdays)
		assert.Equal(t, "monday", *resp.RecurrenceWeekdays)

		events, err := svc.GetEvents(userID+2, nil)
		require.NoError(t, err)
		require.Len(t, events, 4)
		for i, event := range events {
			assert.True(t, start.AddDate(0, 0, 7*i).Equal(event.StartAt), "occurrence %d", i)
		}
	})
}

// TestRecurrenceWeekdaysKeepLocalTimeAcrossDST verifies that a multi-week-day
// series keeps its wall-clock time across a DST transition: the Sunday
// occurrences after 2026-03-08 in New York (spring forward) stay at 10:00.
func TestRecurrenceWeekdaysKeepLocalTimeAcrossDST(t *testing.T) {
	svc := getTestService(t)

	loc, err := time.LoadLocation("America/New_York")
	require.NoError(t, err)

	// 2026-03-02 10:00 in New York (EST, UTC-5) = 15:00 UTC. The Sundays are
	// generated from the same wall clock and must survive the DST shift.
	start := time.Date(2026, time.March, 2, 15, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Hour)
	until := start.AddDate(0, 0, 25) // Mar 27, after the last Sunday occurrence

	req := &dto.CreateCalendarEventRequest{
		Title:    "Gym sessions",
		Category: "Exercise",
		StartAt:  start,
		EndAt:    end,
		Recurrence: &dto.CalendarRecurrenceRequest{
			Rule: dto.RecurrenceRuleWeekly,
			// Some week days of the user, unsorted, plus Sunday, which is the
			// day whose wall clock the DST change moves.
			Weekdays: []string{"sunday", "monday"},
			Until:    &until,
		},
	}

	created, err := svc.CreateEvent(uint(78), req, loc)
	require.NoError(t, err)
	require.NotNil(t, created)
	require.NotNil(t, created.RecurrenceWeekdays)
	assert.Equal(t, "monday,sunday", *created.RecurrenceWeekdays)

	events, err := svc.GetEvents(78, &dto.CalendarEventFilter{From: &start, To: &until})
	require.NoError(t, err)

	// Mondays 2, 9, 16, 23 and Sundays 8, 15, 22 - seven occurrences in
	// chronological order.
	require.Len(t, events, 7)

	for i, event := range events {
		local := event.StartAt.In(loc)
		weekday := local.Weekday()
		expectedDay := time.Monday
		if i%2 == 1 {
			expectedDay = time.Sunday
		}
		assert.Equal(t, expectedDay, weekday, "occurrence %d (%s)", i, event.StartAt)
		assert.Equal(t, 10, local.Hour(), "occurrence %d (%s) must stay at 10:00 local", i, event.StartAt)
		assert.Equal(t, 0, local.Minute())
		assert.True(t, event.StartAt.Add(2*time.Hour).Equal(event.EndAt), "occurrence %d duration", i)
	}

	// The generated wall clock pair around the DST transition is special:
	// Monday 2026-03-02 (EST) at 15:00 UTC, the next event Sunday 2026-03-08
	// at 14:00 UTC - one hour less in UTC for the same 10:00 on the clock.
	assert.Equal(t, 15, events[0].StartAt.UTC().Hour())
	assert.Equal(t, 14, events[1].StartAt.UTC().Hour())
}
