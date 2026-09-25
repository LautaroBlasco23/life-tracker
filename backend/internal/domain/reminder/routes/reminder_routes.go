package routes

import (
	"life-tracker-backend/internal/domain/reminder/controller"
	"life-tracker-backend/internal/domain/reminder/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterReminderRoutes(router *gin.RouterGroup, db *gorm.DB) {
	reminderService := service.NewReminderService(db)
	reminderController := controller.NewReminderController(reminderService)

	reminderGroup := router.Group("/reminders")
	{
		reminderGroup.POST("", reminderController.CreateReminder)
		reminderGroup.GET("", reminderController.GetUserReminders)
		reminderGroup.GET("/:id", reminderController.GetReminder)
		reminderGroup.PUT("/:id", reminderController.UpdateReminder)
		reminderGroup.DELETE("/:id", reminderController.DeleteReminder)

		reminderGroup.POST("/:id/complete", reminderController.CompleteReminder)
		reminderGroup.DELETE("/:id/complete", reminderController.RevertCompletion)
	}
}
