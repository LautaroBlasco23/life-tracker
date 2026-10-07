package middleware

import "github.com/gin-gonic/gin"

// SecurityHeadersMiddleware sets conservative baseline headers on every
// response. HSTS is intentionally absent: the API serves plain HTTP behind a
// TLS terminator — enable "Strict-Transport-Security: max-age=31536000;
// includeSubDomains" (or set it in infra/nginx) once TLS termination is in
// place for the API host.
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Cross-Origin-Opener-Policy", "same-origin")
		// API responses are not intended to be embedded anywhere.
		c.Header("Content-Security-Policy", "frame-ancestors 'none'; default-src 'none'")
		c.Next()
	}
}
