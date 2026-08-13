package controller

import (
	"net/http"

	"life-tracker-backend/internal/domain/health/dto"
	"life-tracker-backend/internal/domain/health/service"

	"github.com/gin-gonic/gin"
)

type WorkoutController struct {
	workoutService *service.WorkoutService
}

func NewWorkoutController(s *service.WorkoutService) *WorkoutController {
	return &WorkoutController{workoutService: s}
}

func (c *WorkoutController) CreateWorkoutSession(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req dto.CreateWorkoutSessionRequest
	if bindErr := ctx.ShouldBindJSON(&req); bindErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"details": bindErr.Error(),
		})
		return
	}

	session, err := c.workoutService.CreateWorkoutSession(userID, &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"message": "Workout session created successfully",
		"data":    session,
	})
}

func (c *WorkoutController) GetWorkoutSessions(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	startDate := parseHealthDate(ctx.Query("start_date"))
	endDate := parseHealthDate(ctx.Query("end_date"))

	sessions, err := c.workoutService.GetWorkoutSessions(userID, startDate, endDate)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Workout sessions retrieved successfully",
		"data":    sessions,
		"count":   len(sessions),
	})
}

func (c *WorkoutController) GetWorkoutSession(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	session, err := c.workoutService.GetWorkoutSession(userID, ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Workout session retrieved successfully",
		"data":    session,
	})
}

func (c *WorkoutController) UpdateWorkoutSession(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req dto.UpdateWorkoutSessionRequest
	if bindErr := ctx.ShouldBindJSON(&req); bindErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"details": bindErr.Error(),
		})
		return
	}

	session, err := c.workoutService.UpdateWorkoutSession(userID, ctx.Param("id"), &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Workout session updated successfully",
		"data":    session,
	})
}

func (c *WorkoutController) DeleteWorkoutSession(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	if deleteErr := c.workoutService.DeleteWorkoutSession(userID, ctx.Param("id")); deleteErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": deleteErr.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Workout session deleted successfully",
	})
}

func (c *WorkoutController) GetGymStats(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	startDate, endDate, err := parseRequiredDateRange(ctx)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	loc := getHealthTimezone(ctx)
	stats, err := c.workoutService.GetGymStats(userID, startDate, endDate, loc)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Gym stats retrieved successfully",
		"data":    stats,
	})
}
