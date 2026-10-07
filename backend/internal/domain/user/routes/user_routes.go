package routes

import (
	"life-tracker-backend/internal/domain/user/controller"
	"life-tracker-backend/internal/domain/user/service"
	"life-tracker-backend/internal/infrastructure/imagestore"
	"life-tracker-backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterUserRoutes(router *gin.RouterGroup, db *gorm.DB, imageClient *imagestore.Client) {
	userService := service.NewUserService(db, imageClient)
	userController := controller.NewUserController(userService)

	userGroup := router.Group("/users")
	{
		userGroup.GET("/me", userController.GetMyProfile)
		userGroup.PUT("/me", userController.UpdateProfile)
		userGroup.POST("/me/image", userController.UploadProfileImage)
		userGroup.DELETE("/me/image", userController.DeleteProfileImage)

		userGroup.GET("", userController.GetAllUsers)
		userGroup.GET("/search", userController.SearchUsers)
		userGroup.GET("/:username", userController.GetUserOrProfile)
	}
}

func RegisterPublicUserRoutes(router *gin.RouterGroup, db *gorm.DB, imageClient *imagestore.Client) {
	userService := service.NewUserService(db, imageClient)
	userController := controller.NewUserController(userService)

	// Public availability checks leak account existence — keep them rate
	// limited (see internal/middleware/rate_limit.go).
	limited := router.Group("/users",
		middleware.RateLimitMiddleware(middleware.EnumRateLimit, middleware.EnumRateWindow))
	{
		limited.GET("/check-username", userController.CheckUsernameAvailability)
		limited.GET("/check-email", userController.CheckEmailAvailability)
	}
}
