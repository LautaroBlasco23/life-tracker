package service

import (
	"errors"
	"fmt"
	"reflect"
	"sync"
	"time"

	calendarModel "life-tracker-backend/internal/domain/calendar/model"

	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// The calendar_events sheet is generated from the GORM model instead of a
// hand-written column list: the model is the single source of truth for the
// table, so a column added to it (a location, a reminder flag, ...) is
// exported and imported without touching the backup code.

// calendarColumn is one column of calendar_events, taken from the model.
type calendarColumn struct {
	name  string // column name in the table
	field reflect.StructField
}

var calendarEventColumns = mustCalendarEventColumns()

func mustCalendarEventColumns() []calendarColumn {
	parsed, err := schema.Parse(&calendarModel.CalendarEvent{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		panic(fmt.Sprintf("cannot read the calendar event model: %v", err))
	}
	columns := make([]calendarColumn, 0, len(parsed.Fields))
	for _, field := range parsed.Fields {
		if field.DBName == "" {
			continue
		}
		columns = append(columns, calendarColumn{name: field.DBName, field: field.StructField})
	}
	return columns
}

// calendarEventHeader returns the column layout of the calendar_events sheet.
func calendarEventHeader() []string {
	header := make([]string, len(calendarEventColumns))
	for i, col := range calendarEventColumns {
		header[i] = col.name
	}
	return header
}

// calendarEventRows encodes the events as sheet rows, one cell per column.
func calendarEventRows(items []calendarModel.CalendarEvent) [][]interface{} {
	rows := make([][]interface{}, 0, len(items))
	for _, event := range items {
		value := reflect.ValueOf(event)
		row := make([]interface{}, len(calendarEventColumns))
		for i, col := range calendarEventColumns {
			row[i] = encodeCalendarValue(value.FieldByIndex(col.field.Index))
		}
		rows = append(rows, row)
	}
	return rows
}

func encodeCalendarValue(field reflect.Value) string {
	switch value := field.Interface().(type) {
	case time.Time:
		return encTime(value)
	case gorm.DeletedAt:
		return encOptionalTime(value)
	case uint:
		return encUint(value)
	case string:
		return value
	case bool:
		return encBool(value)
	case int:
		return encInt(value)
	default:
		return fmt.Sprint(value)
	}
}

// decodeCalendarEvent reads one sheet row into an event. The archived id and
// owner are ignored on purpose: an import always mints a fresh id (the id
// sequence is global, so archived ids could collide with another user's
// rows) and re-owns the row with the importing user.
func decodeCalendarEvent(sh *sheet, row []string) (calendarModel.CalendarEvent, error) {
	var event calendarModel.CalendarEvent
	target := reflect.ValueOf(&event).Elem()
	for _, col := range calendarEventColumns {
		switch col.name {
		case "id", "user_id":
			continue
		}
		if err := setCalendarValue(target.FieldByIndex(col.field.Index), sh.get(row, col.name)); err != nil {
			return event, fmt.Errorf("%s: %w", col.name, err)
		}
	}
	return event, nil
}

func setCalendarValue(field reflect.Value, raw string) error {
	switch field.Interface().(type) {
	case time.Time:
		parsed, err := decTime(raw)
		if err != nil {
			return err
		}
		field.Set(reflect.ValueOf(parsed))
	case gorm.DeletedAt:
		if raw == "" {
			return nil
		}
		parsed, err := decTime(raw)
		if err != nil {
			return err
		}
		field.Set(reflect.ValueOf(gorm.DeletedAt{Time: parsed, Valid: true}))
	case uint:
		parsed, err := decUint(raw)
		if err != nil {
			return err
		}
		field.Set(reflect.ValueOf(parsed))
	case string:
		field.SetString(raw)
	case bool:
		parsed, err := decBool(raw)
		if err != nil {
			return err
		}
		field.SetBool(parsed)
	case int:
		parsed, err := decInt(raw)
		if err != nil {
			return err
		}
		field.SetInt(int64(parsed))
	default:
		return fmt.Errorf("unsupported column type %s", field.Type())
	}
	return nil
}

// maxCalendarEventDuration mirrors the limit of the calendar domain: an
// event may not be longer than 24 hours.
const maxCalendarEventDuration = 24 * time.Hour

// validateCalendarEvent applies the rules of the calendar domain to a row
// read from a backup file, so a restored event is always a valid event.
func validateCalendarEvent(event *calendarModel.CalendarEvent) error {
	if event.Title == "" {
		return errors.New("title must not be empty")
	}
	if !event.EndAt.After(event.StartAt) {
		return errors.New("end_at must be after start_at")
	}
	if event.EndAt.Sub(event.StartAt) > maxCalendarEventDuration {
		return errors.New("event must not exceed 24 hours")
	}
	return nil
}
