// Package streak computes due-based day streaks from per-day completion counts.
//
// A day counts toward a streak when every activity due that day was completed.
// Due rules mirror the Today tab:
//   - daily:  always due
//   - weekly: due only on scheduled weekdays
//   - monthly: due until the first completion of the calendar month
//
// Days where no activity is due are skipped (they neither extend nor break
// the streak).
package streak

import (
	"encoding/json"
	"time"

	"life-tracker-backend/internal/domain/activity/dto"
	"life-tracker-backend/internal/domain/activity/model"
)

const DefaultWindowDays = 365

// Input describes one activity participating in a streak.
type Input struct {
	ActivityID       uint
	Frequency        model.Frequency
	DayFrequency     []string // lowercase weekday names (weekly only)
	CompletionAmount int
}

// ParseDayFrequency decodes the JSON-encoded day list stored on activities.
func ParseDayFrequency(raw string) []string {
	if raw == "" {
		return nil
	}
	var days []string
	if err := json.Unmarshal([]byte(raw), &days); err != nil {
		return nil
	}
	return days
}

// Window returns the inclusive record window (from, to) covering the last
// windowDays days plus today, bucketed in loc. to is exclusive.
func Window(loc *time.Location, windowDays int) (time.Time, time.Time) {
	now := time.Now().In(loc)
	startToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	from := startToday.AddDate(0, 0, -windowDays-1)
	to := startToday.AddDate(0, 0, 1)
	return from, to
}

// Compute walks backwards from today and returns the current and longest
// consecutive-run of fully-completed due days. daily maps activityID to
// dayKey ("2006-01-02" in loc) to completion count.
func Compute(daily map[uint]map[string]int, inputs []Input, loc *time.Location, windowDays int) dto.StreakInfo {
	return computeAt(daily, inputs, loc, windowDays, time.Now().In(loc))
}

// buildSchedules precomputes, per activity: the earliest completed
// day-of-month per month ("2006-01" -> day) and, for weekly activities, the
// set of due weekdays.
func buildSchedules(daily map[uint]map[string]int, inputs []Input) (map[uint]map[string]int, map[uint]map[time.Weekday]bool) {
	earliestPerMonth := make(map[uint]map[string]int, len(inputs))
	weeklyDays := make(map[uint]map[time.Weekday]bool, len(inputs))

	for _, in := range inputs {
		counts := daily[in.ActivityID]
		for dayKey, count := range counts {
			if count < in.CompletionAmount {
				continue
			}
			t, err := time.Parse("2006-01-02", dayKey)
			if err != nil {
				continue
			}
			monthKey := dayKey[:7]
			dayOfMonth := t.Day()
			if earliestPerMonth[in.ActivityID] == nil {
				earliestPerMonth[in.ActivityID] = make(map[string]int)
			}
			if cur, ok := earliestPerMonth[in.ActivityID][monthKey]; !ok || dayOfMonth < cur {
				earliestPerMonth[in.ActivityID][monthKey] = dayOfMonth
			}
		}
		if in.Frequency == model.FrequencyWeekly {
			set := make(map[time.Weekday]bool, len(in.DayFrequency))
			for _, d := range in.DayFrequency {
				if wd, ok := weekdayFromName(d); ok {
					set[wd] = true
				}
			}
			weeklyDays[in.ActivityID] = set
		}
	}

	return earliestPerMonth, weeklyDays
}

// dueOn reports whether the activity is due (or overdue) on the given date
// under its configured frequency.
func dueOn(in Input, weeklyDays map[uint]map[time.Weekday]bool, earliestPerMonth map[uint]map[string]int, d time.Time) bool {
	switch in.Frequency {
	case model.FrequencyDaily:
		return true
	case model.FrequencyWeekly:
		return weeklyDays[in.ActivityID][d.Weekday()]
	case model.FrequencyMonthly:
		// Overdue from the day after the earliest completion until the next
		// completion re-anchors the month.
		earliest, ok := earliestPerMonth[in.ActivityID][d.Format("2006-01")]
		return !ok || earliest > d.Day()
	default:
		return false
	}
}

// dayStatus walks the due activities of one day: anyDue says whether any
// activity was due, allDone whether all due ones met their completion amount.
func dayStatus(daily map[uint]map[string]int, inputs []Input, weeklyDays map[uint]map[time.Weekday]bool, earliestPerMonth map[uint]map[string]int, d time.Time) (anyDue, allDone bool) {
	dayKey := d.Format("2006-01-02")
	allDone = true
	for _, in := range inputs {
		if !dueOn(in, weeklyDays, earliestPerMonth, d) {
			continue
		}
		anyDue = true
		if daily[in.ActivityID][dayKey] < in.CompletionAmount {
			allDone = false
		}
	}
	return anyDue, allDone
}

// computeAt is Compute with an explicit reference date for testability.
func computeAt(daily map[uint]map[string]int, inputs []Input, loc *time.Location, windowDays int, today time.Time) dto.StreakInfo {
	if len(inputs) == 0 {
		return dto.StreakInfo{Current: 0, Longest: 0}
	}

	earliestPerMonth, weeklyDays := buildSchedules(daily, inputs)

	today = today.In(loc)

	current, longest, run := 0, 0, 0
	broke := false
	for i := 0; i < windowDays; i++ {
		d := today.AddDate(0, 0, -i)
		anyDue, allDone := dayStatus(daily, inputs, weeklyDays, earliestPerMonth, d)
		if !anyDue {
			continue
		}
		switch {
		case allDone:
			run++
			if run > longest {
				longest = run
			}
		case !broke:
			// The current streak ends at the first incomplete due day
			// encountered walking backwards; keep scanning for longest.
			current = run
			broke = true
			run = 0
		default:
			run = 0
		}
	}

	if !broke {
		current = run
	}
	return dto.StreakInfo{Current: current, Longest: longest}
}

func weekdayFromName(name string) (time.Weekday, bool) {
	switch name {
	case "sunday":
		return time.Sunday, true
	case "monday":
		return time.Monday, true
	case "tuesday":
		return time.Tuesday, true
	case "wednesday":
		return time.Wednesday, true
	case "thursday":
		return time.Thursday, true
	case "friday":
		return time.Friday, true
	case "saturday":
		return time.Saturday, true
	}
	return time.Sunday, false
}
