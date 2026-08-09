export type ProfilePrivacyStatus = 'public' | 'private';
export type FollowStatus = 'pending' | 'accepted';

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

export interface PublicProfileResponse {
  user: PublicUserCard;
  followersCount: number;
  followingCount: number;
  publicActivitiesCount: number;
  publicRoutinesCount: number;
}

export interface Follow {
  followerId: number;
  followeeId: number;
  status: FollowStatus;
  createdAt: string;
  acceptedAt?: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  timezone?: string;
  profilePrivacyStatus?: ProfilePrivacyStatus;
}
