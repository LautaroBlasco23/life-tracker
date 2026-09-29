package routes

import (
	"life-tracker-backend/internal/domain/routine/controller"
	"life-tracker-backend/internal/domain/routine/service"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
	"gorm.io/gorm"
)

func RegisterRoutineRoutes(router *gin.RouterGroup, db *gorm.DB, mongoDB *mongo.Database) {
	routineService := service.NewRoutineService(db, mongoDB)
	routineController := controller.NewRoutineController(routineService)

	routineGroup := router.Group("/routines")
	{
		routineGroup.POST("", routineController.CreateRoutine)
		routineGroup.GET("/me", routineController.GetMyRoutines)
		routineGroup.GET("/:id", routineController.GetRoutine)
		routineGroup.PATCH("/:id", routineController.UpdateRoutine)
		routineGroup.DELETE("/:id", routineController.DeleteRoutine)
	}
}
