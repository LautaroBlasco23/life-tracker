package logging

import (
	"log/slog"
	"os"
	"strings"
)

// Setup configures the process-wide slog default handler as structured JSON on
// stdout so container logs are machine-parseable for Loki/Grafana.
func Setup() {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLevel(os.Getenv("LOG_LEVEL")),
	})
	slog.SetDefault(slog.New(handler))
}

func parseLevel(raw string) slog.Level {
	switch strings.ToLower(raw) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
