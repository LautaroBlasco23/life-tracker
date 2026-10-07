package controller

import (
	"errors"
	"net/http"
	"strconv"

	"life-tracker-backend/internal/domain/reminder/dto"
	"life-tracker-backend/internal/domain/reminder/service"

	"github.com/gin-gonic/gin"
)

type ReminderController struct {
	reminderService *service.ReminderService
}

func NewReminderController(reminderService *service.ReminderService) *ReminderController {
	return &ReminderController{
		reminderService: reminderService,
	}
}

func getReminderUserID(ctx *gin.Context) (uint, error) {
	value, exists := ctx.Get("userID")
	if !exists {
		return 0, errors.New("user ID not found in context")
	}
	userID, ok := value.(uint)
	if !ok {
		return 0, errors.New("invalid user ID type in context")
	}
	return userID, nil
}

func (c *ReminderController) CreateReminder(ctx *gin.Context) {
	userID, err := getReminderUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req dto.CreateReminderRequest
	if bindErr := ctx.ShouldBindJSON(&req); bindErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	reminder, err := c.reminderService.CreateReminder(userID, &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"message": "Reminder created successfully",
		"data":    reminder,
	})
}

func (c *ReminderController) GetUserReminders(ctx *gin.Context) {
	userID, err := getReminderUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	reminders, err := c.reminderService.GetUserReminders(userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Reminders retrieved successfully",
		"data":    reminders,
		"count":   len(reminders),
	})
}

func (c *ReminderController) GetReminder(ctx *gin.Context) {
	userID, err := getReminderUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	reminderID, err := parseReminderID(ctx)
	if err != nil {
		return
	}

	reminder, err := c.reminderService.GetReminder(userID, reminderID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Reminder retrieved successfully",
		"data":    reminder,
	})
}

func (c *ReminderController) UpdateReminder(ctx *gin.Context) {
	userID, err := getReminderUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	reminderID, err := parseReminderID(ctx)
	if err != nil {
		return
	}

	var req dto.UpdateReminderRequest
	if bindErr := ctx.ShouldBindJSON(&req); bindErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	reminder, err := c.reminderService.UpdateReminder(userID, reminderID, &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Reminder updated successfully",
		"data":    reminder,
	})
}

func (c *ReminderController) DeleteReminder(ctx *gin.Context) {
	userID, err := getReminderUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	reminderID, err := parseReminderID(ctx)
	if err != nil {
		return
	}

	if deleteErr := c.reminderService.DeleteReminder(userID, reminderID); deleteErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": deleteErr.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Reminder deleted successfully"})
}

func (c *ReminderController) CompleteReminder(ctx *gin.Context) {
	userID, err := getReminderUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	reminderID, err := parseReminderID(ctx)
	if err != nil {
		return
	}

	reminder, err := c.reminderService.CompleteReminder(userID, reminderID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Reminder completed successfully",
		"data":    reminder,
	})
}

func (c *ReminderController) RevertCompletion(ctx *gin.Context) {
	userID, err := getReminderUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	reminderID, err := parseReminderID(ctx)
	if err != nil {
		return
	}

	if revertErr := c.reminderService.RevertCompletion(userID, reminderID); revertErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": revertErr.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Reminder completion reverted successfully"})
}

func parseReminderID(ctx *gin.Context) (uint, error) {
	idParam := ctx.Param("id")
	reminderID, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid reminder ID"})
		return 0, err
	}
	return uint(reminderID), nil
}
