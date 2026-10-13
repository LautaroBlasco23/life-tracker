package routes

import (
	"life-tracker-backend/internal/domain/note-group/controller"
	"life-tracker-backend/internal/domain/note-group/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterNoteGroupRoutes(router *gin.RouterGroup, db *gorm.DB) {
	noteGroupService := service.NewNoteGroupService(db)
	noteGroupController := controller.NewNoteGroupController(noteGroupService)

	noteGroup := router.Group("/note-groups")
	{
		noteGroup.POST("", noteGroupController.CreateNoteGroup)
		noteGroup.GET("", noteGroupController.GetNoteGroups)
		noteGroup.GET("/:id", noteGroupController.GetNoteGroup)
		noteGroup.PUT("/:id", noteGroupController.UpdateNoteGroup)
		noteGroup.POST("/reorder", noteGroupController.ReorderNoteGroups)
		noteGroup.DELETE("/:id", noteGroupController.DeleteNoteGroup)
	}
}
