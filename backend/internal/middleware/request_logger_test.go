package middleware

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequestLoggerMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var buf bytes.Buffer
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))

	r := gin.New()
	r.Use(RequestIDMiddleware())
	r.Use(RequestLoggerMiddleware())

	r.GET("/hello", func(c *gin.Context) {
		c.Set("userID", uint(7))
		c.Set("email", "user@example.com")
		c.Status(http.StatusOK)
	})
	r.GET("/metrics", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/hello", nil))
	if w.Header().Get("X-Request-ID") == "" {
		t.Fatal("expected X-Request-ID response header")
	}

	// /metrics must be skipped to avoid log noise from scrapes.
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/metrics", nil))

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 1 {
		t.Fatalf("expected 1 log line, got %d: %s", len(lines), buf.String())
	}

	var entry map[string]any
	if err := json.Unmarshal([]byte(lines[0]), &entry); err != nil {
		t.Fatalf("log line is not valid JSON: %v", err)
	}

	for _, key := range []string{"method", "path", "status", "duration_ms", "client_ip", "request_id", "user_id", "email"} {
		if _, ok := entry[key]; !ok {
			t.Errorf("log entry missing key %q: %v", key, entry)
		}
	}
	if entry["msg"] != "http_request" || entry["path"] != "/hello" || entry["status"] != float64(200) {
		t.Errorf("unexpected log entry: %v", entry)
	}
	if entry["user_id"] != float64(7) {
		t.Errorf("expected user_id 7, got %v", entry["user_id"])
	}
}

func TestRecoveryMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var buf bytes.Buffer
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))

	r := gin.New()
	r.Use(RequestIDMiddleware())
	r.Use(RequestLoggerMiddleware())
	r.Use(RecoveryMiddleware())

	r.GET("/boom", func(c *gin.Context) {
		panic("kaboom")
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/boom", nil))

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}

	var panicLogged, requestLogged bool
	for _, line := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
		if strings.Contains(line, `"panic recovered"`) {
			panicLogged = true
		}
		if strings.Contains(line, `"http_request"`) && strings.Contains(line, `"status":500`) {
			requestLogged = true
		}
	}
	if !panicLogged {
		t.Error("expected panic log line")
	}
	if !requestLogged {
		t.Error("expected access log line for panicked request")
	}
}
