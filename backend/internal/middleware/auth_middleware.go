package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type JWTClaims struct {
	jwt.RegisteredClaims
	Email  string `json:"email"`
	Type   string `json:"type"`
	UserID uint   `json:"userId"`
}

func JWTAuthMiddleware(secretKey string) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		authHeader := ctx.GetHeader("Authorization")
		if authHeader == "" {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header required",
			})
			ctx.Abort()
			return
		}

		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid authorization header format",
			})
			ctx.Abort()
			return
		}

		tokenString := tokenParts[1]
		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
			// Pin the algorithm: never let a token's own header choose it.
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok || t.Header["alg"] != jwt.SigningMethodHS256.Alg() {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(secretKey), nil
		})
		if err != nil {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token",
			})
			ctx.Abort()
			return
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok || !token.Valid {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token claims",
			})
			ctx.Abort()
			return
		}

		if claims.Type != "access" {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token type",
			})
			ctx.Abort()
			return
		}

		ctx.Set("userID", claims.UserID)
		ctx.Set("email", claims.Email)
		ctx.Next()
	}
}

func GetUserIDFromContext(ctx *gin.Context) (uint, bool) {
	value, exists := ctx.Get("userID")
	if !exists {
		return 0, false
	}
	userID, ok := value.(uint)
	return userID, ok
}
