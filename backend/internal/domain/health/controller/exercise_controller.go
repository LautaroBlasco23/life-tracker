package controller

import (
	"net/http"

	"life-tracker-backend/internal/domain/health/dto"
	"life-tracker-backend/internal/domain/health/service"

	"github.com/gin-gonic/gin"
)

type ExerciseController struct {
	exerciseService *service.ExerciseService
}

func NewExerciseController(s *service.ExerciseService) *ExerciseController {
	return &ExerciseController{exerciseService: s}
}

func (c *ExerciseController) CreateExercise(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req dto.CreateExerciseRequest
	if bindErr := ctx.ShouldBindJSON(&req); bindErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"details": bindErr.Error(),
		})
		return
	}

	exercise, err := c.exerciseService.CreateExercise(userID, &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"message": "Exercise created successfully",
		"data":    exercise,
	})
}

func (c *ExerciseController) GetExercises(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	exercises, err := c.exerciseService.GetExercises(userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Exercises retrieved successfully",
		"data":    exercises,
		"count":   len(exercises),
	})
}

func (c *ExerciseController) UpdateExercise(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req dto.UpdateExerciseRequest
	if bindErr := ctx.ShouldBindJSON(&req); bindErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"details": bindErr.Error(),
		})
		return
	}

	exercise, err := c.exerciseService.UpdateExercise(userID, ctx.Param("id"), &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Exercise updated successfully",
		"data":    exercise,
	})
}

func (c *ExerciseController) DeleteExercise(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	if deleteErr := c.exerciseService.DeleteExercise(userID, ctx.Param("id")); deleteErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": deleteErr.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Exercise deleted successfully",
	})
}
