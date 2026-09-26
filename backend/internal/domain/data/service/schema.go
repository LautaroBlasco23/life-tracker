package service

// Sheet names and column layout of the backup workbook. This file is the
// single source of truth shared by the export and the import paths, so the
// two can never drift apart.
//
// Every data cell is written as a string (dates ISO 8601, ObjectIDs hex,
// nested structures JSON) to keep the file human-readable and to protect the
// round-trip against Excel's type coercion when a file is re-saved.

const (
	SheetMeta              = "_meta"
	SheetActivities        = "activities"
	SheetTimeRecords       = "time_records"
	SheetNotes             = "notes"
	SheetRoutines          = "routines"
	SheetRoutineActivities = "routine_activities"
	SheetActivityRecords   = "activity_records"
	SheetTransactions      = "transactions"
	SheetPayments          = "payments"
)

// SchemaVersion identifies the workbook layout. Bump it (and adapt the
// import) whenever the columns below change.
const SchemaVersion = 1

// MetaKeys are the row keys used in the _meta sheet.
const (
	MetaKeySchemaVersion = "schema_version"
	MetaKeyExportedAt    = "exported_at"
	MetaKeyUserID        = "user_id"
)

var (
	ActivitiesHeader = []string{
		"id", "user_id", "title", "description", "frequency", "day_frequency",
		"day_time", "privacy_status", "completion_amount", "is_active",
		"created_at", "updated_at", "deleted_at",
	}
	TimeRecordsHeader = []string{
		"id", "user_id", "category", "description", "duration_minutes",
		"created_at", "updated_at", "deleted_at",
	}
	NotesHeader = []string{
		"id", "user_id", "title", "content", "created_at", "updated_at", "deleted_at",
	}
	RoutinesHeader = []string{
		"id", "user_id", "title", "description", "privacy_status",
		"created_at", "updated_at", "deleted_at",
	}
	RoutineActivitiesHeader = []string{"routine_id", "activity_id", "position"}
	ActivityRecordsHeader   = []string{
		"id", "user_id", "activity_id", "completion_date", "notes", "created_at",
	}
	TransactionsHeader = []string{
		"id", "user_id", "type", "frequency", "payment_frequency", "amount",
		"category", "description", "date", "created_at", "updated_at",
	}
	PaymentsHeader = []string{
		"id", "user_id", "transaction_id", "amount", "date", "created_at",
	}
)

// entitySheets maps each entity sheet to its header, in restore order
// (Postgres foreign keys: routines/routine_activities need their parents).
var entitySheets = []struct {
	name    string
	headers []string
}{
	{SheetActivities, ActivitiesHeader},
	{SheetTimeRecords, TimeRecordsHeader},
	{SheetNotes, NotesHeader},
	{SheetRoutines, RoutinesHeader},
	{SheetRoutineActivities, RoutineActivitiesHeader},
	{SheetActivityRecords, ActivityRecordsHeader},
	{SheetTransactions, TransactionsHeader},
	{SheetPayments, PaymentsHeader},
}
