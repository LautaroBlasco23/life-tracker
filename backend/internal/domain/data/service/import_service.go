package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"life-tracker-backend/internal/domain/data/dto"

	activityModel "life-tracker-backend/internal/domain/activity/model"
	financeModel "life-tracker-backend/internal/domain/finance/model"
	healthModel "life-tracker-backend/internal/domain/health/model"
	noteModel "life-tracker-backend/internal/domain/note/model"
	routineModel "life-tracker-backend/internal/domain/routine/model"
	timeModel "life-tracker-backend/internal/domain/time/model"

	"github.com/xuri/excelize/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"gorm.io/gorm"
)

// mongoCollections are the per-user collections touched by a restore.
var mongoCollections = []string{
	"activity_records", "transactions", "payments",
	"meal_logs", "exercises", "workout_sessions",
}

// serialTables have bigserial IDs whose sequences must be repaired after an
// import that restores explicit IDs. routine_activities has a composite PK
// and no sequence.
var serialTables = []string{"activities", "time_records", "notes", "routines"}

// Restore wipes the user's data and replaces it with the workbook contents.
// Everything is validated up front, so the destructive phase only starts for
// a fully valid file.
func (s *BackupService) Restore(userID uint, data []byte) (*dto.RestoreCounts, error) {
	f, openErr := excelize.OpenReader(bytes.NewReader(data))
	if openErr != nil {
		return nil, fmt.Errorf("could not read file: %w", openErr)
	}
	defer func() {
		if err := f.Close(); err != nil {
			slog.Warn("failed to close backup file", "error", err)
		}
	}()

	if err := validateMeta(f); err != nil {
		return nil, err
	}

	b, err := parseBackup(f)
	if err != nil {
		return nil, err
	}

	applyUserID(userID, b)

	if err := s.restorePostgres(userID, b); err != nil {
		return nil, err
	}
	repairSequences(s.db)

	if err := s.restoreMongo(userID, b); err != nil {
		return nil, err
	}

	return &dto.RestoreCounts{
		Activities:        len(b.activities),
		TimeRecords:       len(b.timeRecords),
		Notes:             len(b.notes),
		Routines:          len(b.routines),
		RoutineActivities: len(b.routineActivities),
		ActivityRecords:   len(b.activityRecords),
		Transactions:      len(b.transactions),
		Payments:          len(b.payments),
		MealLogs:          len(b.mealLogs),
		Exercises:         len(b.exercises),
		WorkoutSessions:   len(b.workoutSessions),
	}, nil
}

// ---- validation & parsing ----

func validateMeta(f *excelize.File) error {
	rows, err := f.GetRows(SheetMeta)
	if err != nil || len(rows) < 2 {
		return fmt.Errorf("missing %q sheet", SheetMeta)
	}
	meta := map[string]string{}
	for _, r := range rows[1:] {
		if len(r) >= 2 {
			meta[r[0]] = r[1]
		}
	}
	if v, err := strconv.Atoi(meta[MetaKeySchemaVersion]); err != nil || v != SchemaVersion {
		return fmt.Errorf(
			"unsupported backup schema version %q (expected %d) — this file is not compatible with this app version",
			meta[MetaKeySchemaVersion], SchemaVersion,
		)
	}
	return nil
}

type parsedBackup struct {
	activities        []activityModel.Activity
	timeRecords       []timeModel.TimeRecord
	notes             []noteModel.Note
	routines          []routineModel.Routine
	routineActivities []routineModel.RoutineActivity
	activityRecords   []activityModel.ActivityRecord
	transactions      []financeModel.Transaction
	payments          []financeModel.Payment
	mealLogs          []healthModel.MealLog
	exercises         []healthModel.Exercise
	workoutSessions   []healthModel.WorkoutSession
}

// sheet provides header-indexed access to a sheet's rows. GetRows trims
// trailing empty cells, so accessors return "" past the row's end.
type sheet struct {
	index map[string]int
	rows  [][]string
}

func readSheet(f *excelize.File, name string, want []string) (*sheet, error) {
	rows, err := f.GetRows(name)
	if err != nil {
		return nil, fmt.Errorf("missing sheet %q", name)
	}
	if len(rows) == 0 {
		return &sheet{index: headerIndex(want)}, nil
	}
	got := rows[0]
	if len(got) != len(want) {
		return nil, fmt.Errorf(
			"sheet %q: unexpected column layout (got %d columns, expected %d)", name, len(got), len(want),
		)
	}
	for i, w := range want {
		if got[i] != w {
			return nil, fmt.Errorf("sheet %q: unexpected column %q (expected %q)", name, got[i], w)
		}
	}
	return &sheet{index: headerIndex(want), rows: rows[1:]}, nil
}

func headerIndex(headers []string) map[string]int {
	idx := make(map[string]int, len(headers))
	for i, h := range headers {
		idx[h] = i
	}
	return idx
}

func (s *sheet) get(row []string, col string) string {
	i, ok := s.index[col]
	if !ok || i >= len(row) {
		return ""
	}
	return row[i]
}

type parseState struct {
	errs []string
}

func (p *parseState) addf(sheetName string, rowNo int, format string, args ...interface{}) {
	p.errs = append(p.errs, fmt.Sprintf("%s row %d: %s", sheetName, rowNo, fmt.Sprintf(format, args...)))
}

func (p *parseState) err() error {
	if len(p.errs) == 0 {
		return nil
	}
	if len(p.errs) > 10 {
		p.errs = append(p.errs[:10], fmt.Sprintf("... and %d more errors", len(p.errs)-10))
	}
	return fmt.Errorf("backup file is invalid:\n  - %s", strings.Join(p.errs, "\n  - "))
}

// parseBackup parses and validates the whole workbook. Row-level problems
// accumulate in the parseState so the user gets a full error report; a
// structurally broken sheet aborts immediately.
func parseBackup(f *excelize.File) (*parsedBackup, error) {
	b := &parsedBackup{}
	p := &parseState{}

	for _, parse := range []func(*excelize.File, *parsedBackup, *parseState) error{
		parseActivities,
		parseTimeRecords,
		parseNotes,
		parseRoutines,
		parseRoutineActivities,
		parseActivityRecords,
		parseTransactions,
		parsePayments,
		parseMealLogs,
		parseExercises,
		parseWorkoutSessions,
	} {
		if err := parse(f, b, p); err != nil {
			return nil, err
		}
	}
	if err := p.err(); err != nil {
		return nil, err
	}
	validateReferences(b, p)
	if err := p.err(); err != nil {
		return nil, err
	}
	return b, nil
}

func openSheet(f *excelize.File, name string, headers []string) (*sheet, error) {
	sh, err := readSheet(f, name, headers)
	if err != nil {
		return nil, err
	}
	return sh, nil
}

func parseActivities(f *excelize.File, b *parsedBackup, p *parseState) error {
	sh, err := openSheet(f, SheetActivities, ActivitiesHeader)
	if err != nil {
		return err
	}
	for i, row := range sh.rows {
		a := activityModel.Activity{}
		id, err := decUint(sh.get(row, "id"))
		if err != nil {
			p.addf(SheetActivities, i+2, "%v", err)
			continue
		}
		a.ID = id
		a.Title = sh.get(row, "title")
		a.Description = sh.get(row, "description")
		a.Frequency = activityModel.Frequency(sh.get(row, "frequency"))
		a.DayFrequency = sh.get(row, "day_frequency")
		a.DayTime = activityModel.DayTime(sh.get(row, "day_time"))
		a.PrivacyStatus = activityModel.PrivacyStatus(sh.get(row, "privacy_status"))
		if a.CompletionAmount, err = decInt(sh.get(row, "completion_amount")); err != nil {
			p.addf(SheetActivities, i+2, "completion_amount: %v", err)
			continue
		}
		if a.IsActive, err = decBool(sh.get(row, "is_active")); err != nil {
			p.addf(SheetActivities, i+2, "is_active: %v", err)
			continue
		}
		a.CreatedAt, a.UpdatedAt, a.DeletedAt = decTimestamps(p, SheetActivities, i+2, row, sh)
		b.activities = append(b.activities, a)
	}
	return nil
}

func parseTimeRecords(f *excelize.File, b *parsedBackup, p *parseState) error {
	sh, err := openSheet(f, SheetTimeRecords, TimeRecordsHeader)
	if err != nil {
		return err
	}
	for i, row := range sh.rows {
		t := timeModel.TimeRecord{}
		id, err := decUint(sh.get(row, "id"))
		if err != nil {
			p.addf(SheetTimeRecords, i+2, "%v", err)
			continue
		}
		t.ID = id
		t.Category = sh.get(row, "category")
		t.Description = sh.get(row, "description")
		if t.DurationMinutes, err = decInt(sh.get(row, "duration_minutes")); err != nil {
			p.addf(SheetTimeRecords, i+2, "duration_minutes: %v", err)
			continue
		}
		t.CreatedAt, t.UpdatedAt, t.DeletedAt = decTimestamps(p, SheetTimeRecords, i+2, row, sh)
		b.timeRecords = append(b.timeRecords, t)
	}
	return nil
}

func parseNotes(f *excelize.File, b *parsedBackup, p *parseState) error {
	sh, err := openSheet(f, SheetNotes, NotesHeader)
	if err != nil {
		return err
	}
	for i, row := range sh.rows {
		n := noteModel.Note{}
		id, err := decUint(sh.get(row, "id"))
		if err != nil {
			p.addf(SheetNotes, i+2, "%v", err)
			continue
		}
		n.ID = id
		n.Title = sh.get(row, "title")
		n.Content = sh.get(row, "content")
		n.CreatedAt, n.UpdatedAt, n.DeletedAt = decTimestamps(p, SheetNotes, i+2, row, sh)
		b.notes = append(b.notes, n)
	}
	return nil
}

func parseRoutines(f *excelize.File, b *parsedBackup, p *parseState) error {
	sh, err := openSheet(f, SheetRoutines, RoutinesHeader)
	if err != nil {
		return err
	}
	for i, row := range sh.rows {
		r := routineModel.Routine{}
		id, err := decUint(sh.get(row, "id"))
		if err != nil {
			p.addf(SheetRoutines, i+2, "%v", err)
			continue
		}
		r.ID = id
		r.Title = sh.get(row, "title")
		r.Description = sh.get(row, "description")
		r.PrivacyStatus = routineModel.PrivacyStatus(sh.get(row, "privacy_status"))
		r.CreatedAt, r.UpdatedAt, r.DeletedAt = decTimestamps(p, SheetRoutines, i+2, row, sh)
		b.routines = append(b.routines, r)
	}
	return nil
}

func parseRoutineActivities(f *excelize.File, b *parsedBackup, p *parseState) error {
	sh, err := openSheet(f, SheetRoutineActivities, RoutineActivitiesHeader)
	if err != nil {
		return err
	}
	for i, row := range sh.rows {
		ra := routineModel.RoutineActivity{}
		if ra.RoutineID, err = decUint(sh.get(row, "routine_id")); err != nil {
			p.addf(SheetRoutineActivities, i+2, "routine_id: %v", err)
			continue
		}
		if ra.ActivityID, err = decUint(sh.get(row, "activity_id")); err != nil {
			p.addf(SheetRoutineActivities, i+2, "activity_id: %v", err)
			continue
		}
		if ra.Position, err = decInt(sh.get(row, "position")); err != nil {
			p.addf(SheetRoutineActivities, i+2, "position: %v", err)
			continue
		}
		b.routineActivities = append(b.routineActivities, ra)
	}
	return nil
}

func parseActivityRecords(f *excelize.File, b *parsedBackup, p *parseState) error {
	sh, err := openSheet(f, SheetActivityRecords, ActivityRecordsHeader)
	if err != nil {
		return err
	}
	for i, row := range sh.rows {
		r := activityModel.ActivityRecord{}
		if r.ID, err = decObjectID(sh.get(row, "id")); err != nil {
			p.addf(SheetActivityRecords, i+2, "id: %v", err)
			continue
		}
		if r.ActivityID, err = decUint(sh.get(row, "activity_id")); err != nil {
			p.addf(SheetActivityRecords, i+2, "activity_id: %v", err)
			continue
		}
		if r.CompletionDate, err = decTime(sh.get(row, "completion_date")); err != nil {
			p.addf(SheetActivityRecords, i+2, "completion_date: %v", err)
			continue
		}
		r.Notes = sh.get(row, "notes")
		if r.CreatedAt, err = decTime(sh.get(row, "created_at")); err != nil {
			p.addf(SheetActivityRecords, i+2, "created_at: %v", err)
			continue
		}
		b.activityRecords = append(b.activityRecords, r)
	}
	return nil
}

func parseTransactions(f *excelize.File, b *parsedBackup, p *parseState) error {
	sh, err := openSheet(f, SheetTransactions, TransactionsHeader)
	if err != nil {
		return err
	}
	for i, row := range sh.rows {
		t := financeModel.Transaction{}
		if t.ID, err = decObjectID(sh.get(row, "id")); err != nil {
			p.addf(SheetTransactions, i+2, "id: %v", err)
			continue
		}
		t.Type = financeModel.TransactionType(sh.get(row, "type"))
		t.Frequency = financeModel.TransactionFrequency(sh.get(row, "frequency"))
		t.PaymentFrequency = financeModel.PaymentFrequency(sh.get(row, "payment_frequency"))
		if t.Amount, err = decFloat(sh.get(row, "amount")); err != nil {
			p.addf(SheetTransactions, i+2, "amount: %v", err)
			continue
		}
		t.Category = sh.get(row, "category")
		t.Description = sh.get(row, "description")
		if t.Date, err = decTime(sh.get(row, "date")); err != nil {
			p.addf(SheetTransactions, i+2, "date: %v", err)
			continue
		}
		if t.CreatedAt, err = decTime(sh.get(row, "created_at")); err != nil {
			p.addf(SheetTransactions, i+2, "created_at: %v", err)
			continue
		}
		if t.UpdatedAt, err = decTime(sh.get(row, "updated_at")); err != nil {
			p.addf(SheetTransactions, i+2, "updated_at: %v", err)
			continue
		}
		b.transactions = append(b.transactions, t)
	}
	return nil
}

func parsePayments(f *excelize.File, b *parsedBackup, p *parseState) error {
	sh, err := openSheet(f, SheetPayments, PaymentsHeader)
	if err != nil {
		return err
	}
	for i, row := range sh.rows {
		pay := financeModel.Payment{}
		if pay.ID, err = decObjectID(sh.get(row, "id")); err != nil {
			p.addf(SheetPayments, i+2, "id: %v", err)
			continue
		}
		if pay.TransactionID, err = decObjectID(sh.get(row, "transaction_id")); err != nil {
			p.addf(SheetPayments, i+2, "transaction_id: %v", err)
			continue
		}
		if pay.Amount, err = decFloat(sh.get(row, "amount")); err != nil {
			p.addf(SheetPayments, i+2, "amount: %v", err)
			continue
		}
		if pay.Date, err = decTime(sh.get(row, "date")); err != nil {
			p.addf(SheetPayments, i+2, "date: %v", err)
			continue
		}
		if pay.CreatedAt, err = decTime(sh.get(row, "created_at")); err != nil {
			p.addf(SheetPayments, i+2, "created_at: %v", err)
			continue
		}
		b.payments = append(b.payments, pay)
	}
	return nil
}

func parseMealLogs(f *excelize.File, b *parsedBackup, p *parseState) error {
	sh, err := openSheet(f, SheetMealLogs, MealLogsHeader)
	if err != nil {
		return err
	}
	for i, row := range sh.rows {
		m := healthModel.MealLog{}
		if m.ID, err = decObjectID(sh.get(row, "id")); err != nil {
			p.addf(SheetMealLogs, i+2, "id: %v", err)
			continue
		}
		m.MealType = sh.get(row, "meal_type")
		m.Name = sh.get(row, "name")
		if m.Calories, err = decFloat(sh.get(row, "calories")); err != nil {
			p.addf(SheetMealLogs, i+2, "calories: %v", err)
			continue
		}
		if m.Protein, err = decFloat(sh.get(row, "protein")); err != nil {
			p.addf(SheetMealLogs, i+2, "protein: %v", err)
			continue
		}
		if m.Carbs, err = decFloat(sh.get(row, "carbs")); err != nil {
			p.addf(SheetMealLogs, i+2, "carbs: %v", err)
			continue
		}
		if m.Fat, err = decFloat(sh.get(row, "fat")); err != nil {
			p.addf(SheetMealLogs, i+2, "fat: %v", err)
			continue
		}
		if m.Date, err = decTime(sh.get(row, "date")); err != nil {
			p.addf(SheetMealLogs, i+2, "date: %v", err)
			continue
		}
		if m.CreatedAt, err = decTime(sh.get(row, "created_at")); err != nil {
			p.addf(SheetMealLogs, i+2, "created_at: %v", err)
			continue
		}
		if m.UpdatedAt, err = decTime(sh.get(row, "updated_at")); err != nil {
			p.addf(SheetMealLogs, i+2, "updated_at: %v", err)
			continue
		}
		b.mealLogs = append(b.mealLogs, m)
	}
	return nil
}

func parseExercises(f *excelize.File, b *parsedBackup, p *parseState) error {
	sh, err := openSheet(f, SheetExercises, ExercisesHeader)
	if err != nil {
		return err
	}
	for i, row := range sh.rows {
		e := healthModel.Exercise{}
		if e.ID, err = decObjectID(sh.get(row, "id")); err != nil {
			p.addf(SheetExercises, i+2, "id: %v", err)
			continue
		}
		e.Name = sh.get(row, "name")
		if err = json.Unmarshal([]byte(sh.get(row, "muscle_groups")), &e.MuscleGroups); err != nil {
			p.addf(SheetExercises, i+2, "muscle_groups: %v", err)
			continue
		}
		if e.CreatedAt, err = decTime(sh.get(row, "created_at")); err != nil {
			p.addf(SheetExercises, i+2, "created_at: %v", err)
			continue
		}
		b.exercises = append(b.exercises, e)
	}
	return nil
}

func parseWorkoutSessions(f *excelize.File, b *parsedBackup, p *parseState) error {
	sh, err := openSheet(f, SheetWorkoutSessions, WorkoutSessionsHeader)
	if err != nil {
		return err
	}
	for i, row := range sh.rows {
		w, err := parseWorkoutSession(row, sh)
		if err != nil {
			p.addf(SheetWorkoutSessions, i+2, "%v", err)
			continue
		}
		b.workoutSessions = append(b.workoutSessions, w)
	}
	return nil
}

type jsonSet struct {
	Reps     int     `json:"reps"`
	WeightKg float64 `json:"weightKg"`
}

type jsonExercise struct {
	ExerciseID string    `json:"exerciseId"`
	Sets       []jsonSet `json:"sets"`
}

func parseWorkoutSession(row []string, sh *sheet) (healthModel.WorkoutSession, error) {
	w := healthModel.WorkoutSession{}
	var err error
	if w.ID, err = decObjectID(sh.get(row, "id")); err != nil {
		return w, fmt.Errorf("id: %w", err)
	}
	if w.Date, err = decTime(sh.get(row, "date")); err != nil {
		return w, fmt.Errorf("date: %w", err)
	}
	if w.DurationMinutes, err = decOptionalInt(sh.get(row, "duration_minutes")); err != nil {
		return w, fmt.Errorf("duration_minutes: %w", err)
	}
	w.Notes = sh.get(row, "notes")

	var parsed []jsonExercise
	if err = json.Unmarshal([]byte(sh.get(row, "exercises")), &parsed); err != nil {
		return w, fmt.Errorf("exercises: %w", err)
	}
	w.Exercises = make([]healthModel.SessionExercise, 0, len(parsed))
	for _, ex := range parsed {
		oid, oidErr := decObjectID(ex.ExerciseID)
		if oidErr != nil {
			return w, fmt.Errorf("exerciseId %q: %w", ex.ExerciseID, oidErr)
		}
		sets := make([]healthModel.WorkoutSet, 0, len(ex.Sets))
		for _, s := range ex.Sets {
			sets = append(sets, healthModel.WorkoutSet{Reps: s.Reps, WeightKg: s.WeightKg})
		}
		w.Exercises = append(w.Exercises, healthModel.SessionExercise{ExerciseID: oid, Sets: sets})
	}
	if w.CreatedAt, err = decTime(sh.get(row, "created_at")); err != nil {
		return w, fmt.Errorf("created_at: %w", err)
	}
	if w.UpdatedAt, err = decTime(sh.get(row, "updated_at")); err != nil {
		return w, fmt.Errorf("updated_at: %w", err)
	}
	return w, nil
}

func decTimestamps(
	p *parseState, sheetName string, rowNo int, row []string, sh *sheet,
) (createdAt, updatedAt time.Time, deletedAt gorm.DeletedAt) {
	var err error
	if createdAt, err = decTime(sh.get(row, "created_at")); err != nil {
		p.addf(sheetName, rowNo, "created_at: %v", err)
	}
	if updatedAt, err = decTime(sh.get(row, "updated_at")); err != nil {
		p.addf(sheetName, rowNo, "updated_at: %v", err)
	}
	if raw := sh.get(row, "deleted_at"); raw != "" {
		t, e := decTime(raw)
		if e != nil {
			p.addf(sheetName, rowNo, "deleted_at: %v", e)
		} else {
			deletedAt = gorm.DeletedAt{Time: t, Valid: true}
		}
	}
	return createdAt, updatedAt, deletedAt
}

// validateReferences checks that every cross-entity reference in the file
// points at a row that is also in the file — the restore would otherwise
// produce orphans.
func validateReferences(b *parsedBackup, p *parseState) {
	activityIDs := make(map[uint]struct{}, len(b.activities))
	for _, a := range b.activities {
		activityIDs[a.ID] = struct{}{}
	}
	routineIDs := make(map[uint]struct{}, len(b.routines))
	for _, r := range b.routines {
		routineIDs[r.ID] = struct{}{}
	}
	transactionIDs := make(map[primitive.ObjectID]struct{}, len(b.transactions))
	for _, t := range b.transactions {
		transactionIDs[t.ID] = struct{}{}
	}
	exerciseIDs := make(map[primitive.ObjectID]struct{}, len(b.exercises))
	for _, e := range b.exercises {
		exerciseIDs[e.ID] = struct{}{}
	}

	for i, ra := range b.routineActivities {
		if _, ok := routineIDs[ra.RoutineID]; !ok {
			p.addf(SheetRoutineActivities, i+2, "routine_id %d not found in %q sheet", ra.RoutineID, SheetRoutines)
		}
		if _, ok := activityIDs[ra.ActivityID]; !ok {
			p.addf(SheetRoutineActivities, i+2, "activity_id %d not found in %q sheet", ra.ActivityID, SheetActivities)
		}
	}
	for i, r := range b.activityRecords {
		if _, ok := activityIDs[r.ActivityID]; !ok {
			p.addf(SheetActivityRecords, i+2, "activity_id %d not found in %q sheet", r.ActivityID, SheetActivities)
		}
	}
	for i, pay := range b.payments {
		if _, ok := transactionIDs[pay.TransactionID]; !ok {
			p.addf(SheetPayments, i+2, "transaction_id %s not found in %q sheet", pay.TransactionID.Hex(), SheetTransactions)
		}
	}
	for i, w := range b.workoutSessions {
		for _, se := range w.Exercises {
			if _, ok := exerciseIDs[se.ExerciseID]; !ok {
				p.addf(SheetWorkoutSessions, i+2, "exerciseId %s not found in %q sheet", se.ExerciseID.Hex(), SheetExercises)
			}
		}
	}
}

// ---- destructive phase ----

// applyUserID re-owns every row in the file with the authenticated user's
// ID. The file's user_id columns are ignored so a backup can also be
// restored into a different account.
func applyUserID(userID uint, b *parsedBackup) {
	for i := range b.activities {
		b.activities[i].UserID = userID
	}
	for i := range b.timeRecords {
		b.timeRecords[i].UserID = userID
	}
	for i := range b.notes {
		b.notes[i].UserID = userID
	}
	for i := range b.routines {
		b.routines[i].UserID = userID
	}
	// routine_activities is a pure join table — no user_id column.
	for i := range b.activityRecords {
		b.activityRecords[i].UserID = userID
	}
	for i := range b.transactions {
		b.transactions[i].UserID = userID
	}
	for i := range b.payments {
		b.payments[i].UserID = userID
	}
	for i := range b.mealLogs {
		b.mealLogs[i].UserID = userID
	}
	for i := range b.exercises {
		b.exercises[i].UserID = userID
	}
	for i := range b.workoutSessions {
		b.workoutSessions[i].UserID = userID
	}
}

// restorePostgres deletes the user's rows and inserts the file's rows inside
// a single transaction.
func (s *BackupService) restorePostgres(userID uint, b *parsedBackup) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Hard-delete everything the user owns, children first.
		if err := tx.Exec(
			"DELETE FROM routine_activities WHERE routine_id IN (SELECT id FROM routines WHERE user_id = ?)", userID,
		).Error; err != nil {
			return err
		}
		for _, m := range []interface{}{
			&routineModel.Routine{},
			&activityModel.Activity{},
			&timeModel.TimeRecord{},
			&noteModel.Note{},
		} {
			if err := tx.Unscoped().Where("user_id = ?", userID).Delete(m).Error; err != nil {
				return err
			}
		}

		// Insert with the original IDs, parents first (foreign keys).
		if err := insertRows(tx, b.activities); err != nil {
			return fmt.Errorf("activities: %w", err)
		}
		if err := insertRows(tx, b.timeRecords); err != nil {
			return fmt.Errorf("time_records: %w", err)
		}
		if err := insertRows(tx, b.notes); err != nil {
			return fmt.Errorf("notes: %w", err)
		}
		if err := insertRows(tx, b.routines); err != nil {
			return fmt.Errorf("routines: %w", err)
		}
		if err := insertRows(tx, b.routineActivities); err != nil {
			return fmt.Errorf("routine_activities: %w", err)
		}
		return nil
	})
}

func insertRows[T any](tx *gorm.DB, rows []T) error {
	for i := range rows {
		if err := tx.Create(&rows[i]).Error; err != nil {
			return err
		}
	}
	return nil
}

// repairSequences re-aligns the bigserial sequences after an import that
// restored explicit IDs, so the next insert doesn't hit duplicate keys.
func repairSequences(db *gorm.DB) {
	for _, table := range serialTables {
		var maxID uint
		if err := db.Raw(fmt.Sprintf("SELECT COALESCE(MAX(id), 0) FROM %s", table)).Scan(&maxID).Error; err != nil {
			continue
		}
		if maxID == 0 {
			continue
		}
		if err := db.Exec(
			fmt.Sprintf("SELECT setval(pg_get_serial_sequence('%s', 'id'), %d, true)", table, maxID),
		).Error; err != nil {
			slog.Warn("failed to repair sequence", "table", table, "error", err)
		}
	}
}

// restoreMongo deletes and re-inserts the user's Mongo documents. Standalone
// MongoDB (dev/test) has no cross-collection transactions, so this runs
// collection by collection after the file was fully validated.
func (s *BackupService) restoreMongo(userID uint, b *parsedBackup) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	for _, name := range mongoCollections {
		if _, err := s.mongo.Collection(name).DeleteMany(ctx, bson.M{"userId": userID}); err != nil {
			return fmt.Errorf("failed to clear %s: %w", name, err)
		}
	}

	inserts := []struct {
		name string
		docs []interface{}
	}{
		{"activity_records", toDocs(b.activityRecords)},
		{"transactions", toDocs(b.transactions)},
		{"payments", toDocs(b.payments)},
		{"meal_logs", toDocs(b.mealLogs)},
		{"exercises", toDocs(b.exercises)},
		{"workout_sessions", toDocs(b.workoutSessions)},
	}
	for _, ins := range inserts {
		if len(ins.docs) == 0 {
			continue
		}
		if _, err := s.mongo.Collection(ins.name).InsertMany(ctx, ins.docs); err != nil {
			return fmt.Errorf("failed to restore %s: %w", ins.name, err)
		}
	}
	return nil
}

func toDocs[T any](rows []T) []interface{} {
	docs := make([]interface{}, len(rows))
	for i := range rows {
		docs[i] = rows[i]
	}
	return docs
}
