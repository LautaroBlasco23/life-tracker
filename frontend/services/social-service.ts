import type {
  PublicUserCard,
  PublicProfileResponse,
  Follow,
  FollowStatus,
} from '@/types/user';
import { authService } from './auth-service';
import { getConfig } from '@/lib/config';

interface ApiResponse<T> {
  message: string;
  data: T;
}

interface FollowResponse {
  status: FollowStatus;
}

interface PageResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// API returns a different structure for user search
interface UserSearchResponse {
  count: number;
  data: PublicUserCard[];
}

class SocialService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  // Search users by username prefix
  async searchUsers(
    query: string,
    limit: number = 20
  ): Promise<PublicUserCard[]> {
    const params = new URLSearchParams();
    params.set('q', query);
    params.set('limit', limit.toString());

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/search?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error('Failed to search users');
    }
    const result: UserSearchResponse = await response.json();
    return result.data ?? [];
  }

  // Get public profile by username
  async getUserProfile(username: string): Promise<PublicProfileResponse> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/${username}`
    );
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found');
      }
      throw new Error('Failed to fetch user profile');
    }
    const result: ApiResponse<PublicProfileResponse> = await response.json();
    return result.data;
  }

  // Follow a user
  async followUser(username: string): Promise<FollowStatus> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/follows/${username}`,
      {
        method: 'POST',
      }
    );
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found');
      }
      throw new Error('Failed to follow user');
    }
    const result: ApiResponse<FollowResponse> = await response.json();
    return result.data.status;
  }

  // Unfollow a user
  async unfollowUser(username: string): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/follows/${username}`,
      {
        method: 'DELETE',
      }
    );
    if (!response.ok) {
      throw new Error('Failed to unfollow user');
    }
  }

  // Get pending follow requests (incoming)
  async getPendingFollowRequests(): Promise<Follow[]> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/follows/pending`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch pending follow requests');
    }
    const result: ApiResponse<PageResponse<Follow>> = await response.json();
    return result.data.items;
  }

  // Accept a follow request
  async acceptFollowRequest(followerId: number): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/follows/pending/${followerId}/accept`,
      {
        method: 'POST',
      }
    );
    if (!response.ok) {
      throw new Error('Failed to accept follow request');
    }
  }

  // Reject a follow request
  async rejectFollowRequest(followerId: number): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/follows/pending/${followerId}/reject`,
      {
        method: 'POST',
      }
    );
    if (!response.ok) {
      throw new Error('Failed to reject follow request');
    }
  }

  // Get followers of a user
  async getFollowers(
    username: string,
    limit: number = 25,
    offset: number = 0
  ): Promise<PageResponse<PublicUserCard>> {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/${username}/followers?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch followers');
    }
    const result: ApiResponse<PageResponse<PublicUserCard>> =
      await response.json();
    return result.data;
  }

  // Get users that a user is following
  async getFollowing(
    username: string,
    limit: number = 25,
    offset: number = 0
  ): Promise<PageResponse<PublicUserCard>> {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/${username}/following?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch following');
    }
    const result: ApiResponse<PageResponse<PublicUserCard>> =
      await response.json();
    return result.data;
  }
}

export const socialService = new SocialService();
