package service

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"life-tracker-backend/internal/config"
	activityModel "life-tracker-backend/internal/domain/activity/model"
	calendarModel "life-tracker-backend/internal/domain/calendar/model"
	financeModel "life-tracker-backend/internal/domain/finance/model"
	noteModel "life-tracker-backend/internal/domain/note/model"
	routineModel "life-tracker-backend/internal/domain/routine/model"
	timeModel "life-tracker-backend/internal/domain/time/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var cfg *config.Config

func init() {
	os.Setenv("ENVIRONMENT", "test")
	cfg = config.Load()
}

func setupTestService(t *testing.T) (*BackupService, *gorm.DB, *mongo.Database) {
	t.Helper()

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	require.NoError(t, err, "failed to connect to PostgreSQL")

	require.NoError(t, db.Exec("DROP TABLE IF EXISTS routine_activities, routines, activities, time_records, notes, calendar_events CASCADE").Error)
	require.NoError(t, db.AutoMigrate(
		&activityModel.Activity{},
		&timeModel.TimeRecord{},
		&calendarModel.CalendarEvent{},
		&noteModel.Note{},
		&routineModel.Routine{},
		&routineModel.RoutineActivity{},
	))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	mongoClient, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	require.NoError(t, err, "failed to connect to MongoDB")
	mongoDB := mongoClient.Database(cfg.MongoDatabase)
	for _, name := range mongoCollections {
		_ = mongoDB.Collection(name).Drop(ctx)
	}

	t.Cleanup(func() {
		_ = db.Exec("DROP TABLE IF EXISTS routine_activities, routines, activities, time_records, notes, calendar_events CASCADE").Error
		_ = mongoClient.Disconnect(context.Background())
	})

	return NewBackupService(db, mongoDB), db, mongoDB
}

func exportBytes(t *testing.T, svc *BackupService, userID uint) []byte {
	t.Helper()
	f, err := svc.Export(userID)
	require.NoError(t, err)
	buf, err := f.WriteToBuffer()
	require.NoError(t, err)
	return buf.Bytes()
}

func countRows(t *testing.T, db *gorm.DB, table string) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", table)).Scan(&n).Error)
	return n
}

func countMongo(t *testing.T, mongoDB *mongo.Database, collection string, userID uint) int64 {
	t.Helper()
	n, err := mongoDB.Collection(collection).CountDocuments(context.Background(), bson.M{"userId": userID})
	require.NoError(t, err)
	return n
}

func seedFullUser1(t *testing.T, db *gorm.DB, mongoDB *mongo.Database) {
	t.Helper()

	// IDs above 1 exercise the sequence repair.
	acts := []activityModel.Activity{
		{ID: 12, UserID: 1, Title: "Gym", Description: "weights", Frequency: activityModel.FrequencyDaily, DayTime: activityModel.DayTimeMorning, PrivacyStatus: activityModel.PrivacyPrivate, CompletionAmount: 2, IsActive: true, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
		{ID: 7, UserID: 1, Title: "Read", Frequency: activityModel.FrequencyWeekly, DayFrequency: "monday,friday", PrivacyStatus: activityModel.PrivacyPublic, CompletionAmount: 1, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
		// Soft-deleted row: must survive the round trip.
		{ID: 3, UserID: 1, Title: "Old habit", Frequency: activityModel.FrequencyDaily, DayTime: activityModel.DayTimeNotSpecified, PrivacyStatus: activityModel.PrivacyPrivate, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(), DeletedAt: gormDeletedAt(time.Now().UTC())},
	}
	for i := range acts {
		require.NoError(t, db.Create(&acts[i]).Error)
	}
	// Re-soft-delete row 3 (Create would un-delete nothing, but be explicit).
	require.NoError(t, db.Model(&activityModel.Activity{}).Where("id = ?", 3).Update("deleted_at", time.Now().UTC()).Error)

	records := []activityModel.ActivityRecord{
		{ID: primitive.NewObjectID(), UserID: 1, ActivityID: 12, CompletionDate: time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC), Notes: "leg day", CreatedAt: time.Now().UTC()},
		{ID: primitive.NewObjectID(), UserID: 1, ActivityID: 7, CompletionDate: time.Date(2026, 9, 2, 8, 0, 0, 0, time.UTC), CreatedAt: time.Now().UTC()},
	}
	insertMongoDocs(t, mongoDB, "activity_records", toBsonDocs(records))

	times := []timeModel.TimeRecord{
		{ID: 5, UserID: 1, Category: "study", Description: "go", DurationMinutes: 90, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
	}
	for i := range times {
		require.NoError(t, db.Create(&times[i]).Error)
	}

	events := []calendarModel.CalendarEvent{
		{ID: 21, UserID: 1, Title: "English class", Description: "B2 conversation", Category: "Study", StartAt: time.Date(2026, 10, 19, 10, 0, 0, 0, time.UTC), EndAt: time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
		// Soft-deleted row: must survive the round trip.
		{ID: 22, UserID: 1, Title: "Old class", Category: "Study", StartAt: time.Date(2026, 10, 20, 10, 0, 0, 0, time.UTC), EndAt: time.Date(2026, 10, 20, 11, 0, 0, 0, time.UTC), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
	}
	for i := range events {
		require.NoError(t, db.Create(&events[i]).Error)
	}
	require.NoError(t, db.Model(&calendarModel.CalendarEvent{}).Where("id = ?", 22).Update("deleted_at", time.Now().UTC()).Error)
	// The restored events get fresh ids, so the sequence must be past the
	// seeded ones.
	require.NoError(t, db.Exec("SELECT setval(pg_get_serial_sequence('calendar_events', 'id'), 22, true)").Error)

	notes := []noteModel.Note{
		{ID: 9, UserID: 1, Title: "Ideas", Content: "## heading", CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
	}
	for i := range notes {
		require.NoError(t, db.Create(&notes[i]).Error)
	}

	routines := []routineModel.Routine{
		{ID: 11, UserID: 1, Title: "Morning", Description: "sunrise", PrivacyStatus: routineModel.PrivacyPrivate, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
	}
	for i := range routines {
		require.NoError(t, db.Create(&routines[i]).Error)
	}
	// Insert with explicit ID (AutoMigrate sequence aside).
	require.NoError(t, db.Exec("SELECT setval(pg_get_serial_sequence('routines', 'id'), 11, true)").Error)

	require.NoError(t, db.Create(&routineModel.RoutineActivity{RoutineID: 11, ActivityID: 12, Position: 0}).Error)
	require.NoError(t, db.Create(&routineModel.RoutineActivity{RoutineID: 11, ActivityID: 7, Position: 1}).Error)

	txID := primitive.NewObjectID()
	transactions := []financeModel.Transaction{
		{ID: txID, UserID: 1, Type: financeModel.TransactionTypeOutcome, Frequency: financeModel.TransactionFrequencyFixed, PaymentFrequency: financeModel.PaymentFrequencyMonthly, Amount: 19.99, Category: "subs", Description: "netflix", Date: time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
		{ID: primitive.NewObjectID(), UserID: 1, Type: financeModel.TransactionTypeIncome, Frequency: financeModel.TransactionFrequencyVariable, Amount: 1500, Category: "salary", Date: time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
	}
	insertMongoDocs(t, mongoDB, "transactions", toBsonDocs(transactions))

	payments := []financeModel.Payment{
		{ID: primitive.NewObjectID(), TransactionID: txID, UserID: 1, Amount: 19.99, Date: time.Date(2026, 1, 20, 0, 0, 0, 0, time.UTC), CreatedAt: time.Now().UTC()},
	}
	insertMongoDocs(t, mongoDB, "payments", toBsonDocs(payments))
}

// seedUser2 creates data for another user that must survive user 1's restore.
func seedUser2(t *testing.T, db *gorm.DB, mongoDB *mongo.Database) {
	t.Helper()
	activity := activityModel.Activity{ID: 500, UserID: 2, Title: "Other user activity", Frequency: activityModel.FrequencyDaily, PrivacyStatus: activityModel.PrivacyPrivate, CompletionAmount: 1}
	require.NoError(t, db.Create(&activity).Error)
	record := activityModel.ActivityRecord{ID: primitive.NewObjectID(), UserID: 2, ActivityID: 500, CompletionDate: time.Now().UTC(), CreatedAt: time.Now().UTC()}
	insertMongoDocs(t, mongoDB, "activity_records", toBsonDocs([]activityModel.ActivityRecord{record}))
	event := calendarModel.CalendarEvent{ID: 700, UserID: 2, Title: "Other user event", Category: "Study", StartAt: time.Date(2026, 10, 19, 8, 0, 0, 0, time.UTC), EndAt: time.Date(2026, 10, 19, 9, 0, 0, 0, time.UTC), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}
	require.NoError(t, db.Create(&event).Error)
}

func wipeUserData(t *testing.T, svc *BackupService, db *gorm.DB, mongoDB *mongo.Database, userID uint) {
	t.Helper()
	require.NoError(t, db.Exec("DELETE FROM routine_activities WHERE routine_id IN (SELECT id FROM routines WHERE user_id = ?)", userID).Error)
	for _, m := range []interface{}{
		&routineModel.Routine{}, &activityModel.Activity{}, &timeModel.TimeRecord{},
		&calendarModel.CalendarEvent{}, &noteModel.Note{},
	} {
		require.NoError(t, db.Unscoped().Where("user_id = ?", userID).Delete(m).Error)
	}
	for _, name := range mongoCollections {
		_, err := mongoDB.Collection(name).DeleteMany(context.Background(), bson.M{"userId": userID})
		require.NoError(t, err)
	}
}

func gormDeletedAt(t time.Time) gorm.DeletedAt {
	return gorm.DeletedAt{Time: t, Valid: true}
}

func toBsonDocs[T any](rows []T) []interface{} {
	docs := make([]interface{}, len(rows))
	for i := range rows {
		docs[i] = rows[i]
	}
	return docs
}

func insertMongoDocs(t *testing.T, mongoDB *mongo.Database, collection string, docs []interface{}) {
	t.Helper()
	if len(docs) == 0 {
		return
	}
	_, err := mongoDB.Collection(collection).InsertMany(context.Background(), docs)
	require.NoError(t, err)
}

// setCalendarCell writes a value into a cell of the calendar_events sheet.
func setCalendarCell(t *testing.T, f *excelize.File, column string, row int, value string) {
	t.Helper()
	index, ok := headerIndex(CalendarEventsHeader)[column]
	require.True(t, ok, "unknown column %q", column)
	cell, err := excelize.CoordinatesToCellName(index+1, row)
	require.NoError(t, err)
	require.NoError(t, f.SetCellValue(SheetCalendarEvents, cell, value))
}

// ---- tests ----

func TestExportRestoreRoundTrip(t *testing.T) {
	svc, db, mongoDB := setupTestService(t)
	seedFullUser1(t, db, mongoDB)
	seedUser2(t, db, mongoDB)

	backup := exportBytes(t, svc, 1)

	// Simulate data loss: wipe everything of user 1.
	wipeUserData(t, svc, db, mongoDB, 1)

	counts, err := svc.Restore(1, backup)
	require.NoError(t, err)
	require.NotNil(t, counts)

	assert.Equal(t, 3, counts.Activities)
	assert.Equal(t, 1, counts.TimeRecords)
	assert.Equal(t, 2, counts.CalendarEvents)
	assert.Equal(t, 1, counts.Notes)
	assert.Equal(t, 1, counts.Routines)
	assert.Equal(t, 2, counts.RoutineActivities)
	assert.Equal(t, 2, counts.ActivityRecords)
	assert.Equal(t, 2, counts.Transactions)
	assert.Equal(t, 1, counts.Payments)

	// Postgres contents, including the soft-deleted activity.
	var acts []activityModel.Activity
	require.NoError(t, db.Unscoped().Where("user_id = ?", 1).Order("id").Find(&acts).Error)
	require.Len(t, acts, 3)

	byID := map[uint]activityModel.Activity{}
	for _, a := range acts {
		byID[a.ID] = a
	}
	gym, ok := byID[12]
	require.True(t, ok)
	assert.Equal(t, "Gym", gym.Title)
	assert.True(t, gym.IsActive)
	assert.Equal(t, 2, gym.CompletionAmount)
	assert.Equal(t, "weights", gym.Description)
	assert.Equal(t, activityModel.DayTimeMorning, gym.DayTime)

	deleted, ok := byID[3]
	require.True(t, ok, "soft-deleted activity must be restored")
	assert.True(t, deleted.DeletedAt.Valid, "soft-delete state must survive the round trip")

	// Routine links.
	var ras []routineModel.RoutineActivity
	require.NoError(t, db.Order("position").Find(&ras).Error)
	require.Len(t, ras, 2)
	assert.Equal(t, uint(11), ras[0].RoutineID)
	assert.Equal(t, uint(12), ras[0].ActivityID)
	assert.Equal(t, 1, ras[1].Position)

	// Calendar events, restored with fresh ids.
	var events []calendarModel.CalendarEvent
	require.NoError(t, db.Unscoped().Where("user_id = ?", 1).Order("id").Find(&events).Error)
	require.Len(t, events, 2)
	for _, event := range events {
		assert.NotEqual(t, uint(21), event.ID, "restored events must get a new id")
		assert.NotEqual(t, uint(22), event.ID, "restored events must get a new id")
		assert.Equal(t, uint(1), event.UserID)
	}
	assert.Equal(t, "English class", events[0].Title)
	assert.Equal(t, "B2 conversation", events[0].Description)
	assert.Equal(t, "Study", events[0].Category)
	assert.WithinDuration(t, time.Date(2026, 10, 19, 10, 0, 0, 0, time.UTC), events[0].StartAt.UTC(), 0)
	assert.WithinDuration(t, time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC), events[0].EndAt.UTC(), 0)
	assert.False(t, events[0].DeletedAt.Valid)
	assert.Equal(t, "Old class", events[1].Title)
	assert.True(t, events[1].DeletedAt.Valid, "soft-delete state must survive the round trip")

	// Mongo contents.
	assert.Equal(t, int64(2), countMongo(t, mongoDB, "activity_records", 1))
	assert.Equal(t, int64(2), countMongo(t, mongoDB, "transactions", 1))
	assert.Equal(t, int64(1), countMongo(t, mongoDB, "payments", 1))

	var restoredTx financeModel.Transaction
	require.NoError(t, mongoDB.Collection("transactions").FindOne(context.Background(), bson.M{"category": "subs"}).Decode(&restoredTx))
	assert.Equal(t, 19.99, restoredTx.Amount)
	assert.Equal(t, financeModel.TransactionTypeOutcome, restoredTx.Type)
	assert.Equal(t, financeModel.PaymentFrequencyMonthly, restoredTx.PaymentFrequency)

	// The other user's data is untouched.
	assert.Equal(t, int64(1), countRows(t, db, "activities WHERE user_id = 2"))
	assert.Equal(t, int64(1), countRows(t, db, "calendar_events WHERE user_id = 2"))
	assert.Equal(t, int64(1), countMongo(t, mongoDB, "activity_records", 2))
}

func TestRestoreRepairSequences(t *testing.T) {
	svc, db, mongoDB := setupTestService(t)
	seedFullUser1(t, db, mongoDB)

	backup := exportBytes(t, svc, 1)
	wipeUserData(t, svc, db, mongoDB, 1)

	_, err := svc.Restore(1, backup)
	require.NoError(t, err)

	// A fresh insert must not collide with restored explicit IDs (max was 12).
	activity := activityModel.Activity{UserID: 1, Title: "New", Frequency: activityModel.FrequencyDaily, PrivacyStatus: activityModel.PrivacyPrivate, CompletionAmount: 1}
	require.NoError(t, db.Create(&activity).Error)
	assert.Greater(t, activity.ID, uint(12), "sequence must continue after the highest restored ID")

	note := noteModel.Note{UserID: 1, Title: "New note"}
	require.NoError(t, db.Create(&note).Error)
	assert.Greater(t, note.ID, uint(9))
}

func TestExportEmptyAccount(t *testing.T) {
	svc, db, mongoDB := setupTestService(t)

	backup := exportBytes(t, svc, 42)

	// Importing an empty backup into a (nonexistent-data) account is a no-op.
	counts, err := svc.Restore(1, backup)
	require.NoError(t, err)
	assert.Equal(t, 0, counts.Activities)
	assert.Equal(t, 0, counts.Transactions)
	assert.Equal(t, int64(0), countRows(t, db, "activities"))
	assert.Equal(t, int64(0), countMongo(t, mongoDB, "activity_records", 1))
}

func TestImportRejections(t *testing.T) {
	svc, db, mongoDB := setupTestService(t)
	seedFullUser1(t, db, mongoDB)

	beforeActs := countRows(t, db, "activities")
	beforeRecords := countMongo(t, mongoDB, "activity_records", 1)
	beforeEvents := countRows(t, db, "calendar_events")

	t.Run("garbage bytes", func(t *testing.T) {
		_, err := svc.Restore(1, []byte("this is not xlsx"))
		require.Error(t, err)
	})

	t.Run("missing meta sheet", func(t *testing.T) {
		f := excelize.NewFile()
		_ = f.SetSheetRow("Sheet1", "A1", &[]string{"id"})
		buf, err := f.WriteToBuffer()
		require.NoError(t, err)
		_, err = svc.Restore(1, buf.Bytes())
		require.ErrorContains(t, err, "_meta")
	})

	t.Run("unsupported schema version", func(t *testing.T) {
		backup := exportBytes(t, svc, 1)
		f, err := excelize.OpenReader(bytes.NewReader(backup))
		require.NoError(t, err)
		require.NoError(t, f.SetCellValue(SheetMeta, "B2", "999"))
		buf, err := f.WriteToBuffer()
		require.NoError(t, err)
		_, err = svc.Restore(1, buf.Bytes())
		require.ErrorContains(t, err, "schema version")
	})

	t.Run("missing required sheet", func(t *testing.T) {
		backup := exportBytes(t, svc, 1)
		f, err := excelize.OpenReader(bytes.NewReader(backup))
		require.NoError(t, err)
		require.NoError(t, f.DeleteSheet(SheetNotes))
		buf, err := f.WriteToBuffer()
		require.NoError(t, err)
		_, err = svc.Restore(1, buf.Bytes())
		require.ErrorContains(t, err, SheetNotes)
	})

	t.Run("broken foreign reference", func(t *testing.T) {
		backup := exportBytes(t, svc, 1)
		f, err := excelize.OpenReader(bytes.NewReader(backup))
		require.NoError(t, err)
		rows, err := f.GetRows(SheetRoutineActivities)
		require.NoError(t, err)
		require.Len(t, rows, 3)
		// Point the first link at a non-existent routine.
		require.NoError(t, f.SetCellValue(SheetRoutineActivities, "A2", uint(4242)))
		buf, err := f.WriteToBuffer()
		require.NoError(t, err)
		_, err = svc.Restore(1, buf.Bytes())
		require.ErrorContains(t, err, "routine_id 4242")
	})

	t.Run("malformed row", func(t *testing.T) {
		backup := exportBytes(t, svc, 1)
		f, err := excelize.OpenReader(bytes.NewReader(backup))
		require.NoError(t, err)
		require.NoError(t, f.SetCellValue(SheetActivities, "A2", "not-a-number"))
		buf, err := f.WriteToBuffer()
		require.NoError(t, err)
		_, err = svc.Restore(1, buf.Bytes())
		require.ErrorContains(t, err, SheetActivities)
	})

	t.Run("invalid calendar event", func(t *testing.T) {
		cases := []struct {
			name    string
			column  string
			value   string
			wantErr string
		}{
			{"end before start", "end_at", "2026-10-19T09:00:00Z", "end_at must be after start_at"},
			{"longer than a day", "end_at", "2026-10-20T11:00:00Z", "must not exceed 24 hours"},
			{"empty title", "title", "", "title must not be empty"},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				backup := exportBytes(t, svc, 1)
				f, err := excelize.OpenReader(bytes.NewReader(backup))
				require.NoError(t, err)
				setCalendarCell(t, f, tc.column, 2, tc.value)
				buf, err := f.WriteToBuffer()
				require.NoError(t, err)
				_, err = svc.Restore(1, buf.Bytes())
				require.ErrorContains(t, err, SheetCalendarEvents)
				require.ErrorContains(t, err, tc.wantErr)
			})
		}
	})

	// A rejected restore must not have touched any data.
	assert.Equal(t, beforeActs, countRows(t, db, "activities"))
	assert.Equal(t, beforeRecords, countMongo(t, mongoDB, "activity_records", 1))
	assert.Equal(t, beforeEvents, countRows(t, db, "calendar_events"))
}

func TestExportIncludesCalendarEvents(t *testing.T) {
	svc, db, mongoDB := setupTestService(t)
	seedFullUser1(t, db, mongoDB)
	seedUser2(t, db, mongoDB)

	backup := exportBytes(t, svc, 1)
	f, err := excelize.OpenReader(bytes.NewReader(backup))
	require.NoError(t, err)

	rows, err := f.GetRows(SheetCalendarEvents)
	require.NoError(t, err)
	require.Len(t, rows, 3, "the sheet holds the header and the two events of user 1")

	// Every column of the table is exported.
	for _, column := range []string{
		"id", "user_id", "title", "description", "category",
		"start_at", "end_at", "created_at", "updated_at", "deleted_at",
	} {
		assert.Contains(t, rows[0], column)
	}

	index := headerIndex(CalendarEventsHeader)
	assert.Equal(t, "21", rows[1][index["id"]])
	assert.Equal(t, "1", rows[1][index["user_id"]])
	assert.Equal(t, "English class", rows[1][index["title"]])
	assert.Equal(t, "B2 conversation", rows[1][index["description"]])
	assert.Equal(t, "Study", rows[1][index["category"]])
	assert.Equal(t, "2026-10-19T10:00:00Z", rows[1][index["start_at"]])
	assert.Equal(t, "2026-10-19T12:00:00Z", rows[1][index["end_at"]])
	assert.NotEmpty(t, rows[1][index["created_at"]])
	assert.NotEmpty(t, rows[1][index["updated_at"]])
	assert.Empty(t, rows[1][index["deleted_at"]])

	// The soft-deleted event is exported with its deleted_at.
	assert.Equal(t, "Old class", rows[2][index["title"]])
	assert.NotEmpty(t, rows[2][index["deleted_at"]])

	// Another user's events are never exported.
	for _, row := range rows {
		assert.NotEqual(t, "Other user event", row[index["title"]])
	}
}

func TestImportRestoresCalendarEvents(t *testing.T) {
	svc, db, mongoDB := setupTestService(t)
	seedFullUser1(t, db, mongoDB)
	seedUser2(t, db, mongoDB)

	backup := exportBytes(t, svc, 1)
	wipeUserData(t, svc, db, mongoDB, 1)

	counts, err := svc.Restore(1, backup)
	require.NoError(t, err)
	assert.Equal(t, 2, counts.CalendarEvents)

	var events []calendarModel.CalendarEvent
	require.NoError(t, db.Unscoped().Where("user_id = ?", 1).Order("id").Find(&events).Error)
	require.Len(t, events, 2)
	for _, event := range events {
		// The archived ids are never reused: the id sequence is global, so
		// they could belong to another user's row.
		assert.NotEqual(t, uint(21), event.ID)
		assert.NotEqual(t, uint(22), event.ID)
		// The rows belong to the importing user.
		assert.Equal(t, uint(1), event.UserID)
	}

	assert.Equal(t, "English class", events[0].Title)
	assert.Equal(t, "B2 conversation", events[0].Description)
	assert.Equal(t, "Study", events[0].Category)
	assert.WithinDuration(t, time.Date(2026, 10, 19, 10, 0, 0, 0, time.UTC), events[0].StartAt.UTC(), 0)
	assert.WithinDuration(t, time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC), events[0].EndAt.UTC(), 0)
	assert.False(t, events[0].DeletedAt.Valid)
	assert.Equal(t, "Old class", events[1].Title)
	assert.True(t, events[1].DeletedAt.Valid, "soft-delete state must survive the round trip")

	// The other user's events are untouched.
	assert.Equal(t, int64(1), countRows(t, db, "calendar_events WHERE user_id = 2"))

	// Importing the same file again replaces the events instead of
	// duplicating them.
	counts, err = svc.Restore(1, backup)
	require.NoError(t, err)
	assert.Equal(t, 2, counts.CalendarEvents)
	assert.Equal(t, int64(2), countRows(t, db, "calendar_events WHERE user_id = 1"))
}

func TestImportReownsCalendarEvents(t *testing.T) {
	svc, db, _ := setupTestService(t)

	// A foreign account with nothing but a calendar event.
	event := calendarModel.CalendarEvent{ID: 700, UserID: 3, Title: "Foreign event", Category: "Study", StartAt: time.Date(2026, 10, 19, 8, 0, 0, 0, time.UTC), EndAt: time.Date(2026, 10, 19, 9, 0, 0, 0, time.UTC), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}
	require.NoError(t, db.Create(&event).Error)

	backup := exportBytes(t, svc, 3)
	counts, err := svc.Restore(1, backup)
	require.NoError(t, err)
	assert.Equal(t, 1, counts.CalendarEvents)

	var events []calendarModel.CalendarEvent
	require.NoError(t, db.Unscoped().Where("user_id = ?", 1).Find(&events).Error)
	require.Len(t, events, 1)
	assert.Equal(t, "Foreign event", events[0].Title)
	assert.Equal(t, uint(1), events[0].UserID, "the archived owner must be replaced")
	assert.NotEqual(t, uint(700), events[0].ID)
}

// TestRecurringCalendarEventRoundTrip verifies that the nullable columns of
// a recurring event (series id, occurrence index, rule, until, interval) are
// exported and restored. They are pointers in the model, so the codec has to
// dereference them instead of writing a pointer address into the sheet.
func TestRecurringCalendarEventRoundTrip(t *testing.T) {
	svc, db, mongoDB := setupTestService(t)
	seedFullUser1(t, db, mongoDB)

	seriesID := "a1b2c3d4e5f60718"
	occurrenceIndex := 2
	rule := "weekly"
	until := time.Date(2026, 11, 30, 23, 59, 59, 0, time.UTC)
	interval := 1

	occurrence := calendarModel.CalendarEvent{
		UserID:             1,
		Title:              "Weekly class",
		Category:           "Study",
		StartAt:            time.Date(2026, 10, 19, 10, 0, 0, 0, time.UTC),
		EndAt:              time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC),
		SeriesID:           &seriesID,
		OccurrenceIndex:    &occurrenceIndex,
		RecurrenceRule:     &rule,
		RecurrenceUntil:    &until,
		RecurrenceInterval: &interval,
	}
	require.NoError(t, db.Create(&occurrence).Error)

	backup := exportBytes(t, svc, 1)

	f, err := excelize.OpenReader(bytes.NewReader(backup))
	require.NoError(t, err)
	rows, err := f.GetRows(SheetCalendarEvents)
	require.NoError(t, err)

	index := headerIndex(CalendarEventsHeader)
	var seriesRow []string
	for _, row := range rows[1:] {
		if len(row) > index["title"] && row[index["title"]] == "Weekly class" {
			seriesRow = row
		}
	}
	require.NotNil(t, seriesRow, "the recurring event must be exported")
	assert.Equal(t, seriesID, seriesRow[index["series_id"]])
	assert.Equal(t, "2", seriesRow[index["occurrence_index"]])
	assert.Equal(t, "weekly", seriesRow[index["recurrence_rule"]])
	assert.Equal(t, "2026-11-30T23:59:59Z", seriesRow[index["recurrence_until"]])
	assert.Equal(t, "1", seriesRow[index["recurrence_interval"]])

	counts, err := svc.Restore(1, backup)
	require.NoError(t, err)
	assert.Equal(t, 3, counts.CalendarEvents)

	var restored []calendarModel.CalendarEvent
	require.NoError(t, db.Where("user_id = ? AND title = ?", 1, "Weekly class").Find(&restored).Error)
	require.Len(t, restored, 1)
	require.NotNil(t, restored[0].SeriesID)
	assert.Equal(t, seriesID, *restored[0].SeriesID)
	require.NotNil(t, restored[0].OccurrenceIndex)
	assert.Equal(t, occurrenceIndex, *restored[0].OccurrenceIndex)
	require.NotNil(t, restored[0].RecurrenceRule)
	assert.Equal(t, rule, *restored[0].RecurrenceRule)
	require.NotNil(t, restored[0].RecurrenceUntil)
	assert.True(t, until.Equal(restored[0].RecurrenceUntil.UTC()))
	require.NotNil(t, restored[0].RecurrenceInterval)
	assert.Equal(t, interval, *restored[0].RecurrenceInterval)

	// A single event keeps its NULL columns.
	var single []calendarModel.CalendarEvent
	require.NoError(t, db.Where("user_id = ? AND title = ?", 1, "English class").Find(&single).Error)
	require.Len(t, single, 1)
	assert.Nil(t, single[0].SeriesID)
	assert.Nil(t, single[0].RecurrenceRule)
}
