package service

import (
	"context"
	"fmt"
	"sort"
	"time"

	activityModel "life-tracker-backend/internal/domain/activity/model"
	financeModel "life-tracker-backend/internal/domain/finance/model"
	noteModel "life-tracker-backend/internal/domain/note/model"
	routineModel "life-tracker-backend/internal/domain/routine/model"
	timeModel "life-tracker-backend/internal/domain/time/model"

	"github.com/xuri/excelize/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"gorm.io/gorm"
)

type BackupService struct {
	db    *gorm.DB
	mongo *mongo.Database
}

func NewBackupService(db *gorm.DB, mongoDB *mongo.Database) *BackupService {
	return &BackupService{db: db, mongo: mongoDB}
}

// backupData holds everything of one user, fetched before building the file.
type backupData struct {
	activities        []activityModel.Activity
	timeRecords       []timeModel.TimeRecord
	notes             []noteModel.Note
	routines          []routineModel.Routine
	routineActivities []routineModel.RoutineActivity
	activityRecords   []activityModel.ActivityRecord
	transactions      []financeModel.Transaction
	payments          []financeModel.Payment
}

// Export builds the XLSX backup workbook for one user.
// Soft-deleted rows are included (Unscoped) so nothing is lost.
func (s *BackupService) Export(userID uint) (*excelize.File, error) {
	data, err := s.fetchData(userID)
	if err != nil {
		return nil, err
	}
	return buildWorkbook(userID, data)
}

func (s *BackupService) fetchData(userID uint) (*backupData, error) {
	data := &backupData{}

	if err := s.db.Unscoped().Where("user_id = ?", userID).Order("id").Find(&data.activities).Error; err != nil {
		return nil, fmt.Errorf("failed to load activities: %w", err)
	}
	if err := s.db.Unscoped().Where("user_id = ?", userID).Order("id").Find(&data.timeRecords).Error; err != nil {
		return nil, fmt.Errorf("failed to load time records: %w", err)
	}
	if err := s.db.Unscoped().Where("user_id = ?", userID).Order("id").Find(&data.notes).Error; err != nil {
		return nil, fmt.Errorf("failed to load notes: %w", err)
	}
	if err := s.db.Unscoped().Where("user_id = ?", userID).Order("id").Find(&data.routines).Error; err != nil {
		return nil, fmt.Errorf("failed to load routines: %w", err)
	}
	if err := s.db.Raw(`
		SELECT ra.routine_id, ra.activity_id, ra.position
		FROM routine_activities ra
		JOIN routines r ON r.id = ra.routine_id
		WHERE r.user_id = ?
		ORDER BY ra.routine_id, ra.position`, userID).Scan(&data.routineActivities).Error; err != nil {
		return nil, fmt.Errorf("failed to load routine activities: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := fetchAll(ctx, s.mongo, "activity_records", userID, &data.activityRecords); err != nil {
		return nil, fmt.Errorf("failed to load activity records: %w", err)
	}
	if err := fetchAll(ctx, s.mongo, "transactions", userID, &data.transactions); err != nil {
		return nil, fmt.Errorf("failed to load transactions: %w", err)
	}
	if err := fetchAll(ctx, s.mongo, "payments", userID, &data.payments); err != nil {
		return nil, fmt.Errorf("failed to load payments: %w", err)
	}

	sortMongoDocs(data)
	return data, nil
}

func fetchAll[T any](ctx context.Context, db *mongo.Database, collection string, userID uint, out *[]T) error {
	cur, err := db.Collection(collection).Find(ctx, bson.M{"userId": userID})
	if err != nil {
		return err
	}
	return cur.All(ctx, out)
}

// sortMongoDocs gives the workbook a stable row order (by ObjectID hex).
func sortMongoDocs(data *backupData) {
	sort.Slice(data.activityRecords, func(i, j int) bool {
		return data.activityRecords[i].ID.Hex() < data.activityRecords[j].ID.Hex()
	})
	sort.Slice(data.transactions, func(i, j int) bool {
		return data.transactions[i].ID.Hex() < data.transactions[j].ID.Hex()
	})
	sort.Slice(data.payments, func(i, j int) bool {
		return data.payments[i].ID.Hex() < data.payments[j].ID.Hex()
	})
}

func buildWorkbook(userID uint, data *backupData) (*excelize.File, error) {
	f := excelize.NewFile()
	if err := f.SetSheetName("Sheet1", SheetMeta); err != nil {
		return nil, err
	}

	rows := [][]interface{}{
		{MetaKeySchemaVersion, fmt.Sprint(SchemaVersion)},
		{MetaKeyExportedAt, encTime(time.Now())},
		{MetaKeyUserID, encUint(userID)},
	}
	for _, sheet := range entitySheets {
		rows = append(rows, []interface{}{"count_" + sheet.name, fmt.Sprint(countOf(sheet.name, data))})
	}
	if err := writeSheet(f, SheetMeta, []string{"key", "value"}, rows); err != nil {
		return nil, err
	}

	writers := []struct {
		sheet   string
		headers []string
		rows    [][]interface{}
	}{
		{SheetActivities, ActivitiesHeader, activityRows(data.activities)},
		{SheetTimeRecords, TimeRecordsHeader, timeRecordRows(data.timeRecords)},
		{SheetNotes, NotesHeader, noteRows(data.notes)},
		{SheetRoutines, RoutinesHeader, routineRows(data.routines)},
		{SheetRoutineActivities, RoutineActivitiesHeader, routineActivityRows(data.routineActivities)},
		{SheetActivityRecords, ActivityRecordsHeader, activityRecordRows(data.activityRecords)},
		{SheetTransactions, TransactionsHeader, transactionRows(data.transactions)},
		{SheetPayments, PaymentsHeader, paymentRows(data.payments)},
	}
	for _, w := range writers {
		if err := writeSheet(f, w.sheet, w.headers, w.rows); err != nil {
			return nil, err
		}
	}
	return f, nil
}

func writeSheet(f *excelize.File, name string, headers []string, rows [][]interface{}) error {
	if _, err := f.NewSheet(name); err != nil {
		return err
	}
	if err := f.SetSheetRow(name, "A1", &headers); err != nil {
		return err
	}
	for i, row := range rows {
		if err := f.SetSheetRow(name, fmt.Sprintf("A%d", i+2), &row); err != nil {
			return err
		}
	}
	return nil
}

func countOf(sheetName string, data *backupData) int {
	switch sheetName {
	case SheetActivities:
		return len(data.activities)
	case SheetTimeRecords:
		return len(data.timeRecords)
	case SheetNotes:
		return len(data.notes)
	case SheetRoutines:
		return len(data.routines)
	case SheetRoutineActivities:
		return len(data.routineActivities)
	case SheetActivityRecords:
		return len(data.activityRecords)
	case SheetTransactions:
		return len(data.transactions)
	case SheetPayments:
		return len(data.payments)
	}
	return 0
}

// ---- row encoders (aligned with the header constants) ----

func activityRows(items []activityModel.Activity) [][]interface{} {
	rows := make([][]interface{}, 0, len(items))
	for _, a := range items {
		rows = append(rows, []interface{}{
			encUint(a.ID), encUint(a.UserID), a.Title, a.Description,
			string(a.Frequency), a.DayFrequency, string(a.DayTime),
			string(a.PrivacyStatus), encInt(a.CompletionAmount), encBool(a.IsActive),
			encTime(a.CreatedAt), encTime(a.UpdatedAt), encOptionalTime(a.DeletedAt),
		})
	}
	return rows
}

func timeRecordRows(items []timeModel.TimeRecord) [][]interface{} {
	rows := make([][]interface{}, 0, len(items))
	for _, t := range items {
		rows = append(rows, []interface{}{
			encUint(t.ID), encUint(t.UserID), t.Category, t.Description,
			encInt(t.DurationMinutes),
			encTime(t.CreatedAt), encTime(t.UpdatedAt), encOptionalTime(t.DeletedAt),
		})
	}
	return rows
}

func noteRows(items []noteModel.Note) [][]interface{} {
	rows := make([][]interface{}, 0, len(items))
	for _, n := range items {
		rows = append(rows, []interface{}{
			encUint(n.ID), encUint(n.UserID), n.Title, n.Content,
			encTime(n.CreatedAt), encTime(n.UpdatedAt), encOptionalTime(n.DeletedAt),
		})
	}
	return rows
}

func routineRows(items []routineModel.Routine) [][]interface{} {
	rows := make([][]interface{}, 0, len(items))
	for _, r := range items {
		rows = append(rows, []interface{}{
			encUint(r.ID), encUint(r.UserID), r.Title, r.Description,
			string(r.PrivacyStatus),
			encTime(r.CreatedAt), encTime(r.UpdatedAt), encOptionalTime(r.DeletedAt),
		})
	}
	return rows
}

func routineActivityRows(items []routineModel.RoutineActivity) [][]interface{} {
	rows := make([][]interface{}, 0, len(items))
	for _, ra := range items {
		rows = append(rows, []interface{}{
			encUint(ra.RoutineID), encUint(ra.ActivityID), encInt(ra.Position),
		})
	}
	return rows
}

func activityRecordRows(items []activityModel.ActivityRecord) [][]interface{} {
	rows := make([][]interface{}, 0, len(items))
	for _, r := range items {
		rows = append(rows, []interface{}{
			encObjectID(r.ID), encUint(r.UserID), encUint(r.ActivityID),
			encTime(r.CompletionDate), r.Notes, encTime(r.CreatedAt),
		})
	}
	return rows
}

func transactionRows(items []financeModel.Transaction) [][]interface{} {
	rows := make([][]interface{}, 0, len(items))
	for _, t := range items {
		rows = append(rows, []interface{}{
			encObjectID(t.ID), encUint(t.UserID), string(t.Type), string(t.Frequency),
			string(t.PaymentFrequency), encFloat(t.Amount), t.Category, t.Description,
			encTime(t.Date), encTime(t.CreatedAt), encTime(t.UpdatedAt),
		})
	}
	return rows
}

func paymentRows(items []financeModel.Payment) [][]interface{} {
	rows := make([][]interface{}, 0, len(items))
	for _, p := range items {
		rows = append(rows, []interface{}{
			encObjectID(p.ID), encUint(p.UserID), encObjectID(p.TransactionID),
			encFloat(p.Amount), encTime(p.Date), encTime(p.CreatedAt),
		})
	}
	return rows
}
