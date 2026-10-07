package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// Subject: internal/middleware/rate_limit.go — RateLimitMiddleware

func TestRateLimitMiddleware_AllowsRequestsUnderLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/ping", RateLimitMiddleware(3, time.Minute), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ping", nil))
		if w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i+1, w.Code)
		}
	}
}

func TestRateLimitMiddleware_BlocksRequestsOverLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/ping", RateLimitMiddleware(2, time.Minute), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ping", nil))
		if w.Code != http.StatusOK {
			t.Fatalf("request %d under limit: expected 200, got %d", i+1, w.Code)
		}
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ping", nil))
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("request over limit: expected 429, got %d", w.Code)
	}
	if w.Header().Get("Retry-After") != "60" {
		t.Fatalf("expected Retry-After 60, got %q", w.Header().Get("Retry-After"))
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("429 body is not JSON: %v", err)
	}
	if body["error"] == "" {
		t.Fatal("429 body must include an error message")
	}
}

func TestRateLimitMiddleware_WindowReset(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/ping", RateLimitMiddleware(1, 20*time.Millisecond), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ping", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("first request: expected 200, got %d", w.Code)
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ping", nil))
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("second request within window: expected 429, got %d", w.Code)
	}

	time.Sleep(30 * time.Millisecond)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ping", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("request after window reset: expected 200, got %d", w.Code)
	}
}
