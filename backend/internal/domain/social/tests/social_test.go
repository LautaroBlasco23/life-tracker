// social_test.go
//
// Subject:      internal/domain/social services (Follow, Visibility, Profile,
//
//	Subscription) against real PostgreSQL + MongoDB.
//
// Scope:        Follow lifecycle (public → accepted, private → pending, accept,
//
//	reject, unfollow, followers/following lists), visibility rules,
//	public-profile shape/guards, subscription CRUD + cloning.
//
// Out of scope: HTTP contract → social controller tests (not yet written).
//
//	Repository SQL correctness in isolation.
//
// Infrastructure: PostgreSQL + MongoDB (test instances via .env.test).
// Data strategy:  TRUNCATE the social tables + users/auths before each top-level
//
//	test function (follow tests need real user rows). Only tables touched
//	by these tests — never the dev databases on ports 5432/27017.
//
// Parallel-safe:  No — shared single-connection DB, no per-test namespace.
package tests

import (
	"context"
	"fmt"
	"os"
	"testing"

	"life-tracker-backend/internal/config"
	activityModel "life-tracker-backend/internal/domain/activity/model"
	authModel "life-tracker-backend/internal/domain/auth/model"
	routineModel "life-tracker-backend/internal/domain/routine/model"
	"life-tracker-backend/internal/domain/social/dto"
	"life-tracker-backend/internal/domain/social/model"
	"life-tracker-backend/internal/domain/social/service"
	userModel "life-tracker-backend/internal/domain/user/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	testDB        *gorm.DB
	testMongoDB   *mongo.Database
	testMongoKill func()
	cfg           *config.Config
)

func TestMain(m *testing.M) {
	os.Setenv("ENVIRONMENT", "test")
	cfg = config.Load()

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		panic("failed to connect to PostgreSQL: " + err.Error())
	}

	// Follow the note/activity test convention: AutoMigrate the models these
	// tests need. Social tables may not exist in the migration-only schema.
	if err := db.AutoMigrate(
		&userModel.User{},
		&authModel.Auth{},
		&model.Follow{},
		&model.Subscription{},
		&activityModel.Activity{},
		&routineModel.Routine{},
		&routineModel.RoutineActivity{},
	); err != nil {
		panic("failed to migrate models: " + err.Error())
	}
	testDB = db

	ctx := context.Background()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		panic("failed to connect to MongoDB: " + err.Error())
	}
	if err := client.Ping(ctx, nil); err != nil {
		panic("MongoDB not available: " + err.Error())
	}
	testMongoDB = client.Database(cfg.MongoDatabase)
	testMongoKill = func() { _ = client.Disconnect(ctx) }

	code := m.Run()

	testMongoKill()
	os.Exit(code)
}

func cleanSocialTables(t *testing.T) {
	t.Helper()
	for _, table := range []string{
		"follows", "subscriptions", "routine_activities", "routines",
		"activities", "auths", "users",
	} {
		require.NoError(t, testDB.Exec(fmt.Sprintf("TRUNCATE TABLE %s RESTART IDENTITY CASCADE;", table)).Error)
	}
}

// createSocialUser inserts a user + auth row and returns the user ID.
// Usernames/emails must be unique per test — suffix with userID (auto) and a
// caller-provided tag.
func createSocialUser(t *testing.T, privacy string) uint {
	t.Helper()
	user := &userModel.User{
		FirstName:            "Test",
		LastName:             "User",
		ProfilePrivacyStatus: privacy,
	}
	require.NoError(t, testDB.Create(user).Error)

	auth := &authModel.Auth{
		UserID:       user.ID,
		Email:        fmt.Sprintf("user%d_%s@test.local", user.ID, privacy),
		Username:     fmt.Sprintf("user%d_%s", user.ID, privacy),
		PasswordHash: "x",
	}
	require.NoError(t, testDB.Create(auth).Error)
	return user.ID
}

// seeded with: owner (public or private) + public activity owned by owner.
func createPublicActivity(t *testing.T, ownerID uint) *activityModel.Activity {
	t.Helper()
	a := &activityModel.Activity{
		UserID:           ownerID,
		Title:            "Public Run",
		Description:      "Jogging",
		Frequency:        activityModel.FrequencyDaily,
		DayTime:          activityModel.DayTimeMorning,
		CompletionAmount: 1,
		IsActive:         true,
		PrivacyStatus:    activityModel.PrivacyPublic,
	}
	require.NoError(t, testDB.Create(a).Error)
	return a
}

func createPublicRoutine(t *testing.T, ownerID uint, activities []*activityModel.Activity) *routineModel.Routine {
	t.Helper()
	r := &routineModel.Routine{
		UserID:        ownerID,
		Title:         "Morning Routine",
		Description:   "Wake up",
		PrivacyStatus: routineModel.PrivacyPublic,
		Status:        routineModel.StatusActive,
	}
	require.NoError(t, testDB.Create(r).Error)

	for i, a := range activities {
		ra := &routineModel.RoutineActivity{
			RoutineID:  r.ID,
			ActivityID: a.ID,
			Position:   i,
		}
		require.NoError(t, testDB.Create(ra).Error)
	}
	return r
}

func newFollowSvc() *service.FollowService {
	return service.NewFollowService(testDB)
}

func newSubSvc() *service.SubscriptionService {
	return service.NewSubscriptionService(testDB)
}

func newProfileSvc() *service.ProfileService {
	return service.NewProfileService(testDB, testMongoDB)
}

// ============================================================================
// Visibility rules
// ============================================================================

func TestCanViewProfile(t *testing.T) {
	cleanSocialTables(t)

	vis := service.NewVisibilityService(testDB)

	aliceID := createSocialUser(t, "public")
	bobPrivateID := createSocialUser(t, "private")
	carolID := createSocialUser(t, "public") // random third party

	t.Run("viewer_is_owner_always_true", func(t *testing.T) {
		ok, err := vis.CanViewProfile(aliceID, aliceID)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("public_profile_visible_to_anyone", func(t *testing.T) {
		ok, err := vis.CanViewProfile(carolID, aliceID)
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("private_profile_hidden_from_anon_viewer", func(t *testing.T) {
		ok, err := vis.CanViewProfile(carolID, bobPrivateID)
		assert.Error(t, err) // accepted-follow query finds nothing
		assert.False(t, ok)
	})

	t.Run("private_profile_visible_to_accepted_follower", func(t *testing.T) {
		follow := &model.Follow{
			FollowerID: carolID,
			FolloweeID: bobPrivateID,
			Status:     model.FollowStatusAccepted,
		}
		require.NoError(t, testDB.Create(follow).Error)

		ok, err := vis.CanViewProfile(carolID, bobPrivateID)
		require.NoError(t, err)
		assert.True(t, ok)
	})
}

func TestCanViewContent(t *testing.T) {
	cleanSocialTables(t)

	vis := service.NewVisibilityService(testDB)

	aliceID := createSocialUser(t, "public")
	bobPrivateID := createSocialUser(t, "private")
	carolID := createSocialUser(t, "public")

	t.Run("owner_sees_own_content", func(t *testing.T) {
		for _, privacy := range []string{"public", "private", "weird"} {
			ok, err := vis.CanViewContent(aliceID, aliceID, privacy)
			require.NoError(t, err)
			assert.True(t, ok, "privacy=%s", privacy)
		}
	})

	t.Run("private_content_hidden_from_others", func(t *testing.T) {
		ok, err := vis.CanViewContent(carolID, aliceID, "private")
		assert.NoError(t, err)
		assert.False(t, ok)
	})

	t.Run("public_content_on_public_profile_visible", func(t *testing.T) {
		ok, err := vis.CanViewContent(carolID, aliceID, "public")
		require.NoError(t, err)
		assert.True(t, ok)
	})

	t.Run("public_content_on_private_profile_hidden_without_follow", func(t *testing.T) {
		ok, err := vis.CanViewContent(carolID, bobPrivateID, "public")
		assert.Error(t, err)
		assert.False(t, ok)
	})
}

// ============================================================================
// Follow lifecycle
// ============================================================================

func TestFollowLifecyclePublicTarget(t *testing.T) {
	cleanSocialTables(t)

	svc := newFollowSvc()
	aliceID := createSocialUser(t, "public")
	bobID := createSocialUser(t, "public")
	aliceUsername := fmt.Sprintf("user%d_%s", aliceID, "public")
	bobUsername := fmt.Sprintf("user%d_%s", bobID, "public")

	t.Run("follow_public_user_is_immediately_accepted", func(t *testing.T) {
		resp, err := svc.Follow(aliceID, bobUsername)
		require.NoError(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, string(model.FollowStatusAccepted), resp.Status)
	})

	t.Run("followers_list_shows_alice", func(t *testing.T) {
		items, total, err := svc.GetFollowers(bobID, bobUsername, 25, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		require.Len(t, items, 1)
		assert.Equal(t, aliceID, items[0].UserID)
		assert.Equal(t, aliceUsername, items[0].Username)
	})

	t.Run("following_list_shows_bob", func(t *testing.T) {
		items, total, err := svc.GetFollowing(aliceID, aliceUsername, 25, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		assert.Equal(t, bobID, items[0].UserID)
	})

	t.Run("duplicate_follow_is_idempotent", func(t *testing.T) {
		resp, err := svc.Follow(aliceID, bobUsername)
		require.NoError(t, err)
		assert.Equal(t, string(model.FollowStatusAccepted), resp.Status)

		items, total, err := svc.GetFollowers(bobID, bobUsername, 25, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		assert.Len(t, items, 1)
	})

	t.Run("unfollow_removes_relationship", func(t *testing.T) {
		require.NoError(t, svc.Unfollow(aliceID, bobUsername))

		items, total, err := svc.GetFollowers(bobID, bobUsername, 25, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(0), total)
		assert.Empty(t, items)
	})

	t.Run("unfollow_when_not_following_errors", func(t *testing.T) {
		err := svc.Unfollow(aliceID, bobUsername)
		assert.Error(t, err)
	})
}

func TestFollowPrivateTarget(t *testing.T) {
	cleanSocialTables(t)

	svc := newFollowSvc()
	aliceID := createSocialUser(t, "public")
	bobID := createSocialUser(t, "private")
	bobUsername := fmt.Sprintf("user%d_%s", bobID, "private")

	t.Run("follow_private_user_creates_pending_request", func(t *testing.T) {
		resp, err := svc.Follow(aliceID, bobUsername)
		require.NoError(t, err)
		assert.Equal(t, string(model.FollowStatusPending), resp.Status)
	})

	t.Run("pending_request_listed_for_followee", func(t *testing.T) {
		items, err := svc.GetPendingRequests(bobID)
		require.NoError(t, err)
		require.Len(t, items, 1)
		assert.Equal(t, aliceID, items[0].UserID)
	})

	t.Run("pending_follow_does_not_count_as_follower", func(t *testing.T) {
		_, total, err := svc.GetFollowers(bobID, bobUsername, 25, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(0), total)
	})

	t.Run("accept_grants_follower_status", func(t *testing.T) {
		require.NoError(t, svc.AcceptFollow(bobID, aliceID))

		items, total, err := svc.GetFollowers(bobID, bobUsername, 25, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		assert.Equal(t, aliceID, items[0].UserID)
	})

	t.Run("second_user_requests_then_rejects", func(t *testing.T) {
		carolID := createSocialUser(t, "public")
		_, err := svc.Follow(carolID, bobUsername)
		require.NoError(t, err)

		require.NoError(t, svc.RejectFollow(bobID, carolID))

		items, err := svc.GetPendingRequests(bobID)
		require.NoError(t, err)
		assert.Empty(t, items)
	})

	t.Run("accept_nonexistent_request_errors", func(t *testing.T) {
		err := svc.AcceptFollow(bobID, 9999)
		assert.Error(t, err)
	})
}

func TestFollowErrors(t *testing.T) {
	cleanSocialTables(t)

	svc := newFollowSvc()
	aliceID := createSocialUser(t, "public")
	aliceUsername := fmt.Sprintf("user%d_%s", aliceID, "public")

	t.Run("follow_self_rejected", func(t *testing.T) {
		resp, err := svc.Follow(aliceID, aliceUsername)
		assert.Error(t, err)
		assert.Nil(t, resp)
	})

	t.Run("follow_unknown_user_rejected", func(t *testing.T) {
		resp, err := svc.Follow(aliceID, "ghost_user_no_where")
		assert.Error(t, err)
		assert.Nil(t, resp)
	})
}

// ============================================================================
// Profiles
// ============================================================================

func TestGetPublicProfileSelf(t *testing.T) {
	cleanSocialTables(t)

	svc := newProfileSvc()
	aliceID := createSocialUser(t, "public")
	aliceUsername := fmt.Sprintf("user%d_%s", aliceID, "public")

	// Own public content
	_ = createPublicActivity(t, aliceID)

	resp, err := svc.GetPublicProfile(aliceID, aliceUsername)
	require.NoError(t, err)
	require.NotNil(t, resp)

	assert.Equal(t, aliceID, resp.ID)
	assert.Equal(t, aliceUsername, resp.Username)
	assert.Equal(t, "public", resp.ProfilePrivacyStatus)
	assert.Equal(t, "Test", resp.FirstName)
	assert.True(t, resp.CanViewContent)
	assert.Equal(t, int64(0), resp.FollowersCount)
	assert.Equal(t, int64(0), resp.FollowingCount)
	assert.Equal(t, int64(1), resp.PublicActivitiesCount)
	require.Len(t, resp.Activities, 1)
	assert.Equal(t, "Public Run", resp.Activities[0].Title)
	assert.False(t, resp.Activities[0].Subscribed)
}

func TestGetPublicProfilePrivateGuard(t *testing.T) {
	cleanSocialTables(t)

	svc := newProfileSvc()
	aliceID := createSocialUser(t, "public")
	bobID := createSocialUser(t, "private")
	bobUsername := fmt.Sprintf("user%d_%s", bobID, "private")

	_ = createPublicActivity(t, bobID)

	// Non-follower viewer: CanViewProfile errors on the missing accepted
	// follow, and GetPublicProfile propagates it (controller maps it to 404).
	// NOTE: profile_dto.go claims "the shell is always returned" — that
	// comment does not match the implementation.
	resp, err := svc.GetPublicProfile(aliceID, bobUsername)
	assert.Error(t, err)
	assert.Nil(t, resp)

	// Accepted follower: content unlocked, followStatus surfaced on the card.
	require.NoError(t, testDB.Create(&model.Follow{
		FollowerID: aliceID,
		FolloweeID: bobID,
		Status:     model.FollowStatusAccepted,
	}).Error)

	resp, err = svc.GetPublicProfile(aliceID, bobUsername)
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.True(t, resp.CanViewContent)
	assert.Equal(t, string(model.FollowStatusAccepted), resp.FollowStatus)
	assert.True(t, resp.IsFollowing)
	assert.Equal(t, int64(1), resp.PublicActivitiesCount)
}

func TestGetPublicProfileUnknownUser(t *testing.T) {
	cleanSocialTables(t)

	svc := newProfileSvc()
	aliceID := createSocialUser(t, "public")

	resp, err := svc.GetPublicProfile(aliceID, "ghost_user_no_where")
	assert.Error(t, err)
	assert.Nil(t, resp)
}

// ============================================================================
// Subscriptions
// ============================================================================

func TestSubscribeToActivity(t *testing.T) {
	cleanSocialTables(t)

	svc := newSubSvc()
	aliceID := createSocialUser(t, "public")
	bobID := createSocialUser(t, "public")
	alice := createPublicActivity(t, aliceID)

	t.Run("subscribe_clones_activity_for_subscriber", func(t *testing.T) {
		resp, err := svc.Subscribe(bobID, &dto.SubscribeRequest{
			SourceType: "activity",
			SourceID:   alice.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, "activity", resp.SourceType)
		assert.Equal(t, alice.ID, resp.SourceID)

		// Clone exists for bob, is private + active.
		var clone activityModel.Activity
		require.NoError(t, testDB.First(&clone, resp.ClonedID).Error)
		assert.Equal(t, bobID, clone.UserID)
		assert.Equal(t, alice.Title, clone.Title)
		assert.Equal(t, activityModel.PrivacyPrivate, clone.PrivacyStatus)
		assert.True(t, clone.IsActive)
	})

	t.Run("list_my_subscriptions", func(t *testing.T) {
		subs, err := svc.GetMySubscriptions(bobID)
		require.NoError(t, err)
		require.Len(t, subs, 1)
		assert.Equal(t, "activity", subs[0].SourceType)
		assert.Equal(t, alice.ID, subs[0].SourceID)
	})

	t.Run("duplicate_subscribe_returns_existing", func(t *testing.T) {
		resp, err := svc.Subscribe(bobID, &dto.SubscribeRequest{
			SourceType: "activity",
			SourceID:   alice.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, resp)

		subs, err := svc.GetMySubscriptions(bobID)
		require.NoError(t, err)
		assert.Len(t, subs, 1)
	})

	t.Run("unsubscribe_removes_it", func(t *testing.T) {
		subs, err := svc.GetMySubscriptions(bobID)
		require.NoError(t, err)
		require.Len(t, subs, 1)

		require.NoError(t, svc.Unsubscribe(bobID, subs[0].ID))

		subs, err = svc.GetMySubscriptions(bobID)
		require.NoError(t, err)
		assert.Empty(t, subs)
	})
}

func TestSubscribeToRoutine(t *testing.T) {
	cleanSocialTables(t)

	svc := newSubSvc()
	aliceID := createSocialUser(t, "public")
	bobID := createSocialUser(t, "public")

	act1 := createPublicActivity(t, aliceID)
	act2 := createPublicActivity(t, aliceID)
	srcRoutine := createPublicRoutine(t, aliceID, []*activityModel.Activity{act1, act2})

	t.Run("subscribe_clones_routine_and_activities", func(t *testing.T) {
		resp, err := svc.Subscribe(bobID, &dto.SubscribeRequest{
			SourceType: "routine",
			SourceID:   srcRoutine.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, "routine", resp.SourceType)
		assert.Equal(t, srcRoutine.ID, resp.SourceID)

		var cloneRoutine routineModel.Routine
		require.NoError(t, testDB.First(&cloneRoutine, resp.ClonedID).Error)
		assert.Equal(t, bobID, cloneRoutine.UserID)
		assert.Equal(t, srcRoutine.Title, cloneRoutine.Title)
		assert.Equal(t, routineModel.PrivacyPrivate, cloneRoutine.PrivacyStatus)

		var cloneRAs []routineModel.RoutineActivity
		require.NoError(t, testDB.Where("routine_id = ?", cloneRoutine.ID).Order("position ASC").Find(&cloneRAs).Error)
		require.Len(t, cloneRAs, 2)

		for i, ra := range cloneRAs {
			var clone activityModel.Activity
			require.NoError(t, testDB.First(&clone, ra.ActivityID).Error)
			assert.Equal(t, bobID, clone.UserID)
			assert.Equal(t, activityModel.PrivacyPrivate, clone.PrivacyStatus)
			assert.Equal(t, i, ra.Position)
		}
	})

	t.Run("list_mine_and_unsubscribe", func(t *testing.T) {
		subs, err := svc.GetMySubscriptions(bobID)
		require.NoError(t, err)
		require.Len(t, subs, 1)

		require.NoError(t, svc.Unsubscribe(bobID, subs[0].ID))

		subs, err = svc.GetMySubscriptions(bobID)
		require.NoError(t, err)
		assert.Empty(t, subs)
	})
}

func TestSubscribeErrors(t *testing.T) {
	cleanSocialTables(t)

	svc := newSubSvc()
	aliceID := createSocialUser(t, "public")
	_ = createPublicActivity(t, aliceID)

	t.Run("invalid_source_type_rejected", func(t *testing.T) {
		resp, err := svc.Subscribe(aliceID, &dto.SubscribeRequest{
			SourceType: "meditation",
			SourceID:   1,
		})
		assert.Error(t, err)
		assert.Nil(t, resp)
	})

	t.Run("nonexistent_activity_rejected", func(t *testing.T) {
		resp, err := svc.Subscribe(aliceID, &dto.SubscribeRequest{
			SourceType: "activity",
			SourceID:   99999,
		})
		assert.Error(t, err)
		assert.Nil(t, resp)
	})

	t.Run("nonexistent_routine_rejected", func(t *testing.T) {
		resp, err := svc.Subscribe(aliceID, &dto.SubscribeRequest{
			SourceType: "routine",
			SourceID:   99999,
		})
		assert.Error(t, err)
		assert.Nil(t, resp)
	})
}
