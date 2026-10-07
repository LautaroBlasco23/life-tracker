package routes

import (
	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/auth/controller"
	"life-tracker-backend/internal/domain/auth/service"
	userService "life-tracker-backend/internal/domain/user/service"
	"life-tracker-backend/internal/infrastructure/imagestore"
	"life-tracker-backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterAuthRoutes(router *gin.RouterGroup, db *gorm.DB, cfg *config.Config, imageClient *imagestore.Client) {
	authService := service.NewAuthService(db, cfg)
	userService := userService.NewUserService(db, imageClient)
	authController := controller.NewAuthController(authService, userService)

	// Public auth endpoints are the brute-force / credential-stuffing target:
	// every route is per-IP rate limited (see internal/middleware/rate_limit.go).
	limited := router.Group("/auth",
		middleware.RateLimitMiddleware(middleware.AuthRateLimit, middleware.AuthRateWindow))
	{
		limited.POST("/register", authController.Register)
		limited.POST("/login", authController.Login)
		limited.POST("/refresh", authController.RefreshToken)
	}
}

func RegisterProtectedAuthRoutes(router *gin.RouterGroup, db *gorm.DB, cfg *config.Config, imageClient *imagestore.Client) {
	authService := service.NewAuthService(db, cfg)
	userService := userService.NewUserService(db, imageClient)
	authController := controller.NewAuthController(authService, userService)

	authGroup := router.Group("/auth")
	{
		authGroup.PUT("/password", authController.UpdatePassword)
		authGroup.PUT("/email", authController.UpdateEmail)
		authGroup.POST("/logout", authController.Logout)
	}
}
