// route_contract_test.go — keeps backend/endpoints/service.json in sync with
// the routes actually registered on the production router. service.json is
// uploaded as a release artifact (backend-ci build-push), so drift here means
// the published artifact misdocuments the API. Fails in both directions:
// registered-but-undocumented routes and documented-but-unregistered entries.
//
// Path comparison is shape-based: dynamic segments (`:id`, `{username}`,
// `{followerId}`) normalize to `{param}` so the check validates path shape,
// not parameter naming. Non-/api routes (health, metrics) are outside the
// contract.

//go:build e2e

package e2e_test

import (
	"encoding/json"
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func normalizeSegment(seg string) string {
	if strings.HasPrefix(seg, ":") ||
		(strings.HasPrefix(seg, "{") && strings.HasSuffix(seg, "}")) {
		return "{param}"
	}
	return seg
}

func normalizeAPIPath(p string) string {
	segs := strings.Split(strings.Trim(p, "/"), "/")
	for i := range segs {
		segs[i] = normalizeSegment(segs[i])
	}
	return "/" + strings.Join(segs, "/")
}

func TestServiceJSONMatchesRegisteredRoutes(t *testing.T) {
	raw, err := os.ReadFile("../../endpoints/service.json")
	require.NoError(t, err, "service.json must exist next to the other endpoint docs")

	var doc struct {
		Routes []string `json:"routes"`
	}
	require.NoError(t, json.Unmarshal(raw, &doc))

	registered := map[string]bool{}
	for _, ri := range router.Routes() {
		if strings.HasPrefix(ri.Path, "/api/") {
			registered[normalizeAPIPath(ri.Path)] = true
		}
	}

	declared := map[string]bool{}
	for _, r := range doc.Routes {
		if strings.HasPrefix(r, "/api/") {
			declared[normalizeAPIPath(r)] = true
		}
	}

	var missing, stale []string
	for p := range registered {
		if !declared[p] {
			missing = append(missing, p)
		}
	}
	for p := range declared {
		if !registered[p] {
			stale = append(stale, p)
		}
	}
	sort.Strings(missing)
	sort.Strings(stale)
	assert.Empty(t, missing,
		"routes registered on the production router but absent from service.json — add them")
	assert.Empty(t, stale,
		"service.json entries with no matching registered route — remove or fix them")
}
