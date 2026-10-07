package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// RequestLoggerMiddleware emits one structured log line per HTTP request after
// the handler completes. It is registered before the auth group middleware, so
// userID set on the context during the request is available when logging.
// Request bodies are never logged (they may contain passwords), and the email
// is never logged either (PII).
func RequestLoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.FullPath()
		start := time.Now()

		c.Next()

		// The Prometheus scrape endpoint is polled every 5s and carries no
		// request semantics; skip it to avoid noise in the log store.
		if path == "/metrics" {
			return
		}

		attrs := []any{
			"method", c.Request.Method,
			"path", path,
			"status", c.Writer.Status(),
			"duration_ms", time.Since(start).Milliseconds(),
			"client_ip", c.ClientIP(),
			"user_agent", c.Request.UserAgent(),
			"request_id", c.GetString(RequestIDKey),
		}
		if userID, ok := GetUserIDFromContext(c); ok {
			attrs = append(attrs, "user_id", userID)
		}
		// user_id is enough to correlate requests; the email is PII and must
		// not be written to the log store on every request.
		if len(c.Errors) > 0 {
			attrs = append(attrs, "errors", c.Errors.String())
		}

		level := slog.LevelInfo
		switch {
		case c.Writer.Status() >= 500:
			level = slog.LevelError
		case c.Writer.Status() >= 400:
			level = slog.LevelWarn
		}

		slog.Log(c.Request.Context(), level, "http_request", attrs...)
	}
}
