package routes

import (
	"life-tracker-backend/internal/domain/sticky-note/controller"
	"life-tracker-backend/internal/domain/sticky-note/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterStickyNoteRoutes(router *gin.RouterGroup, db *gorm.DB) {
	stickyNoteService := service.NewStickyNoteService(db)
	stickyNoteController := controller.NewStickyNoteController(stickyNoteService)

	stickyNotes := router.Group("/sticky-notes")
	{
		stickyNotes.POST("", stickyNoteController.CreateStickyNote)
		stickyNotes.GET("", stickyNoteController.GetStickyNotes)
		stickyNotes.GET("/:id", stickyNoteController.GetStickyNote)
		stickyNotes.PUT("/:id", stickyNoteController.UpdateStickyNote)
		stickyNotes.DELETE("/:id", stickyNoteController.DeleteStickyNote)
	}
}
