import type { DayTime, Frequency, StreakInfo } from './activity';
import type { RoutineActivityItem } from './routine';

export type ProfilePrivacyStatus = 'public' | 'private';
export type FollowStatus = 'pending' | 'accepted' | 'none';

export interface User {
  id: number;
  username?: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicUrl?: string;
  thumbnailUrl?: string;
  timezone?: string;
  profilePrivacyStatus?: ProfilePrivacyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUserCard {
  id: number;
  username?: string;
  firstName: string;
  lastName: string;
  profilePicUrl?: string;
  profilePrivacyStatus: ProfilePrivacyStatus;
  isFollowing: boolean;
  followStatus?: FollowStatus;
}

export interface FollowerItem {
  userId: number;
  firstName: string;
  lastName: string;
  username: string;
}

export interface PublicRoutineCard {
  id: number;
  title: string;
  description: string;
  streak?: StreakInfo;
  activities: RoutineActivityItem[];
  subscribed: boolean;
}

export interface PublicActivityCard {
  id: number;
  title: string;
  description: string;
  frequency: Frequency;
  dayFrequency?: string;
  dayTime: DayTime;
  completionAmount: number;
  streak?: StreakInfo;
  subscribed: boolean;
}

export interface PublicProfileResponse {
  id: number;
  firstName: string;
  lastName: string;
  username?: string;
  profilePicUrl?: string;
  profilePrivacyStatus: ProfilePrivacyStatus;
  isFollowing: boolean;
  followStatus?: FollowStatus;
  followersCount: number;
  followingCount: number;
  publicRoutinesCount: number;
  publicActivitiesCount: number;
  canViewContent: boolean;
  routines: PublicRoutineCard[];
  activities: PublicActivityCard[];
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  timezone?: string;
  profilePrivacyStatus?: ProfilePrivacyStatus;
}
