// user_service_extra_test.go
//
// Subject:      internal/domain/user/service.UserService — handlers not
//
//	exercised by user_service_test.go (onboarding, username
//	lookup, search follow-status enrichment, username update
//	validation, availability helpers).
//
// Scope:        CompleteOnboarding idempotency, GetUserByUsername success and
//
//	not-found, SearchUsers follow-status enrichment, username
//	format/taken validation on UpdateProfile, UsernameExists /
//	EmailExists.
//
// Out of scope: Image upload flows (need the imagestore client) → integration
//
//	lane; HTTP contract → user_controller_*_test.go.
//
// Infrastructure: PostgreSQL (test database via .env.test).
// Data strategy:  TRUNCATE users + auths + follows before each top-level test.
// Parallel-safe:  No — single shared DB connection, no per-test namespace.
package service

import (
	"testing"

	socialModel "life-tracker-backend/internal/domain/social/model"
	"life-tracker-backend/internal/domain/user/dto"
	"life-tracker-backend/internal/domain/user/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func cleanFollows(t *testing.T) {
	t.Helper()
	require.NoError(t, testDB.Exec("TRUNCATE TABLE follows RESTART IDENTITY CASCADE").Error)
}

func TestUserService_CompleteOnboarding(t *testing.T) {
	service := getTestService(t)

	t.Run("sets the timestamp once and is idempotent", func(t *testing.T) {
		userID := createTestUser(t, service)
		createTestAuth(t, userID, "onboarding@example.com", "onboarder")

		first, err := service.CompleteOnboarding(userID)
		require.NoError(t, err)
		assert.True(t, first.OnboardingCompleted)

		var stored model.User
		require.NoError(t, testDB.First(&stored, userID).Error)
		require.NotNil(t, stored.OnboardingCompletedAt)
		firstSeen := *stored.OnboardingCompletedAt

		second, err := service.CompleteOnboarding(userID)
		require.NoError(t, err)
		assert.True(t, second.OnboardingCompleted)

		var reloaded model.User
		require.NoError(t, testDB.First(&reloaded, userID).Error)
		require.NotNil(t, reloaded.OnboardingCompletedAt)
		assert.True(t, reloaded.OnboardingCompletedAt.Equal(firstSeen),
			"second call must keep the original timestamp")
	})

	t.Run("unknown user returns error", func(t *testing.T) {
		_, err := service.CompleteOnboarding(9999)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "user not found")
	})
}

func TestUserService_GetUserByUsername(t *testing.T) {
	service := getTestService(t)

	t.Run("returns the user for an existing username", func(t *testing.T) {
		userID := createTestUser(t, service)
		createTestAuth(t, userID, "named@example.com", "byname")

		user, err := service.GetUserByUsername("byname")
		require.NoError(t, err)
		assert.Equal(t, userID, user.ID)
		assert.Equal(t, "named@example.com", user.Email)
		assert.Equal(t, "byname", user.Username)
	})

	t.Run("case-insensitive lookup", func(t *testing.T) {
		userID := createTestUser(t, service)
		createTestAuth(t, userID, "upper@example.com", "upperuser")

		user, err := service.GetUserByUsername("UPPERUSER")
		require.NoError(t, err)
		assert.Equal(t, userID, user.ID)
	})

	t.Run("unknown username returns error", func(t *testing.T) {
		_, err := service.GetUserByUsername("ghost")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "user not found")
	})
}

func TestUserService_SearchUsers_FollowStatusEnrichment(t *testing.T) {
	service := getTestService(t)
	cleanFollows(t)

	viewerID := createTestUser(t, service)
	createTestAuth(t, viewerID, "viewer@example.com", "viewer")

	targetID := createTestUser(t, service)
	createTestAuth(t, targetID, "target@example.com", "target")

	accepted := socialModel.Follow{
		FollowerID: viewerID,
		FolloweeID: targetID,
		Status:     socialModel.FollowStatusAccepted,
	}
	require.NoError(t, testDB.Create(&accepted).Error)

	otherID := createTestUser(t, service)
	createTestAuth(t, otherID, "other@example.com", "other")

	cards, err := service.SearchUsers(viewerID, "", 20)
	require.NoError(t, err)
	require.Len(t, cards, 2)

	byUsername := map[string]dto.PublicUserCard{}
	for _, card := range cards {
		byUsername[card.Username] = card
	}
	target := byUsername["target"]
	assert.Equal(t, "accepted", target.FollowStatus)
	assert.True(t, target.IsFollowing)

	other := byUsername["other"]
	assert.Equal(t, "none", other.FollowStatus)
	assert.False(t, other.IsFollowing)
}

func TestUserService_UpdateProfile_UsernameValidation(t *testing.T) {
	service := getTestService(t)

	t.Run("valid username change is applied lowercased", func(t *testing.T) {
		userID := createTestUser(t, service)
		createTestAuth(t, userID, "rename@example.com", "oldname")

		newUsername := "NewName"
		profile, err := service.UpdateProfile(userID, "rename@example.com", "oldname",
			&dto.UpdateUserRequest{Username: &newUsername})
		require.NoError(t, err)
		assert.Equal(t, "newname", profile.Username)
	})

	t.Run("rejects invalid format", func(t *testing.T) {
		userID := createTestUser(t, service)
		createTestAuth(t, userID, "badformat@example.com", "baduser")

		invalid := "no spaces allowed!"
		_, err := service.UpdateProfile(userID, "badformat@example.com", "baduser",
			&dto.UpdateUserRequest{Username: &invalid})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "username must be 3-30 characters")
	})

	t.Run("rejects taken username", func(t *testing.T) {
		userID := createTestUser(t, service)
		createTestAuth(t, userID, "changer@example.com", "changer")

		otherID := createTestUser(t, service)
		createTestAuth(t, otherID, "squatter@example.com", "squatter")

		taken := "squatter"
		_, err := service.UpdateProfile(userID, "changer@example.com", "changer",
			&dto.UpdateUserRequest{Username: &taken})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "username")
	})

	t.Run("same username is a no-op", func(t *testing.T) {
		userID := createTestUser(t, service)
		createTestAuth(t, userID, "same@example.com", "samesame")

		same := "samesame"
		profile, err := service.UpdateProfile(userID, "same@example.com", "samesame",
			&dto.UpdateUserRequest{Username: &same})
		require.NoError(t, err)
		assert.Equal(t, "samesame", profile.Username)
	})
}

func TestUserService_UsernameAndEmailExists(t *testing.T) {
	service := getTestService(t)

	userID := createTestUser(t, service)
	createTestAuth(t, userID, "exists@example.com", "exists")

	t.Run("username exists", func(t *testing.T) {
		exists, err := service.UsernameExists("exists")
		require.NoError(t, err)
		assert.True(t, exists)

		exists, err = service.UsernameExists("ghost")
		require.NoError(t, err)
		assert.False(t, exists)
	})

	t.Run("email exists", func(t *testing.T) {
		exists, err := service.EmailExists("exists@example.com")
		require.NoError(t, err)
		assert.True(t, exists)

		exists, err = service.EmailExists("ghost@example.com")
		require.NoError(t, err)
		assert.False(t, exists)
	})
}
