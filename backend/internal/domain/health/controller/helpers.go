package controller

import (
	"errors"
	"strconv"
	"time"

	"life-tracker-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func getHealthUserID(ctx *gin.Context) (uint, error) {
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

func getHealthTimezone(ctx *gin.Context) *time.Location {
	return middleware.GetTimezoneFromContext(ctx)
}

func parseHealthDate(s string) *time.Time {
	if s == "" {
		return nil
	}
	parsed, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &parsed
}

func parseHealthPositiveInt(s string) *int {
	if s == "" {
		return nil
	}
	v, err := strconv.Atoi(s)
	if err != nil || v <= 0 {
		return nil
	}
	return &v
}
