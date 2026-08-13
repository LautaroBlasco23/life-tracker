package routes

import (
	"life-tracker-backend/internal/domain/health/controller"
	"life-tracker-backend/internal/domain/health/service"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
)

func RegisterHealthRoutes(router *gin.RouterGroup, mongoDB *mongo.Database) {
	mealLogController := controller.NewMealLogController(service.NewMealLogService(mongoDB))
	exerciseController := controller.NewExerciseController(service.NewExerciseService(mongoDB))
	workoutController := controller.NewWorkoutController(service.NewWorkoutService(mongoDB))

	nutritionGroup := router.Group("/health/nutrition")
	{
		nutritionGroup.POST("/meals", mealLogController.CreateMealLog)
		nutritionGroup.GET("/meals", mealLogController.GetMealLogs)
		nutritionGroup.GET("/meals/:id", mealLogController.GetMealLog)
		nutritionGroup.PUT("/meals/:id", mealLogController.UpdateMealLog)
		nutritionGroup.DELETE("/meals/:id", mealLogController.DeleteMealLog)
		nutritionGroup.GET("/summary", mealLogController.GetNutritionSummary)
	}

	gymGroup := router.Group("/health/gym")
	{
		gymGroup.POST("/exercises", exerciseController.CreateExercise)
		gymGroup.GET("/exercises", exerciseController.GetExercises)
		gymGroup.PUT("/exercises/:id", exerciseController.UpdateExercise)
		gymGroup.DELETE("/exercises/:id", exerciseController.DeleteExercise)

		gymGroup.POST("/workouts", workoutController.CreateWorkoutSession)
		gymGroup.GET("/workouts", workoutController.GetWorkoutSessions)
		gymGroup.GET("/workouts/:id", workoutController.GetWorkoutSession)
		gymGroup.PUT("/workouts/:id", workoutController.UpdateWorkoutSession)
		gymGroup.DELETE("/workouts/:id", workoutController.DeleteWorkoutSession)
		gymGroup.GET("/stats", workoutController.GetGymStats)
	}
}
