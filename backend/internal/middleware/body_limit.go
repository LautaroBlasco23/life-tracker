package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// BodySizeLimitMiddleware wraps every request body in http.MaxBytesReader so
// no endpoint can buffer an unbounded payload (memory-exhaustion DoS).
// Endpoints with their own stricter caps (import: 32 MB, avatar: 10 MB) are
// unaffected: the global ceiling is above their limits and their own
// validation still fires first for oversized-but-below-ceiling payloads.
func BodySizeLimitMiddleware(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		}
		c.Next()
	}
}
