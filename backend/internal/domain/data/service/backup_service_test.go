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
	financeModel "life-tracker-backend/internal/domain/finance/model"
	healthModel "life-tracker-backend/internal/domain/health/model"
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

	require.NoError(t, db.Exec("DROP TABLE IF EXISTS routine_activities, routines, activities, time_records, notes CASCADE").Error)
	require.NoError(t, db.AutoMigrate(
		&activityModel.Activity{},
		&timeModel.TimeRecord{},
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
		_ = db.Exec("DROP TABLE IF EXISTS routine_activities, routines, activities, time_records, notes CASCADE").Error
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

	meals := []healthModel.MealLog{
		{ID: primitive.NewObjectID(), UserID: 1, MealType: "lunch", Name: "rice", Calories: 500.5, Protein: 20, Carbs: 80, Fat: 10, Date: time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC), CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
	}
	insertMongoDocs(t, mongoDB, "meal_logs", toBsonDocs(meals))

	exID := primitive.NewObjectID()
	exercises := []healthModel.Exercise{
		{ID: exID, UserID: 1, Name: "Squat", MuscleGroups: []string{"legs", "core"}, CreatedAt: time.Now().UTC()},
	}
	insertMongoDocs(t, mongoDB, "exercises", toBsonDocs(exercises))

	duration := 45
	sessions := []healthModel.WorkoutSession{
		{ID: primitive.NewObjectID(), UserID: 1, Date: time.Date(2026, 4, 2, 18, 0, 0, 0, time.UTC), DurationMinutes: &duration, Notes: "strong", Exercises: []healthModel.SessionExercise{{ExerciseID: exID, Sets: []healthModel.WorkoutSet{{Reps: 8, WeightKg: 60.5}, {Reps: 6, WeightKg: 65}}}}, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
	}
	insertMongoDocs(t, mongoDB, "workout_sessions", toBsonDocs(sessions))
}

// seedUser2 creates data for another user that must survive user 1's restore.
func seedUser2(t *testing.T, db *gorm.DB, mongoDB *mongo.Database) {
	t.Helper()
	activity := activityModel.Activity{ID: 500, UserID: 2, Title: "Other user activity", Frequency: activityModel.FrequencyDaily, PrivacyStatus: activityModel.PrivacyPrivate, CompletionAmount: 1}
	require.NoError(t, db.Create(&activity).Error)
	record := activityModel.ActivityRecord{ID: primitive.NewObjectID(), UserID: 2, ActivityID: 500, CompletionDate: time.Now().UTC(), CreatedAt: time.Now().UTC()}
	insertMongoDocs(t, mongoDB, "activity_records", toBsonDocs([]activityModel.ActivityRecord{record}))
}

func wipeUserData(t *testing.T, svc *BackupService, db *gorm.DB, mongoDB *mongo.Database, userID uint) {
	t.Helper()
	require.NoError(t, db.Exec("DELETE FROM routine_activities WHERE routine_id IN (SELECT id FROM routines WHERE user_id = ?)", userID).Error)
	for _, m := range []interface{}{
		&routineModel.Routine{}, &activityModel.Activity{}, &timeModel.TimeRecord{}, &noteModel.Note{},
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
	assert.Equal(t, 1, counts.Notes)
	assert.Equal(t, 1, counts.Routines)
	assert.Equal(t, 2, counts.RoutineActivities)
	assert.Equal(t, 2, counts.ActivityRecords)
	assert.Equal(t, 2, counts.Transactions)
	assert.Equal(t, 1, counts.Payments)
	assert.Equal(t, 1, counts.MealLogs)
	assert.Equal(t, 1, counts.Exercises)
	assert.Equal(t, 1, counts.WorkoutSessions)

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

	// Mongo contents.
	assert.Equal(t, int64(2), countMongo(t, mongoDB, "activity_records", 1))
	assert.Equal(t, int64(2), countMongo(t, mongoDB, "transactions", 1))
	assert.Equal(t, int64(1), countMongo(t, mongoDB, "payments", 1))
	assert.Equal(t, int64(1), countMongo(t, mongoDB, "meal_logs", 1))
	assert.Equal(t, int64(1), countMongo(t, mongoDB, "exercises", 1))
	assert.Equal(t, int64(1), countMongo(t, mongoDB, "workout_sessions", 1))

	var restoredTx financeModel.Transaction
	require.NoError(t, mongoDB.Collection("transactions").FindOne(context.Background(), bson.M{"category": "subs"}).Decode(&restoredTx))
	assert.Equal(t, 19.99, restoredTx.Amount)
	assert.Equal(t, financeModel.TransactionTypeOutcome, restoredTx.Type)
	assert.Equal(t, financeModel.PaymentFrequencyMonthly, restoredTx.PaymentFrequency)

	var restoredSession healthModel.WorkoutSession
	require.NoError(t, mongoDB.Collection("workout_sessions").FindOne(context.Background(), bson.M{"userId": 1}).Decode(&restoredSession))
	require.NotNil(t, restoredSession.DurationMinutes)
	assert.Equal(t, 45, *restoredSession.DurationMinutes)
	require.Len(t, restoredSession.Exercises, 1)
	require.Len(t, restoredSession.Exercises[0].Sets, 2)
	assert.Equal(t, 60.5, restoredSession.Exercises[0].Sets[0].WeightKg)

	// The other user's data is untouched.
	assert.Equal(t, int64(1), countRows(t, db, "activities WHERE user_id = 2"))
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

	// A rejected restore must not have touched any data.
	assert.Equal(t, beforeActs, countRows(t, db, "activities"))
	assert.Equal(t, beforeRecords, countMongo(t, mongoDB, "activity_records", 1))
}
