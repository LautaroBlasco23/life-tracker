package controller

import (
	"net/http"

	"life-tracker-backend/internal/domain/auth/dto"
	"life-tracker-backend/internal/domain/auth/service"

	userService "life-tracker-backend/internal/domain/user/service"

	"github.com/gin-gonic/gin"
)

type AuthController struct {
	authService *service.AuthService
	userService *userService.UserService // Add UserService dependency
}

func NewAuthController(authService *service.AuthService, userService *userService.UserService) *AuthController {
	return &AuthController{
		authService: authService,
		userService: userService,
	}
}

func (c *AuthController) Register(ctx *gin.Context) {
	var req dto.RegisterRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	// Register user and get tokens + user ID
	tokens, userID, err := c.authService.Register(&req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Get user profile data using the UserService
	userProfile, err := c.userService.GetUserByID(userID)
	if err != nil {
		// If we can't get user profile, still return successful registration with tokens
		ctx.JSON(http.StatusCreated, gin.H{
			"message": "User registered successfully",
			"data":    tokens,
		})
		return
	}

	// Return both tokens and user data
	ctx.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"data": gin.H{
			"tokens": tokens,
			"user":   userProfile,
		},
	})
}

func (c *AuthController) Login(ctx *gin.Context) {
	var req dto.LoginRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	// Login user and get tokens + user ID
	tokens, userID, err := c.authService.Login(&req)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Get user profile data using the UserService
	userProfile, err := c.userService.GetUserByID(userID)
	if err != nil {
		// If we can't get user profile, still return successful login with tokens
		ctx.JSON(http.StatusOK, gin.H{
			"message": "Login successful",
			"data":    tokens,
		})
		return
	}

	// Return both tokens and user data
	ctx.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"data": gin.H{
			"tokens": tokens,
			"user":   userProfile,
		},
	})
}

func (c *AuthController) RefreshToken(ctx *gin.Context) {
	var req dto.RefreshRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	tokens, err := c.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Token refreshed successfully",
		"data":    tokens,
	})
}

func (c *AuthController) UpdatePassword(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req dto.UpdatePasswordRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	uid, ok := userID.(uint)
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	tokens, err := c.authService.UpdatePassword(uid, &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Password updated successfully",
		"data":    tokens,
	})
}

func (c *AuthController) UpdateEmail(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	uid, ok := userID.(uint)
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	var req dto.UpdateEmailRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	tokens, err := c.authService.UpdateEmail(uid, &req)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Email updated successfully",
		"data":    tokens,
	})
}

// Logout revokes refresh tokens server-side. Body is optional: with a
// refresh_token only that session is revoked; without one, every session for
// the authenticated user is revoked.
func (c *AuthController) Logout(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	uid, ok := userID.(uint)
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req dto.LogoutRequest
	// An absent/invalid body is fine — it means "revoke all".
	if err := ctx.ShouldBindJSON(&req); err != nil {
		req = dto.LogoutRequest{}
	}

	if err := c.authService.Logout(req.RefreshToken, uid); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke session"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}
