package service

import (
	"context"
	"errors"
	"strconv"
	"time"

	activityModel "life-tracker-backend/internal/domain/activity/model"
	activityRepo "life-tracker-backend/internal/domain/activity/repository"
	"life-tracker-backend/internal/domain/activity/streak"
	authRepo "life-tracker-backend/internal/domain/auth/repository"
	routineDTO "life-tracker-backend/internal/domain/routine/dto"
	routineModel "life-tracker-backend/internal/domain/routine/model"
	routineRepo "life-tracker-backend/internal/domain/routine/repository"
	"life-tracker-backend/internal/domain/social/dto"
	"life-tracker-backend/internal/domain/social/model"
	"life-tracker-backend/internal/domain/social/repository"
	userDTO "life-tracker-backend/internal/domain/user/dto"
	userModel "life-tracker-backend/internal/domain/user/model"
	userRepo "life-tracker-backend/internal/domain/user/repository"

	"go.mongodb.org/mongo-driver/mongo"
	"gorm.io/gorm"
)

type ProfileService struct {
	db           *gorm.DB
	userRepo     userRepo.UserRepository
	authRepo     authRepo.AuthRepository
	followRepo   repository.FollowRepository
	subRepo      repository.SubscriptionRepository
	routineRepo  routineRepo.RoutineRepository
	activityRepo activityRepo.ActivityRepository
	recordRepo   activityRepo.ActivityRecordRepository
	visibility   *VisibilityService
}

func NewProfileService(db *gorm.DB, mongoDB *mongo.Database) *ProfileService {
	return &ProfileService{
		db:           db,
		userRepo:     userRepo.NewUserRepository(db),
		authRepo:     authRepo.NewAuthRepository(db),
		followRepo:   repository.NewFollowRepository(db),
		subRepo:      repository.NewSubscriptionRepository(db),
		routineRepo:  routineRepo.NewRoutineRepository(db),
		activityRepo: activityRepo.NewActivityRepository(db),
		recordRepo:   activityRepo.NewActivityRecordRepository(mongoDB),
		visibility:   NewVisibilityService(db),
	}
}

// resolveProfileTarget loads the profile target (auth + user rows) and the
// viewer's visibility verdict, and builds the profile card shell.
func (s *ProfileService) resolveProfileTarget(viewerID uint, username string) (*userModel.User, string, userDTO.PublicUserCard, bool, error) {
	targetAuth, err := s.authRepo.FindByUsername(username)
	if err != nil {
		if errors.Is(err, authRepo.ErrAuthNotFound) {
			return nil, "", userDTO.PublicUserCard{}, false, errors.New("user not found")
		}
		return nil, "", userDTO.PublicUserCard{}, false, errors.New("failed to find user")
	}

	target, err := s.userRepo.FindByID(targetAuth.UserID)
	if err != nil {
		return nil, "", userDTO.PublicUserCard{}, false, errors.New("user not found")
	}

	canView, err := s.visibility.CanViewProfile(viewerID, target.ID)
	if err != nil {
		return nil, "", userDTO.PublicUserCard{}, false, errors.New("failed to check profile visibility")
	}

	card := userDTO.PublicUserCard{
		ID:                   target.ID,
		FirstName:            target.FirstName,
		LastName:             target.LastName,
		Username:             targetAuth.Username,
		ProfilePicURL:        target.ProfilePicURL,
		ProfilePrivacyStatus: target.ProfilePrivacyStatus,
	}
	return target, targetAuth.Username, card, canView, nil
}

// decorateFollowStatus sets FollowStatus/IsFollowing on the card for viewers
// who are not the profile owner.
func (s *ProfileService) decorateFollowStatus(viewerID uint, target *userModel.User, card *userDTO.PublicUserCard) error {
	if viewerID == target.ID {
		return nil
	}
	existing, err := s.followRepo.FindFollow(viewerID, target.ID)
	if err != nil && !errors.Is(err, repository.ErrFollowNotFound) {
		return errors.New("failed to load follow status")
	}
	if existing != nil {
		card.FollowStatus = string(existing.Status)
		card.IsFollowing = existing.Status == model.FollowStatusAccepted
	}
	return nil
}

// ownerLocation resolves the streak computation timezone: the owner's
// configured timezone, or UTC when unset/invalid.
func ownerLocation(target *userModel.User) *time.Location {
	if target.Timezone != nil && *target.Timezone != "" {
		if loc, err := time.LoadLocation(*target.Timezone); err == nil {
			return loc
		}
	}
	return time.UTC
}

// viewerSubscriptionMap maps "sourceType:sourceID" keys the viewer is
// subscribed to, so content cards can be flagged. Empty when the viewer IS
// the owner (self-profiles never show subscribe flags).
func (s *ProfileService) viewerSubscriptionMap(viewerID, targetID uint) map[string]bool {
	subscribed := make(map[string]bool)
	if viewerID == targetID {
		return subscribed
	}
	subs, err := s.subRepo.FindBySubscriber(viewerID)
	if err != nil {
		return subscribed
	}
	for _, sub := range subs {
		subscribed[sourceKey(sub.SourceType, sub.SourceID)] = true
	}
	return subscribed
}

// buildRoutineCards renders public routines with streaks + subscribe flags.
func (s *ProfileService) buildRoutineCards(routines []routineModel.Routine, routineActivityItems map[uint][]routineDTO.RoutineActivityItem, daily map[uint]map[string]int, ownerLoc *time.Location, subscribed map[string]bool) []dto.PublicRoutineCard {
	routineCards := make([]dto.PublicRoutineCard, 0, len(routines))
	for _, r := range routines {
		items := routineActivityItems[r.ID]
		inputs := make([]streak.Input, 0, len(items))
		for _, it := range items {
			inputs = append(inputs, streak.Input{
				ActivityID:       it.ActivityID,
				Frequency:        activityModel.Frequency(it.Frequency),
				DayFrequency:     streak.ParseDayFrequency(it.DayFrequency),
				CompletionAmount: it.CompletionAmount,
			})
		}
		sInfo := streak.Compute(daily, inputs, ownerLoc, streak.DefaultWindowDays)
		routineCards = append(routineCards, dto.PublicRoutineCard{
			ID:          r.ID,
			Title:       r.Title,
			Description: r.Description,
			Streak:      &sInfo,
			Activities:  items,
			Subscribed:  subscribed[sourceKey(model.SourceTypeRoutine, r.ID)],
		})
	}
	return routineCards
}

// buildActivityCards renders standalone public activities (not part of a
// public routine) with streaks + subscribe flags.
func (s *ProfileService) buildActivityCards(standalone []activityModel.Activity, daily map[uint]map[string]int, ownerLoc *time.Location, subscribed map[string]bool) []dto.PublicActivityCard {
	activityCards := make([]dto.PublicActivityCard, 0, len(standalone))
	for i := range standalone {
		a := &standalone[i]
		sInfo := streak.Compute(daily, []streak.Input{{
			ActivityID:       a.ID,
			Frequency:        a.Frequency,
			DayFrequency:     streak.ParseDayFrequency(a.DayFrequency),
			CompletionAmount: a.CompletionAmount,
		}}, ownerLoc, streak.DefaultWindowDays)
		activityCards = append(activityCards, dto.PublicActivityCard{
			ID:               a.ID,
			Title:            a.Title,
			Description:      a.Description,
			Frequency:        string(a.Frequency),
			DayFrequency:     a.DayFrequency,
			DayTime:          string(a.DayTime),
			CompletionAmount: a.CompletionAmount,
			Streak:           &sInfo,
			Subscribed:       subscribed[sourceKey(model.SourceTypeActivity, a.ID)],
		})
	}
	return activityCards
}

// profileContent loads and renders the visible content of the profile:
// public routines (+ activities), standalone public activities, streak counts.
func (s *ProfileService) profileContent(target *userModel.User, ownerLoc *time.Location, subscribed map[string]bool) ([]routineModel.Routine, map[uint][]routineDTO.RoutineActivityItem, []activityModel.Activity, map[uint]map[string]int, error) {
	routines, err := s.routineRepo.FindPublicByUserID(target.ID)
	if err != nil {
		return nil, nil, nil, nil, errors.New("failed to fetch routines")
	}

	routineActivityIDs := make(map[uint]bool)
	routineActivityItems := make(map[uint][]routineDTO.RoutineActivityItem, len(routines))
	for _, r := range routines {
		items := s.fetchRoutineActivities(r.ID)
		routineActivityItems[r.ID] = items
		for _, it := range items {
			routineActivityIDs[it.ActivityID] = true
		}
	}

	// Standalone public activities: public activities not already inside a
	// public routine (avoid showing the same activity twice).
	publicActivities, err := s.activityRepo.FindPublicByUserID(target.ID)
	if err != nil {
		return nil, nil, nil, nil, errors.New("failed to fetch activities")
	}
	var standalone []activityModel.Activity
	for i := range publicActivities {
		if !routineActivityIDs[publicActivities[i].ID] {
			standalone = append(standalone, publicActivities[i])
		}
	}

	allIDs := make([]uint, 0, len(routineActivityIDs)+len(standalone))
	for id := range routineActivityIDs {
		allIDs = append(allIDs, id)
	}
	for i := range standalone {
		allIDs = append(allIDs, standalone[i].ID)
	}

	daily := map[uint]map[string]int{}
	if len(allIDs) > 0 {
		from, to := streak.Window(ownerLoc, streak.DefaultWindowDays)
		daily, err = s.recordRepo.GetDailyCounts(context.Background(), target.ID, allIDs, from, to, ownerLoc)
		if err != nil {
			// Streaks degrade to 0 rather than failing the whole profile.
			daily = map[uint]map[string]int{}
		}
	}
	return routines, routineActivityItems, standalone, daily, nil
}

func (s *ProfileService) GetPublicProfile(viewerID uint, username string) (*dto.PublicProfileResponse, error) {
	target, _, card, canView, err := s.resolveProfileTarget(viewerID, username)
	if err != nil {
		return nil, err
	}

	if followErr := s.decorateFollowStatus(viewerID, target, &card); followErr != nil {
		return nil, followErr
	}

	followersCount, err := s.followRepo.CountFollowers(target.ID)
	if err != nil {
		return nil, errors.New("failed to count followers")
	}
	followingCount, err := s.followRepo.CountFollowing(target.ID)
	if err != nil {
		return nil, errors.New("failed to count following")
	}

	resp := &dto.PublicProfileResponse{
		PublicUserCard: card,
		FollowersCount: followersCount,
		FollowingCount: followingCount,
		Routines:       []dto.PublicRoutineCard{},
		Activities:     []dto.PublicActivityCard{},
	}

	if !canView {
		return resp, nil
	}
	resp.CanViewContent = true

	// Streaks are computed in the owner's timezone.
	ownerLoc := ownerLocation(target)
	subscribed := s.viewerSubscriptionMap(viewerID, target.ID)

	routines, routineActivityItems, standalone, daily, err := s.profileContent(target, ownerLoc, subscribed)
	if err != nil {
		return nil, err
	}

	resp.PublicRoutinesCount = int64(len(routines))
	resp.PublicActivitiesCount = int64(len(standalone))
	resp.Routines = s.buildRoutineCards(routines, routineActivityItems, daily, ownerLoc, subscribed)
	resp.Activities = s.buildActivityCards(standalone, daily, ownerLoc, subscribed)

	return resp, nil
}

func sourceKey(sourceType model.SourceType, sourceID uint) string {
	return string(sourceType) + ":" + strconv.FormatUint(uint64(sourceID), 10)
}

func (s *ProfileService) fetchRoutineActivities(routineID uint) []routineDTO.RoutineActivityItem {
	items, err := s.routineRepo.GetActivities(routineID)
	if err != nil || len(items) == 0 {
		return []routineDTO.RoutineActivityItem{}
	}

	activityIDs := make([]uint, len(items))
	for i, it := range items {
		activityIDs[i] = it.ActivityID
	}

	var activities []activityModel.Activity
	s.db.Where("id IN ?", activityIDs).Find(&activities)

	activityMap := make(map[uint]activityModel.Activity, len(activities))
	for _, a := range activities {
		activityMap[a.ID] = a
	}

	result := make([]routineDTO.RoutineActivityItem, len(items))
	for i, it := range items {
		a := activityMap[it.ActivityID]
		result[i] = routineDTO.RoutineActivityItem{
			ActivityID:       it.ActivityID,
			ActivityTitle:    a.Title,
			Description:      a.Description,
			Frequency:        string(a.Frequency),
			DayFrequency:     a.DayFrequency,
			DayTime:          string(a.DayTime),
			PrivacyStatus:    string(a.PrivacyStatus),
			CompletionAmount: a.CompletionAmount,
			Position:         it.Position,
		}
	}
	return result
}
