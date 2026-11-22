package middleware

import (
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// In-memory fixed-window rate limiter keyed by client IP. Intentionally
// dependency-free and per-instance: it protects the public auth/enumeration
// endpoints of a single API replica. If the API ever runs multiple replicas
// behind a load balancer, replace with a shared-store limiter (e.g. Redis).

// Auth routes (login/register/refresh): brute-force and credential-stuffing
// target. Enum checks (username/email availability): account-enumeration
// surface. Both are env-overridable so test lanes can raise them — the web
// e2e suite registers ~25 fresh users through one shared router in under two
// minutes, which a production-sized 10/min window legitimately rejects.
// Defaults stay production-safe: production .env files simply don't set them.
var (
	AuthRateLimit = envInt("AUTH_RATE_LIMIT", 10)
	// Public username/email availability checks: account-enumeration surface.
	EnumRateLimit = envInt("ENUM_RATE_LIMIT", 30)
)

const (
	AuthRateWindow = time.Minute
	EnumRateWindow = time.Minute

	rateLimitPruneInterval = time.Minute
)

func envInt(name string, fallback int) int {
	if v := os.Getenv(name); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}

type rateWindow struct {
	count   int
	started time.Time
}

type rateLimiter struct {
	mu      sync.Mutex
	entries map[string]*rateWindow
	limit   int
	window  time.Duration
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		entries: make(map[string]*rateWindow),
		limit:   limit,
		window:  window,
	}
	go rl.pruneLoop()
	return rl
}

func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	w, ok := rl.entries[key]
	if !ok || now.Sub(w.started) >= rl.window {
		rl.entries[key] = &rateWindow{count: 1, started: now}
		return true
	}
	if w.count >= rl.limit {
		return false
	}
	w.count++
	return true
}

func (rl *rateLimiter) pruneLoop() {
	ticker := time.NewTicker(rateLimitPruneInterval)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for key, w := range rl.entries {
			if now.Sub(w.started) >= rl.window {
				delete(rl.entries, key)
			}
		}
		rl.mu.Unlock()
	}
}

// RateLimitMiddleware returns a per-IP fixed-window rate limiter. Requests
// over the limit get 429 with a Retry-After header.
func RateLimitMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	rl := newRateLimiter(limit, window)

	return func(c *gin.Context) {
		if !rl.allow(c.ClientIP()) {
			c.Header("Retry-After", strconv.Itoa(int(window.Seconds())))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "too many requests, please try again later",
			})
			return
		}
		c.Next()
	}
}
