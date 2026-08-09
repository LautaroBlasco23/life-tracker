import type { User, UpdateUserRequest } from '@/types/user';
import { authService } from './auth-service';
import { getConfig } from '@/lib/config';

interface ApiResponse<T> {
  message: string;
  data: T;
}

class UserService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  async getMyProfile(): Promise<User> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/me`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }
    const result: ApiResponse<User> = await response.json();
    authService.setCurrentUser(result.data);
    return result.data;
  }

  async getUserById(id: number): Promise<User | null> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/${id}`
    );
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch user');
    }
    const result: ApiResponse<User> = await response.json();
    return result.data;
  }

  async updateUser(updates: UpdateUserRequest): Promise<User> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/me`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to update user');
    }
    const result: ApiResponse<User> = await response.json();
    authService.setCurrentUser(result.data);
    return result.data;
  }

  async uploadProfilePicture(file: File): Promise<User> {
    const formData = new FormData();
    formData.append('image', file);
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/me/image`,
      {
        method: 'POST',
        body: formData,
      }
    );
    if (!response.ok) {
      throw new Error('Failed to upload profile picture');
    }
    const result: ApiResponse<User> = await response.json();
    authService.setCurrentUser(result.data);
    return result.data;
  }

  async deleteProfilePicture(): Promise<User> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/me/image`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      throw new Error('Failed to delete profile picture');
    }
    return this.getMyProfile();
  }

  async getAllUsers(): Promise<User[]> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    const result: ApiResponse<User[]> = await response.json();
    return result.data;
  }

  async deleteUser(id: number): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/${id}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      throw new Error('Failed to delete user');
    }
  }

  async checkEmailAvailability(email: string): Promise<boolean> {
    // Use regular fetch since this is a public endpoint (no auth required)
    const response = await fetch(
      `${this.baseUrl}/users/check-email?email=${encodeURIComponent(email)}`
    );
    if (!response.ok) {
      throw new Error('Failed to check email availability');
    }
    const result: { available: boolean; email: string } = await response.json();
    return result.available;
  }
}

export const userService = new UserService();
