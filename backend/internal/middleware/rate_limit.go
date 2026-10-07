package middleware

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// In-memory fixed-window rate limiter keyed by client IP. Intentionally
// dependency-free and per-instance: it protects the public auth/enumeration
// endpoints of a single API replica. If the API ever runs multiple replicas
// behind a load balancer, replace with a shared-store limiter (e.g. Redis).

const (
	// Auth routes (login/register/refresh): brute-force and credential-stuffing target.
	AuthRateLimit  = 10
	AuthRateWindow = time.Minute
	// Public username/email availability checks: account-enumeration surface.
	EnumRateLimit  = 30
	EnumRateWindow = time.Minute

	rateLimitPruneInterval = time.Minute
)

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
