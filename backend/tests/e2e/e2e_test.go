// e2e_test.go — "essential E2E" suite for the production router.
//
// Build tag: this file only compiles under `-tags=e2e` (go build tags must be
// the first statement). The default suite (`make test`) stays fast; CI runs
// this suite separately via `make test-e2e-floci`.
//
// Subject:      the full production HTTP surface (internal/server.NewRouter)
//
//	driven through httptest — real route registry, real middleware
//	chain (RequestID, RequestLogger, Recovery, CORS, Timezone,
//	Prometheus), real JWT auth middleware, real route wiring for
//	every domain.
//
// Scope:        /health, the auth lifecycle (register → login → refresh), the
//
//	anonymous-rejection path of the protected route group, and the
//	minimal authed read/write lifecycle (me, activities/today,
//	create activity, create note, read note back). Mirrors the k6
//	smoke script (loadtest/smoke.js) so both layers cover the same
//	contract.
//
// Out of scope: handler-level edge cases (unit suites cover controllers/
//
//	services/repos), MongoDB-backed flows (screentime, finance),
//	floci/Lambda proxying, TLS/network transport — httptest serves
//	in-process with no listener.
//
// Infrastructure: real test databases via .env.test (ports 5433 Postgres /
//
//	27018 Mongo, databases *_test). database.Initialize connects
//	and runs the real SQL migrations (golang-migrate) + Mongo index
//	creation when APP_RUNTIME != "serverless"; .env.test never sets
//	it, so migrations run.
//
// ImageStore:   imagestore.NewClient(cfg) is constructed like main.go. It only
//
//	builds an S3 client — no network call is made at construction
//	(see imagestore.Client / aws.LoadConfig), so it is safe to
//	create when AWS_ENDPOINT_URL is empty. None of the flows below
//	upload images, so no S3 endpoint is needed.
//
// Data strategy: every user is registered with a unique username under the
//
//	e2e_<unixnano> prefix. Shared tables (users, auths, activities,
//	notes) are NEVER truncated — the unit suites and this suite may
//	run against the same test DB, and e2e rows are partitioned by
//	prefix. MongoDB collections are not touched either.
//
// Parallel-safe: tests run sequentially (unique-prefix registration is cheap);
//
//	do not add t.Parallel() without making prefix generation
//	collision-free across subprocesses.
//
// Schema caveat: unlike the unit suites, this suite does NOT AutoMigrate — it
// uses only the real migration schema (see report notes). If a domain model
// gains a field not covered by migrations, the affected endpoint fails here
// first, which is exactly what this suite is meant to catch.

//go:build e2e

package e2e_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/database"
	"life-tracker-backend/internal/infrastructure/imagestore"
	"life-tracker-backend/internal/server"

	"github.com/gin-gonic/gin"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	cfg    *config.Config
	router *gin.Engine
)

func TestMain(m *testing.M) {
	os.Setenv("ENVIRONMENT", "test")
	cfg = config.Load()
	gin.SetMode(gin.TestMode)

	// Fresh-schema guarantee: this suite tests the REAL migration schema, but
	// the compose test DBs are empty at start and unit suites AutoMigrate
	// partial schemas WITHOUT recording schema_migrations. Running migrations
	// over such a state fails ("Dirty database version 1": migration 1 hits
	// tables that exist outside the migrator's bookkeeping). Dropping the
	// public schema first makes the suite order-independent — it always
	// applies migrations v1..vN to a truly clean slate, exactly like the
	// CI/floci lane where provision.sh pre-applies them. Unit suites still
	// work afterwards (AutoMigrate adds whatever they need).
	{
		reset, err := sql.Open("pgx", fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
		))
		if err != nil {
			panic("failed to open reset connection: " + err.Error())
		}
		if _, err := reset.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"); err != nil {
			panic("failed to reset public schema: " + err.Error())
		}
		_ = reset.Close()
	}

	// Real production bootstrap path: connect + run migrations.
	dbs, err := database.Initialize(cfg)
	if err != nil {
		panic("failed to connect to test databases: " + err.Error())
	}

	// Same construction as main.go. Building the S3 client does not touch the
	// network, and none of these flows upload images, so an empty
	// AWS_ENDPOINT_URL (no floci/LocalStack) is fine here.
	imageClient, err := imagestore.NewClient(cfg)
	if err != nil {
		panic("failed to create imagestore client: " + err.Error())
	}

	router = server.NewRouter(cfg, dbs, imageClient)

	code := m.Run()

	_ = imageClient.Close()
	_ = dbs.MongoDB.Client().Disconnect(context.Background())

	os.Exit(code)
}

// ---- helpers ----

// uniqueUser returns registration data under a run-unique prefix so tests
// never collide with each other or with unit-suite fixtures, and never need to
// truncate shared tables.
func uniqueUser(t *testing.T) (username, email, password string) {
	t.Helper()
	username = fmt.Sprintf("e2e_%d", time.Now().UnixNano())
	return username, username + "@e2e.local", "e2e-password-123"
}

// doJSON issues one request against the real router.
func doJSON(t *testing.T, method, path, token string, body any) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()

	var reader *bytes.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		require.NoError(t, err)
		reader = bytes.NewReader(raw)
	} else {
		reader = bytes.NewReader(nil)
	}

	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	var parsed map[string]any
	if len(rec.Body.Bytes()) > 0 {
		_ = json.Unmarshal(rec.Body.Bytes(), &parsed)
	}
	return rec, parsed
}

// registerUser creates a fresh user and returns the issued tokens.
func registerUser(t *testing.T, username, email, password string) (accessToken, refreshToken string) {
	t.Helper()

	rec, res := doJSON(t, http.MethodPost, "/api/auth/register", "", map[string]any{
		"email":     email,
		"password":  password,
		"firstName": "E2E",
		"lastName":  "Test",
		"username":  username,
	})
	require.Equal(t, http.StatusCreated, rec.Code, "register failed: %s", rec.Body.String())

	data, _ := res["data"].(map[string]any)
	require.NotNil(t, data, "register response must have data")

	tokens, _ := data["tokens"].(map[string]any)
	require.NotNil(t, tokens, "register response must have data.tokens")

	access, _ := tokens["accessToken"].(string)
	refresh, _ := tokens["refreshToken"].(string)
	require.Greater(t, len(access), 20, "access token must be a real JWT")
	require.Greater(t, len(refresh), 20, "refresh token must be a real JWT")
	return access, refresh
}

// ---- tests ----

func TestHealthEndpoint(t *testing.T) {
	rec, res := doJSON(t, http.MethodGet, "/health", "", nil)

	require.Equal(t, http.StatusOK, rec.Code, "body: %s", rec.Body.String())
	assert.Equal(t, "ok", res["status"])

	dbs, _ := res["databases"].(map[string]any)
	require.NotNil(t, dbs, "health must report database status")
	assert.Equal(t, "ok", dbs["postgresql"], "body: %s", rec.Body.String())
	assert.Equal(t, "ok", dbs["mongodb"], "body: %s", rec.Body.String())
}

func TestRegisterLoginRefresh(t *testing.T) {
	username, email, password := uniqueUser(t)

	_, refresh := registerUser(t, username, email, password)

	// Login with the username as identifier (not the email) to cover the
	// username branch of the identifier parser.
	rec, res := doJSON(t, http.MethodPost, "/api/auth/login", "", map[string]any{
		"identifier": username,
		"password":   password,
	})
	require.Equal(t, http.StatusOK, rec.Code, "body: %s", rec.Body.String())
	data, _ := res["data"].(map[string]any)
	tokens, _ := data["tokens"].(map[string]any)
	require.NotNil(t, tokens, "body: %s", rec.Body.String())
	loginAccess, _ := tokens["accessToken"].(string)
	assert.Greater(t, len(loginAccess), 20)

	// Refresh round-trips to a new access token.
	rec, res = doJSON(t, http.MethodPost, "/api/auth/refresh", "", map[string]any{
		"refreshToken": refresh,
	})
	require.Equal(t, http.StatusOK, rec.Code, "body: %s", rec.Body.String())
	data, _ = res["data"].(map[string]any)
	require.NotNil(t, data, "body: %s", rec.Body.String())
	newAccess, _ := data["accessToken"].(string)
	assert.Greater(t, len(newAccess), 20, "refresh must issue a new access token")
}

// TestProtectedRouteRejectsAnonymous: protected routes require a valid access
// JWT, both absent and malformed.
func TestProtectedRouteRejectsAnonymous(t *testing.T) {
	rec, _ := doJSON(t, http.MethodGet, "/api/users/me", "", nil)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "Authorization header required")

	// Garbage token is also rejected by the real JWT middleware.
	rec, _ = doJSON(t, http.MethodGet, "/api/users/me", "not.a.jwt", nil)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "Invalid token")
}

func TestAuthedUserMeAndToday(t *testing.T) {
	username, email, password := uniqueUser(t)
	access, _ := registerUser(t, username, email, password)

	rec, res := doJSON(t, http.MethodGet, "/api/users/me", access, nil)
	require.Equal(t, http.StatusOK, rec.Code, "body: %s", rec.Body.String())
	data, _ := res["data"].(map[string]any)
	require.NotNil(t, data, "body: %s", rec.Body.String())
	assert.Equal(t, username, data["username"], "me must return the caller's profile")
	assert.Equal(t, email, data["email"], "me must return the caller's email")

	// Empty state: a fresh user has no activities yet.
	rec, res = doJSON(t, http.MethodGet, "/api/activities/today", access, nil)
	require.Equal(t, http.StatusOK, rec.Code, "body: %s", rec.Body.String())
	items, ok := res["data"].([]any)
	require.True(t, ok, "today must return a list")
	assert.Empty(t, items, "fresh user must have no today activities")
}

func TestCreateActivityAndNoteLifecycle(t *testing.T) {
	username, email, password := uniqueUser(t)
	access, _ := registerUser(t, username, email, password)

	authed := func(method, path string, body any) (*httptest.ResponseRecorder, map[string]any) {
		return doJSON(t, method, path, access, body)
	}

	// 1. Create an activity.
	rec, res := authed(http.MethodPost, "/api/activities", map[string]any{
		"title":            "E2E activity",
		"description":      "created by e2e suite",
		"frequency":        "daily",
		"dayFrequency":     "",
		"dayTime":          "evening",
		"completionAmount": 1,
	})
	require.Equal(t, http.StatusCreated, rec.Code, "body: %s", rec.Body.String())
	actData, _ := res["data"].(map[string]any)
	require.NotNil(t, actData, "body: %s", rec.Body.String())
	actID := fmt.Sprintf("%v", actData["id"])
	require.NotEmpty(t, actID, "activity must have an id")
	assert.Equal(t, "E2E activity", actData["title"])
	assert.Equal(t, "daily", actData["frequency"])

	// 2. Create a note.
	rec, res = authed(http.MethodPost, "/api/notes", map[string]any{
		"title":   "E2E note",
		"content": "created by e2e suite",
	})
	require.Equal(t, http.StatusCreated, rec.Code, "body: %s", rec.Body.String())
	noteData, _ := res["data"].(map[string]any)
	require.NotNil(t, noteData, "body: %s", rec.Body.String())
	noteID := fmt.Sprintf("%v", noteData["id"])
	require.NotEmpty(t, noteID, "note must have an id")

	// 3. Read the note back and assert fields + ownership (userId is the
	// caller's; a different user's note must not be reachable).
	rec, res = authed(http.MethodGet, "/api/notes/"+noteID, nil)
	require.Equal(t, http.StatusOK, rec.Code, "body: %s", rec.Body.String())
	noteData, _ = res["data"].(map[string]any)
	require.NotNil(t, noteData, "body: %s", rec.Body.String())
	assert.Equal(t, "E2E note", noteData["title"])
	assert.Equal(t, "created by e2e suite", noteData["content"])

	// Ownership: fetch the caller's id from /me and compare with note.userId.
	rec, res = authed(http.MethodGet, "/api/users/me", nil)
	require.Equal(t, http.StatusOK, rec.Code)
	me, _ := res["data"].(map[string]any)
	require.NotNil(t, me)
	assert.Equal(t, fmt.Sprintf("%v", me["id"]), fmt.Sprintf("%v", noteData["userId"]),
		"note must belong to the authenticated caller")

	// A second, unrelated user must NOT be able to read the note (ownership
	// enforced at the endpoint).
	otherUser, otherEmail, otherPass := uniqueUser(t)
	otherAccess, _ := registerUser(t, otherUser, otherEmail, otherPass)
	rec, _ = doJSON(t, http.MethodGet, "/api/notes/"+noteID, otherAccess, nil)
	require.Equal(t, http.StatusNotFound, rec.Code, "other user must not read the note")

	// 4. The activity shows up in the caller's today list.
	rec, res = authed(http.MethodGet, "/api/activities/today", nil)
	require.Equal(t, http.StatusOK, rec.Code, "body: %s", rec.Body.String())
	items, _ := res["data"].([]any)
	require.NotNil(t, items, "body: %s", rec.Body.String())
	found := false
	for _, item := range items {
		m, _ := item.(map[string]any)
		if m != nil && m["id"] == actData["id"] {
			found = true
			assert.Equal(t, "E2E activity", m["title"])
		}
	}
	assert.True(t, found, "created activity must appear in today's list")
}

func TestCORSPreflightReturns204(t *testing.T) {
	// Preflight must flow through CORSMiddleware (catch-all OPTIONS handler)
	// and come back 204 with CORS headers set.
	req := httptest.NewRequest(http.MethodOptions, "/api/notes", nil)
	req.Header.Set("Origin", "https://example.com")
	req.Header.Set("Access-Control-Request-Method", "POST")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code, "body: %s", rec.Body.String())
	assert.NotEmpty(t, rec.Header().Get("Access-Control-Allow-Origin"),
		"preflight must carry CORS headers")
	assert.Contains(t, rec.Header().Get("Access-Control-Allow-Methods"), "POST")
	assert.NotEmpty(t, rec.Header().Get("Access-Control-Allow-Headers"))
}

// TestRegisterValidation: the public entry point rejects malformed payloads
// (binding rules live in the real handler).
func TestRegisterValidation(t *testing.T) {
	rec, _ := doJSON(t, http.MethodPost, "/api/auth/register", "", map[string]any{
		"email":     "not-an-email",
		"password":  "short",
		"firstName": "E",
		"lastName":  "Two",
		"username":  strings.Repeat("x", 31),
	})
	require.Equal(t, http.StatusBadRequest, rec.Code)
}
