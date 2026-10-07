package middleware

import (
	"log/slog"
	"strings"

	"github.com/gin-gonic/gin"
)

func CORSMiddleware(allowed string) gin.HandlerFunc {
	origins := map[string]struct{}{}
	allowAll := allowed == "*"

	slog.Info("CORS origins configured", "origins", allowed)

	if !allowAll {
		for _, o := range strings.Split(allowed, ",") {
			origins[strings.TrimSpace(o)] = struct{}{}
		}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		if allowAll {
			// Wildcard origins cannot be combined with credentials per the
			// CORS spec, and the API authenticates via Authorization headers
			// (no cookies), so credentials are only sent for explicit origins.
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Credentials", "false")
		} else {
			if _, ok := origins[origin]; ok {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Credentials", "true")
			}
			c.Header("Vary", "Origin")
		}
		c.Header("Access-Control-Allow-Headers",
			"Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, Accept, Origin, Cache-Control, X-Requested-With, X-Timezone")
		c.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
