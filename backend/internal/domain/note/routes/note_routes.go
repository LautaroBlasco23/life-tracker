package routes

import (
	"life-tracker-backend/internal/domain/note/controller"
	"life-tracker-backend/internal/domain/note/service"
	"life-tracker-backend/internal/infrastructure/imagestore"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterNoteRoutes(router *gin.RouterGroup, db *gorm.DB, imageClient *imagestore.Client) {
	noteService := service.NewNoteService(db, imageClient)
	noteController := controller.NewNoteController(noteService)

	noteGroup := router.Group("/notes")
	{
		noteGroup.POST("", noteController.CreateNote)
		noteGroup.GET("", noteController.GetNotes)
		noteGroup.GET("/:id", noteController.GetNote)
		noteGroup.PUT("/:id", noteController.UpdateNote)
		noteGroup.POST("/reorder", noteController.ReorderNotes)
		noteGroup.POST("/images", noteController.UploadNoteImage)
		noteGroup.DELETE("/:id", noteController.DeleteNote)
	}
}
