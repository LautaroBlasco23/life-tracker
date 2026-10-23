package dto

// RestoreCounts reports how many rows were restored per entity.
type RestoreCounts struct {
	Activities        int `json:"activities"`
	TimeRecords       int `json:"timeRecords"`
	CalendarEvents    int `json:"calendarEvents"`
	Notes             int `json:"notes"`
	Routines          int `json:"routines"`
	RoutineActivities int `json:"routineActivities"`
	ActivityRecords   int `json:"activityRecords"`
	Transactions      int `json:"transactions"`
	Payments          int `json:"payments"`
}
