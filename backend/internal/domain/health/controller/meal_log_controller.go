package controller

import (
	"errors"
	"net/http"
	"time"

	"life-tracker-backend/internal/domain/health/dto"
	"life-tracker-backend/internal/domain/health/service"

	"github.com/gin-gonic/gin"
)

type MealLogController struct {
	mealLogService *service.MealLogService
}

func NewMealLogController(s *service.MealLogService) *MealLogController {
	return &MealLogController{mealLogService: s}
}

func (c *MealLogController) CreateMealLog(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req dto.CreateMealLogRequest
	if bindErr := ctx.ShouldBindJSON(&req); bindErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"details": bindErr.Error(),
		})
		return
	}

	mealLog, err := c.mealLogService.CreateMealLog(userID, &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"message": "Meal log created successfully",
		"data":    mealLog,
	})
}

func (c *MealLogController) GetMealLogs(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var mealType *string
	if mt := ctx.Query("meal_type"); mt != "" {
		mealType = &mt
	}
	startDate := parseHealthDate(ctx.Query("start_date"))
	endDate := parseHealthDate(ctx.Query("end_date"))

	limit := 200
	if l := parseHealthPositiveInt(ctx.Query("limit")); l != nil {
		limit = *l
	}

	mealLogs, err := c.mealLogService.GetMealLogs(userID, mealType, startDate, endDate, limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Meal logs retrieved successfully",
		"data":    mealLogs,
		"count":   len(mealLogs),
	})
}

func (c *MealLogController) GetMealLog(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	mealLog, err := c.mealLogService.GetMealLog(userID, ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Meal log retrieved successfully",
		"data":    mealLog,
	})
}

func (c *MealLogController) UpdateMealLog(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req dto.UpdateMealLogRequest
	if bindErr := ctx.ShouldBindJSON(&req); bindErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"details": bindErr.Error(),
		})
		return
	}

	mealLog, err := c.mealLogService.UpdateMealLog(userID, ctx.Param("id"), &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Meal log updated successfully",
		"data":    mealLog,
	})
}

func (c *MealLogController) DeleteMealLog(ctx *gin.Context) {
	userID, err := getHealthUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	if deleteErr := c.mealLogService.DeleteMealLog(userID, ctx.Param("id")); deleteErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": deleteErr.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Meal log deleted successfully",
	})
}

func (c *MealLogController) GetNutritionSummary(ctx *gin.Context) {
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
	summary, err := c.mealLogService.GetNutritionSummary(userID, startDate, endDate, loc)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Nutrition summary retrieved successfully",
		"data":    summary,
	})
}

func parseRequiredDateRange(ctx *gin.Context) (time.Time, time.Time, error) {
	startStr := ctx.Query("start_date")
	endStr := ctx.Query("end_date")
	if startStr == "" || endStr == "" {
		return time.Time{}, time.Time{}, errors.New("start_date and end_date are required (format: 2006-01-02)")
	}
	startDate, err := time.Parse("2006-01-02", startStr)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("Invalid start_date format")
	}
	endDate, err := time.Parse("2006-01-02", endStr)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("Invalid end_date format")
	}
	return startDate, endDate, nil
}
