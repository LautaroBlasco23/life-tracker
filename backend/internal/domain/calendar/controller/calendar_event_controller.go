package controller

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"life-tracker-backend/internal/domain/calendar/dto"
	"life-tracker-backend/internal/domain/calendar/service"
	"life-tracker-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

type CalendarController struct {
	calendarService *service.CalendarService
}

func NewCalendarController(calendarService *service.CalendarService) *CalendarController {
	return &CalendarController{calendarService: calendarService}
}

func getCalendarUserID(ctx *gin.Context) (uint, error) {
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

// getTimezone returns the user's timezone (sent by the client on the
// X-Timezone header). It anchors the occurrences of a recurring series to the
// user's wall clock.
func getTimezone(ctx *gin.Context) *time.Location {
	return middleware.GetTimezoneFromContext(ctx)
}

func (c *CalendarController) CreateEvent(ctx *gin.Context) {
	userID, err := getCalendarUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req dto.CreateCalendarEventRequest
	if bindErr := ctx.ShouldBindJSON(&req); bindErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	event, err := c.calendarService.CreateEvent(userID, &req, getTimezone(ctx))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"message": "Calendar event created successfully",
		"data":    event,
	})
}

// GetEvents returns the user's events, optionally restricted to a range.
// `from` and `to` are RFC3339 instants and must be sent together: a half-open
// range is almost always a client bug, and silently ignoring one bound would
// return a misleading list.
func (c *CalendarController) GetEvents(ctx *gin.Context) {
	userID, err := getCalendarUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	fromParam := ctx.Query("from")
	toParam := ctx.Query("to")
	if (fromParam == "") != (toParam == "") {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "from and to must be provided together",
		})
		return
	}

	filter := &dto.CalendarEventFilter{}
	if fromParam != "" {
		from, parseErr := time.Parse(time.RFC3339, fromParam)
		if parseErr != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid from"})
			return
		}
		to, parseErr := time.Parse(time.RFC3339, toParam)
		if parseErr != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid to"})
			return
		}
		filter.From = &from
		filter.To = &to
	}

	events, err := c.calendarService.GetEvents(userID, filter)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Calendar events retrieved successfully",
		"data":    events,
		"count":   len(events),
	})
}

func (c *CalendarController) GetEvent(ctx *gin.Context) {
	userID, err := getCalendarUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	eventID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid event ID"})
		return
	}

	event, err := c.calendarService.GetEvent(userID, uint(eventID))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Calendar event retrieved successfully",
		"data":    event,
	})
}

func (c *CalendarController) UpdateEvent(ctx *gin.Context) {
	userID, err := getCalendarUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	eventID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid event ID"})
		return
	}

	var req dto.UpdateCalendarEventRequest
	if bindErr := ctx.ShouldBindJSON(&req); bindErr != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	event, err := c.calendarService.UpdateEvent(userID, uint(eventID), &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Calendar event updated successfully",
		"data":    event,
	})
}

// DeleteEvent removes an event. The optional `scope` query parameter selects
// the occurrences to remove: "occurrence" (the default) or "series", which
// removes every occurrence of the series the event belongs to.
func (c *CalendarController) DeleteEvent(ctx *gin.Context) {
	userID, err := getCalendarUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	eventID, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid event ID"})
		return
	}

	scope := ctx.Query("scope")
	if scope != "" && scope != dto.ScopeOccurrence && scope != dto.ScopeSeries {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid scope"})
		return
	}

	if err := c.calendarService.DeleteEvent(userID, uint(eventID), scope); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Calendar event deleted successfully"})
}
