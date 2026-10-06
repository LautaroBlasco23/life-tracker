package streak

import (
	"testing"
	"time"

	"life-tracker-backend/internal/domain/activity/model"
)

func locUTC(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation("UTC")
	if err != nil {
		t.Fatalf("failed to load UTC: %v", err)
	}
	return loc
}

func TestComputeDailyStreak(t *testing.T) {
	loc := locUTC(t)
	// Reference today: 2026-08-13 (Thursday)
	today := time.Date(2026, 8, 13, 12, 0, 0, 0, loc)

	// Completed today, yesterday, and the day before; missed 3 days ago.
	daily := map[uint]map[string]int{
		1: {
			"2026-08-13": 1,
			"2026-08-12": 2, // >= CompletionAmount
			"2026-08-11": 1,
			"2026-08-08": 1, // old run
			"2026-08-07": 1,
		},
	}

	inputs := []Input{
		{ActivityID: 1, Frequency: model.FrequencyDaily, CompletionAmount: 1},
	}

	got := computeAt(daily, inputs, loc, DefaultWindowDays, today)
	if got.Current != 3 {
		t.Errorf("current = %d, want 3", got.Current)
	}
	if got.Longest != 3 {
		t.Errorf("longest = %d, want 3", got.Longest)
	}
}

func TestComputeDailyStreakBreaksOnMissedDay(t *testing.T) {
	loc := locUTC(t)
	today := time.Date(2026, 8, 13, 12, 0, 0, 0, loc)

	// Today incomplete; yesterday and before completed.
	daily := map[uint]map[string]int{
		1: {
			"2026-08-12": 1,
			"2026-08-11": 1,
		},
	}

	inputs := []Input{
		{ActivityID: 1, Frequency: model.FrequencyDaily, CompletionAmount: 1},
	}

	got := computeAt(daily, inputs, loc, DefaultWindowDays, today)
	if got.Current != 0 {
		t.Errorf("current = %d, want 0 (today incomplete)", got.Current)
	}
	if got.Longest != 2 {
		t.Errorf("longest = %d, want 2", got.Longest)
	}
}

func TestComputeLongestKeepsHistoricalRun(t *testing.T) {
	loc := locUTC(t)
	today := time.Date(2026, 8, 13, 12, 0, 0, 0, loc)

	// 3-day run last month, then a gap, then today complete.
	daily := map[uint]map[string]int{
		1: {
			"2026-08-13": 1,
			"2026-07-10": 1,
			"2026-07-09": 1,
			"2026-07-08": 1,
		},
	}

	inputs := []Input{
		{ActivityID: 1, Frequency: model.FrequencyDaily, CompletionAmount: 1},
	}

	got := computeAt(daily, inputs, loc, DefaultWindowDays, today)
	if got.Current != 1 {
		t.Errorf("current = %d, want 1", got.Current)
	}
	if got.Longest != 3 {
		t.Errorf("longest = %d, want 3", got.Longest)
	}
}

func TestComputeWeeklySkipsNonDueDays(t *testing.T) {
	loc := locUTC(t)
	// 2026-08-10 is a Monday, 2026-08-12 is Wednesday.
	today := time.Date(2026, 8, 13, 12, 0, 0, 0, loc) // Thursday

	// Completed on Mon Aug 10 and Wed Aug 12 of this week and the week before.
	daily := map[uint]map[string]int{
		1: {
			"2026-08-10": 1,
			"2026-08-12": 1,
			"2026-08-03": 1,
			"2026-08-05": 1,
		},
	}

	inputs := []Input{
		{ActivityID: 1, Frequency: model.FrequencyWeekly, DayFrequency: []string{"monday", "wednesday"}, CompletionAmount: 1},
	}

	got := computeAt(daily, inputs, loc, DefaultWindowDays, today)
	// Due days: Mon 8/10, Wed 8/12 (this week), Mon 8/3, Wed 8/5 (last week).
	// Walking back from Thu: Fri/Sat/Sun/Thu skipped; Wed 8/12 done (1);
	// Tue skipped; Mon 8/10 done (2); Sun/Sat skipped; Fri skipped; Thu skipped;
	// Wed 8/5 done (3); Tue skipped; Mon 8/3 done (4).
	if got.Current != 4 {
		t.Errorf("current = %d, want 4", got.Current)
	}
	if got.Longest != 4 {
		t.Errorf("longest = %d, want 4", got.Longest)
	}
}

func TestComputeWeeklyMissedScheduledDayBreaks(t *testing.T) {
	loc := locUTC(t)
	today := time.Date(2026, 8, 13, 12, 0, 0, 0, loc) // Thursday

	// Monday done, Wednesday of this week MISSED, previous week both done.
	daily := map[uint]map[string]int{
		1: {
			"2026-08-10": 1,
			"2026-08-03": 1,
			"2026-08-05": 1,
		},
	}

	inputs := []Input{
		{ActivityID: 1, Frequency: model.FrequencyWeekly, DayFrequency: []string{"monday", "wednesday"}, CompletionAmount: 1},
	}

	got := computeAt(daily, inputs, loc, DefaultWindowDays, today)
	// Walking back: Wed 8/12 due and NOT done -> breaks at run 0 (current 0).
	if got.Current != 0 {
		t.Errorf("current = %d, want 0 (missed scheduled Wednesday)", got.Current)
	}
	// Completed due days in a row: Mon 8/10, Wed 8/5, Mon 8/3 -> longest 3
	// (skipped non-due days do not break the run).
	if got.Longest != 3 {
		t.Errorf("longest = %d, want 3", got.Longest)
	}
}

func TestComputeMonthlyCompletedCoversRestOfMonth(t *testing.T) {
	loc := locUTC(t)
	// Completed on day 10 of August.
	today := time.Date(2026, 8, 20, 12, 0, 0, 0, loc)

	daily := map[uint]map[string]int{
		1: {"2026-08-10": 1},
	}

	inputs := []Input{
		{ActivityID: 1, Frequency: model.FrequencyMonthly, CompletionAmount: 1},
	}

	got := computeAt(daily, inputs, loc, DefaultWindowDays, today)
	// Days >= 10 in August are covered (not due). Days 1-9 were due and not
	// completed, so the walk breaks at day 9 -> current 0.
	if got.Current != 0 {
		t.Errorf("current = %d, want 0", got.Current)
	}
}

func TestComputeMonthlyOnlyProducesNoDayStreak(t *testing.T) {
	loc := locUTC(t)
	// Completed on day 1 of the current month; July also completed on day 1.
	today := time.Date(2026, 8, 20, 12, 0, 0, 0, loc)

	daily := map[uint]map[string]int{
		1: {
			"2026-08-01": 1,
			"2026-07-01": 1,
		},
	}

	inputs := []Input{
		{ActivityID: 1, Frequency: model.FrequencyMonthly, CompletionAmount: 1},
	}

	got := computeAt(daily, inputs, loc, DefaultWindowDays, today)
	// A monthly activity is "not due" on every day of a month it was completed
	// in (days with nothing due are skipped), and days before the first monthly
	// completion were due but not completed. No day streak exists.
	if got.Current != 0 || got.Longest != 0 {
		t.Errorf("got %+v, want 0/0", got)
	}
}

func TestComputeMonthlyOnlyBreaksWithMissingMonth(t *testing.T) {
	loc := locUTC(t)
	// Completed day 1 in the current and previous month, but missed the month
	// before that (June). Today = Aug 20.
	today := time.Date(2026, 8, 20, 12, 0, 0, 0, loc)

	daily := map[uint]map[string]int{
		1: {
			"2026-08-01": 1,
			"2026-07-01": 1,
		},
	}

	inputs := []Input{
		{ActivityID: 1, Frequency: model.FrequencyMonthly, CompletionAmount: 1},
	}

	got := computeAt(daily, inputs, loc, DefaultWindowDays, today)
	if got.Current != 0 || got.Longest != 0 {
		t.Errorf("got %+v, want 0/0", got)
	}
}

func TestComputeMixedDailyAndMonthly(t *testing.T) {
	loc := locUTC(t)
	// Daily activity completed every day; monthly completed on Aug 10.
	today := time.Date(2026, 8, 20, 12, 0, 0, 0, loc)

	daily := map[uint]map[string]int{
		1: {
			"2026-08-20": 1, "2026-08-19": 1, "2026-08-18": 1, "2026-08-17": 1,
			"2026-08-16": 1, "2026-08-15": 1, "2026-08-14": 1, "2026-08-13": 1,
			"2026-08-12": 1, "2026-08-11": 1, "2026-08-10": 1, "2026-08-09": 1,
			"2026-08-08": 1, "2026-08-07": 1, "2026-08-06": 1, "2026-08-05": 1,
			"2026-08-04": 1, "2026-08-03": 1, "2026-08-02": 1, "2026-08-01": 1,
		},
		2: {"2026-08-10": 1},
	}

	inputs := []Input{
		{ActivityID: 1, Frequency: model.FrequencyDaily, CompletionAmount: 1},
		{ActivityID: 2, Frequency: model.FrequencyMonthly, CompletionAmount: 1},
	}

	got := computeAt(daily, inputs, loc, DefaultWindowDays, today)
	// Monthly is not due from Aug 10 onward, so days Aug 10-20 count as complete
	// (daily done). Day Aug 9: monthly was due and not completed -> streak ends.
	// Current = 11 (Aug 10..20), longest = 11.
	if got.Current != 11 {
		t.Errorf("current = %d, want 11", got.Current)
	}
	if got.Longest != 11 {
		t.Errorf("longest = %d, want 11", got.Longest)
	}
}

func TestComputeNoDueDays(t *testing.T) {
	loc := locUTC(t)
	today := time.Date(2026, 8, 13, 12, 0, 0, 0, loc)

	// A weekly activity with no matching weekday in the window.
	daily := map[uint]map[string]int{}
	inputs := []Input{
		{ActivityID: 1, Frequency: model.FrequencyWeekly, DayFrequency: []string{"monday"}},
	}
	// 2026-08-13 is Thursday; walking 365 days always includes Mondays, so this
	// has due days. Use an impossible weekday name to force "never due".
	inputs[0].DayFrequency = []string{"funday"}

	got := computeAt(daily, inputs, loc, DefaultWindowDays, today)
	if got.Current != 0 || got.Longest != 0 {
		t.Errorf("got %+v, want 0/0", got)
	}
}

func TestComputeEmptyInputs(t *testing.T) {
	loc := locUTC(t)
	today := time.Date(2026, 8, 13, 12, 0, 0, 0, loc)

	got := computeAt(map[uint]map[string]int{}, nil, loc, DefaultWindowDays, today)
	if got.Current != 0 || got.Longest != 0 {
		t.Errorf("got %+v, want 0/0", got)
	}
}

func TestComputeCompletionAmount(t *testing.T) {
	loc := locUTC(t)
	today := time.Date(2026, 8, 13, 12, 0, 0, 0, loc)

	// Requires 2 completions per day; yesterday has only 1.
	daily := map[uint]map[string]int{
		1: {
			"2026-08-13": 2,
			"2026-08-12": 1,
		},
	}

	inputs := []Input{
		{ActivityID: 1, Frequency: model.FrequencyDaily, CompletionAmount: 2},
	}

	got := computeAt(daily, inputs, loc, DefaultWindowDays, today)
	if got.Current != 1 {
		t.Errorf("current = %d, want 1", got.Current)
	}
}

func TestParseDayFrequency(t *testing.T) {
	days := ParseDayFrequency(`["monday","wednesday"]`)
	if len(days) != 2 || days[0] != "monday" || days[1] != "wednesday" {
		t.Errorf("unexpected parse result: %v", days)
	}
	if ParseDayFrequency("") != nil {
		t.Error("empty string should return nil")
	}
	if ParseDayFrequency("not-json") != nil {
		t.Error("invalid JSON should return nil")
	}
}
