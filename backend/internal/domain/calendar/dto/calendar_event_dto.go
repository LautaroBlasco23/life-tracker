package dto

import "time"

// Scope of an update or delete on an event that belongs to a recurring
// series. An empty scope means "occurrence".
const (
	ScopeOccurrence = "occurrence"
	ScopeSeries     = "series"
)

// RecurrenceRuleWeekly is the only recurrence rule supported so far.
const RecurrenceRuleWeekly = "weekly"

// CalendarRecurrenceRequest describes the recurrence of a new event. Only
// "weekly" is supported; `until` is required and bounds the last occurrence.
// The rule, interval and weekdays are validated by the service, which returns
// a precise error message.
type CalendarRecurrenceRequest struct {
	Rule     string     `json:"rule" binding:"required"`
	Interval *int       `json:"interval,omitempty"`
	Until    *time.Time `json:"until,omitempty"`
	// Week day names the series repeats on (e.g. ["monday","friday"]).
	// An omitted list defaults to the start date's weekday.
	Weekdays []string `json:"weekdays,omitempty"`
}

type CreateCalendarEventRequest struct {
	Title       string                     `json:"title" binding:"required,min=1,max=255"`
	Description string                     `json:"description" binding:"max=1000"`
	Category    string                     `json:"category" binding:"required,min=1,max=100"`
	StartAt     time.Time                  `json:"startAt" binding:"required"`
	EndAt       time.Time                  `json:"endAt" binding:"required"`
	Recurrence  *CalendarRecurrenceRequest `json:"recurrence,omitempty"`
}

type UpdateCalendarEventRequest struct {
	Title       *string    `json:"title,omitempty" binding:"omitempty,min=1,max=255"`
	Description *string    `json:"description,omitempty" binding:"omitempty,max=1000"`
	Category    *string    `json:"category,omitempty" binding:"omitempty,min=1,max=100"`
	StartAt     *time.Time `json:"startAt,omitempty"`
	EndAt       *time.Time `json:"endAt,omitempty"`
	// Scope selects the occurrences an update applies to: the event itself
	// (default) or every occurrence of the series it belongs to.
	Scope string `json:"scope,omitempty" binding:"omitempty,oneof=occurrence series"`
}

type CalendarEventResponse struct {
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`
	Title              string     `json:"title"`
	Description        string     `json:"description"`
	Category           string     `json:"category"`
	StartAt            time.Time  `json:"startAt"`
	EndAt              time.Time  `json:"endAt"`
	ID                 uint       `json:"id"`
	SeriesID           *string    `json:"seriesId,omitempty"`
	OccurrenceIndex    *int       `json:"occurrenceIndex,omitempty"`
	RecurrenceRule     *string    `json:"recurrenceRule,omitempty"`
	RecurrenceUntil    *time.Time `json:"recurrenceUntil,omitempty"`
	RecurrenceInterval *int       `json:"recurrenceInterval,omitempty"`
	// Comma-separated day names the series repeats on, e.g.
	// "monday,wednesday". Echoed for clients; the series is already
	// materialized as one row per occurrence.
	RecurrenceWeekdays *string `json:"recurrenceWeekdays,omitempty"`
}

// CalendarEventFilter selects events overlapping [From, To). Both bounds are
// optional; callers always pass either both or neither.
type CalendarEventFilter struct {
	From *time.Time
	To   *time.Time
}
