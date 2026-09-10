package routes

import (
	"life-tracker-backend/internal/domain/data/controller"
	"life-tracker-backend/internal/domain/data/service"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
	"gorm.io/gorm"
)

func RegisterDataRoutes(router *gin.RouterGroup, db *gorm.DB, mongoDB *mongo.Database) {
	backupService := service.NewBackupService(db, mongoDB)
	dataController := controller.NewDataController(backupService)

	dataGroup := router.Group("/users/me/data")
	{
		dataGroup.GET("/export", dataController.ExportData)
		dataGroup.POST("/import", dataController.ImportData)
	}
}
