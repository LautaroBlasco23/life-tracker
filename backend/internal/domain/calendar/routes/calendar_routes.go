package routes

import (
	"life-tracker-backend/internal/domain/calendar/controller"
	"life-tracker-backend/internal/domain/calendar/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterCalendarRoutes(router *gin.RouterGroup, db *gorm.DB) {
	calendarService := service.NewCalendarService(db)
	calendarController := controller.NewCalendarController(calendarService)

	calendarGroup := router.Group("/calendar-events")
	{
		calendarGroup.POST("", calendarController.CreateEvent)
		calendarGroup.GET("", calendarController.GetEvents)
		calendarGroup.GET("/:id", calendarController.GetEvent)
		calendarGroup.PUT("/:id", calendarController.UpdateEvent)
		calendarGroup.DELETE("/:id", calendarController.DeleteEvent)
	}
}
