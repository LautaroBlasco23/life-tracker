// data_controller_test.go
//
// Subject: internal/domain/data/controller/data_controller.go
// Scope:   HTTP contract of the backup endpoints — Export streams an XLSX
//
//	workbook with a download header, Import validates the multipart
//	upload, and a full export → import roundtrip restores the data
//	into another account.
//
// Out of scope: Workbook building/parsing internals → backup_service_test.go.
// Infrastructure: PostgreSQL + MongoDB (test instances via .env.test).
// Data strategy:  AutoMigrate + TRUNCATE the six backup tables + drop Mongo
//
//	collections (no DROP: sibling packages run in parallel).
//
// Parallel-safe:  No — single shared DB, no per-test namespace.
package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"life-tracker-backend/internal/config"
	activityModel "life-tracker-backend/internal/domain/activity/model"
	calendarModel "life-tracker-backend/internal/domain/calendar/model"
	"life-tracker-backend/internal/domain/data/service"
	noteModel "life-tracker-backend/internal/domain/note/model"
	routineModel "life-tracker-backend/internal/domain/routine/model"
	timeModel "life-tracker-backend/internal/domain/time/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	dataTestDB      *gorm.DB
	dataTestMongoDB *mongo.Database
	dataMongoClient *mongo.Client
	dataCfg         *config.Config
)

func TestMain(m *testing.M) {
	os.Setenv("ENVIRONMENT", "test")
	dataCfg = config.Load()
	gin.SetMode(gin.TestMode)

	code := m.Run()

	if dataMongoClient != nil {
		_ = dataMongoClient.Disconnect(context.Background())
	}
	os.Exit(code)
}

func setupDataTestDatabases(t *testing.T) (*gorm.DB, *mongo.Database) {
	t.Helper()

	if dataTestDB != nil {
		return dataTestDB, dataTestMongoDB
	}

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dataCfg.DBHost, dataCfg.DBPort, dataCfg.DBUser, dataCfg.DBPassword, dataCfg.DBName, dataCfg.DBSSLMode,
	)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err, "Failed to connect to PostgreSQL")

	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

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
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(dataCfg.MongoURI))
	require.NoError(t, err, "Failed to connect to MongoDB")
	require.NoError(t, client.Ping(ctx, nil), "MongoDB not available")

	dataTestDB = db
	dataTestMongoDB = client.Database(dataCfg.MongoDatabase)
	dataMongoClient = client
	return dataTestDB, dataTestMongoDB
}

func cleanDataDatabases(t *testing.T) {
	t.Helper()
	require.NoError(t, dataTestDB.Exec(
		"TRUNCATE TABLE routine_activities, routines, activities, time_records, notes, calendar_events RESTART IDENTITY CASCADE",
	).Error)

	collections, err := dataTestMongoDB.ListCollectionNames(context.Background(), bson.M{})
	require.NoError(t, err)
	for _, coll := range collections {
		require.NoError(t, dataTestMongoDB.Collection(coll).Drop(context.Background()))
	}
}

func setupDataRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	setupDataTestDatabases(t)
	cleanDataDatabases(t)

	backupService := service.NewBackupService(dataTestDB, dataTestMongoDB)
	controller := NewDataController(backupService)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Next()
	})
	router.GET("/users/me/data/export", controller.ExportData)
	router.POST("/users/me/data/import", controller.ImportData)

	return router, dataTestDB
}

func seedExportData(t *testing.T, db *gorm.DB, userID uint) {
	t.Helper()
	require.NoError(t, db.Create(&activityModel.Activity{
		UserID:           userID,
		Title:            "Morning Exercise",
		Frequency:        activityModel.FrequencyDaily,
		DayTime:          activityModel.DayTimeMorning,
		CompletionAmount: 1,
		IsActive:         true,
		PrivacyStatus:    activityModel.PrivacyPrivate,
	}).Error)
	require.NoError(t, db.Create(&timeModel.TimeRecord{
		UserID:          userID,
		Category:        "Work",
		Description:     "Deep work session",
		DurationMinutes: 90,
	}).Error)
	require.NoError(t, db.Create(&noteModel.Note{
		UserID:  userID,
		Title:   "Groceries",
		Content: "milk",
	}).Error)
}

func exportBackup(t *testing.T, router *gin.Engine, userID uint) []byte {
	t.Helper()

	exportRouter := gin.New()
	exportRouter.Use(func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	})
	backupService := service.NewBackupService(dataTestDB, dataTestMongoDB)
	exportRouter.GET("/users/me/data/export", NewDataController(backupService).ExportData)

	req := httptest.NewRequest(http.MethodGet, "/users/me/data/export", nil)
	w := httptest.NewRecorder()
	exportRouter.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	return w.Body.Bytes()
}

func TestExportDataHandler(t *testing.T) {
	router, db := setupDataRouter(t)
	seedExportData(t, db, 1)

	t.Run("streams an xlsx workbook with a download header", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/users/me/data/export", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			w.Header().Get("Content-Type"))
		assert.Contains(t, w.Header().Get("Content-Disposition"), "life-tracker-backup-")
		assert.Equal(t, "PK", w.Body.String()[:2], "xlsx is a zip archive")
	})

	t.Run("unauthorized without user context", func(t *testing.T) {
		anonRouter := gin.New()
		backupService := service.NewBackupService(dataTestDB, dataTestMongoDB)
		anonRouter.GET("/users/me/data/export", NewDataController(backupService).ExportData)

		req := httptest.NewRequest(http.MethodGet, "/users/me/data/export", nil)
		w := httptest.NewRecorder()
		anonRouter.ServeHTTP(w, req)
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

func TestImportDataHandler(t *testing.T) {
	router, db := setupDataRouter(t)
	seedExportData(t, db, 1)
	backup := exportBackup(t, router, 1)

	t.Run("missing file returns bad request", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/users/me/data/import", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Contains(t, resp["error"], "File is required")
	})

	t.Run("invalid workbook returns bad request", func(t *testing.T) {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("file", "backup.xlsx")
		require.NoError(t, err)
		_, err = io.Copy(part, bytes.NewReader([]byte("this is not an xlsx file")))
		require.NoError(t, err)
		require.NoError(t, writer.Close())

		req := httptest.NewRequest(http.MethodPost, "/users/me/data/import", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("roundtrip restores the exported data into the caller's account", func(t *testing.T) {
		importRouter := gin.New()
		importRouter.Use(func(c *gin.Context) {
			c.Set("userID", uint(1))
			c.Next()
		})
		backupService := service.NewBackupService(dataTestDB, dataTestMongoDB)
		importRouter.POST("/users/me/data/import", NewDataController(backupService).ImportData)

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("file", "backup.xlsx")
		require.NoError(t, err)
		_, err = io.Copy(part, bytes.NewReader(backup))
		require.NoError(t, err)
		require.NoError(t, writer.Close())

		req := httptest.NewRequest(http.MethodPost, "/users/me/data/import", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		w := httptest.NewRecorder()
		importRouter.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		if w.Code != http.StatusOK {
			t.Logf("restore failed body: %s", w.Body.String())
		}
		var resp struct {
			Message string `json:"message"`
			Data    struct {
				Activities  int `json:"activities"`
				TimeRecords int `json:"timeRecords"`
				Notes       int `json:"notes"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, "Data restored successfully", resp.Message)
		assert.Equal(t, 1, resp.Data.Activities)
		assert.Equal(t, 1, resp.Data.TimeRecords)
		assert.Equal(t, 1, resp.Data.Notes)

		// The restored rows replace the caller's data.
		var count int64
		require.NoError(t, dataTestDB.Table("activities").Where("user_id = ?", 1).Count(&count).Error)
		assert.Equal(t, int64(1), count)
	})
}
