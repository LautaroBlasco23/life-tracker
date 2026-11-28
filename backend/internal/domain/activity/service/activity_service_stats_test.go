// activity_service_stats_test.go
//
// Subject:      internal/domain/activity/service.ActivityService — the methods
//
//	not exercised by activity_service_test.go (records, stats,
//	public listing, streak calculation per frequency).
//
// Scope:        GetActivityRecords ownership + limit, GetActivityStats shape
//
//	(total completions, streaks, recent records), ListPublicByUser
//	privacy scoping, and CalculateStreak for daily / weekly /
//	monthly activities.
//
// Out of scope: CRUD basics and today-window logic → activity_service_test.go;
//
//	HTTP contract → activity_controller_test.go.
//
// Infrastructure: PostgreSQL + MongoDB (test instances via .env.test).
// Data strategy:  TRUNCATE activities/routines + drop all Mongo collections
//
//	before each top-level test (via getTestService/cleanDatabase).
//
// Parallel-safe:  No — single shared DB connection, no per-test namespace.
package service

import (
	"testing"
	"time"

	"life-tracker-backend/internal/domain/activity/dto"
	"life-tracker-backend/internal/domain/activity/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// seedStreakActivity creates an active activity owned by userID.
func seedStreakActivity(t *testing.T, tc *testContext, userID uint, title string, freq model.Frequency, dayFrequency string, amount int) model.Activity {
	t.Helper()
	activity := model.Activity{
		UserID:           userID,
		Title:            title,
		Description:      "Description of " + title,
		Frequency:        freq,
		DayFrequency:     dayFrequency,
		DayTime:          model.DayTimeMorning,
		CompletionAmount: amount,
		IsActive:         true,
		PrivacyStatus:    model.PrivacyPrivate,
	}
	require.NoError(t, tc.db.Create(&activity).Error)
	return activity
}

// completeAt records a completion through the service at a given instant.
func completeAt(t *testing.T, tc *testContext, userID, activityID uint, at time.Time) {
	t.Helper()
	_, err := tc.service.RecordActivity(userID, activityID, &dto.RecordActivityRequest{
		CompletionDate: at,
	})
	require.NoError(t, err)
}

func TestGetActivityRecords(t *testing.T) {
	tc := getTestService(t)
	userID := uint(201)
	activity := seedStreakActivity(t, tc, userID, "Records", model.FrequencyDaily, "", 1)

	completeAt(t, tc, userID, activity.ID, time.Now().UTC().Add(-2*24*time.Hour))
	completeAt(t, tc, userID, activity.ID, time.Now().UTC().Add(-1*24*time.Hour))

	t.Run("returns the activity's records newest first", func(t *testing.T) {
		records, err := tc.service.GetActivityRecords(userID, activity.ID, 10)
		require.NoError(t, err)
		require.Len(t, records, 2)
		assert.True(t, records[0].CompletionDate.After(records[1].CompletionDate) ||
			records[0].CompletionDate.Equal(records[1].CompletionDate))
	})

	t.Run("respects the limit", func(t *testing.T) {
		records, err := tc.service.GetActivityRecords(userID, activity.ID, 1)
		require.NoError(t, err)
		assert.Len(t, records, 1)
	})

	t.Run("unknown activity returns error", func(t *testing.T) {
		_, err := tc.service.GetActivityRecords(userID, 9999, 10)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "activity not found")
	})

	t.Run("foreign activity is invisible", func(t *testing.T) {
		_, err := tc.service.GetActivityRecords(202, activity.ID, 10)
		require.Error(t, err)
	})
}

func TestGetActivityStats(t *testing.T) {
	t.Run("aggregates completions, streak and recent records", func(t *testing.T) {
		tc := getTestService(t)
		userID := uint(301)
		activity := seedStreakActivity(t, tc, userID, "Stats", model.FrequencyDaily, "", 1)

		now := time.Now().UTC()
		completeAt(t, tc, userID, activity.ID, now)
		completeAt(t, tc, userID, activity.ID, now.Add(-24*time.Hour))

		stats, err := tc.service.GetActivityStats(userID, activity.ID, testLoc)
		require.NoError(t, err)
		assert.Equal(t, activity.ID, stats.ActivityID)
		assert.Equal(t, "Stats", stats.Title)
		assert.Equal(t, int64(2), stats.TotalCompletions)
		assert.GreaterOrEqual(t, stats.CurrentStreak, 1)
		assert.GreaterOrEqual(t, stats.LongestStreak, 1)
		require.Len(t, stats.RecentRecords, 2)
	})

	t.Run("activity without records has zero streak", func(t *testing.T) {
		tc := getTestService(t)
		userID := uint(302)
		activity := seedStreakActivity(t, tc, userID, "Empty", model.FrequencyDaily, "", 1)

		stats, err := tc.service.GetActivityStats(userID, activity.ID, testLoc)
		require.NoError(t, err)
		assert.Equal(t, int64(0), stats.TotalCompletions)
		assert.Equal(t, 0, stats.CurrentStreak)
		assert.Equal(t, 0, stats.LongestStreak)
		assert.Empty(t, stats.RecentRecords)
	})

	t.Run("unknown activity returns error", func(t *testing.T) {
		tc := getTestService(t)

		_, err := tc.service.GetActivityStats(303, 9999, testLoc)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "activity not found")
	})
}

func TestCalculateStreak_ByFrequency(t *testing.T) {
	t.Run("daily streak counts consecutive days", func(t *testing.T) {
		tc := getTestService(t)
		userID := uint(401)
		activity := seedStreakActivity(t, tc, userID, "Daily", model.FrequencyDaily, "", 1)

		now := time.Now().UTC()
		completeAt(t, tc, userID, activity.ID, now)
		completeAt(t, tc, userID, activity.ID, now.Add(-24*time.Hour))
		// A three-day gap closes the streak.

		streak, err := tc.service.CalculateStreak(userID, activity.ID, &activity, testLoc)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, streak.Current, 2)
	})

	t.Run("daily streak breaks after a gap", func(t *testing.T) {
		tc := getTestService(t)
		userID := uint(402)
		activity := seedStreakActivity(t, tc, userID, "Gap", model.FrequencyDaily, "", 1)

		now := time.Now().UTC()
		completeAt(t, tc, userID, activity.ID, now)
		completeAt(t, tc, userID, activity.ID, now.Add(-3*24*time.Hour))

		streak, err := tc.service.CalculateStreak(userID, activity.ID, &activity, testLoc)
		require.NoError(t, err)
		assert.Equal(t, 1, streak.Current)
		assert.Equal(t, 1, streak.Longest)
	})

	t.Run("weekly streak counts scheduled weekdays", func(t *testing.T) {
		tc := getTestService(t)
		userID := uint(403)
		activity := seedStreakActivity(t, tc, userID, "Weekly",
			model.FrequencyWeekly, `["monday"]`, 1)

		// Monday of the current ISO week, and the Monday before it.
		today := time.Now().UTC()
		thisMonday := today.AddDate(0, 0, -int(today.Weekday())+1)
		completeAt(t, tc, userID, activity.ID, thisMonday)
		completeAt(t, tc, userID, activity.ID, thisMonday.AddDate(0, 0, -7))

		streak, err := tc.service.CalculateStreak(userID, activity.ID, &activity, testLoc)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, streak.Current, 2)
	})

	t.Run("weekly streak without day frequency is zero", func(t *testing.T) {
		tc := getTestService(t)
		userID := uint(404)
		activity := seedStreakActivity(t, tc, userID, "NoSchedule", model.FrequencyWeekly, "", 1)

		completeAt(t, tc, userID, activity.ID, time.Now().UTC())

		streak, err := tc.service.CalculateStreak(userID, activity.ID, &activity, testLoc)
		require.NoError(t, err)
		assert.Equal(t, 0, streak.Current)
	})

	t.Run("monthly streak counts consecutive months", func(t *testing.T) {
		tc := getTestService(t)
		userID := uint(405)
		activity := seedStreakActivity(t, tc, userID, "Monthly", model.FrequencyMonthly, "", 1)

		now := time.Now().UTC()
		completeAt(t, tc, userID, activity.ID, now)
		completeAt(t, tc, userID, activity.ID, now.AddDate(0, -1, 0))

		streak, err := tc.service.CalculateStreak(userID, activity.ID, &activity, testLoc)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, streak.Current, 2)
	})

	t.Run("unknown frequency yields zero streak", func(t *testing.T) {
		tc := getTestService(t)
		userID := uint(406)
		activity := seedStreakActivity(t, tc, userID, "Weird", model.Frequency("unknown"), "", 1)

		completeAt(t, tc, userID, activity.ID, time.Now().UTC())

		streak, err := tc.service.CalculateStreak(userID, activity.ID, &activity, testLoc)
		require.NoError(t, err)
		assert.Equal(t, 0, streak.Current)
	})
}

func TestListPublicByUser(t *testing.T) {
	tc := getTestService(t)
	userID := uint(501)

	publicActivity := seedStreakActivity(t, tc, userID, "Public", model.FrequencyDaily, "", 1)
	require.NoError(t, tc.db.Model(&model.Activity{}).
		Where("id = ?", publicActivity.ID).
		Update("privacy_status", model.PrivacyPublic).Error)
	seedStreakActivity(t, tc, userID, "Private", model.FrequencyDaily, "", 1)
	seedStreakActivity(t, tc, 502, "Foreign", model.FrequencyDaily, "", 1)

	activities, err := tc.service.ListPublicByUser(userID)
	require.NoError(t, err)
	require.Len(t, activities, 1)
	assert.Equal(t, "Public", activities[0].Title)
	assert.Equal(t, "public", activities[0].PrivacyStatus)
}
