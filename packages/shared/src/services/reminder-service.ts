import type {
  CreateReminderRequest,
  Reminder,
  UpdateReminderRequest,
} from '../types';
import { authService } from './auth-service';
import { getConfig } from '../lib/config';

interface BackendListResponse<T> {
  count: number;
  data: T[] | null;
  message: string;
}

interface BackendSingleResponse<T> {
  data: T;
  message: string;
}

class ReminderService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  async getReminders(): Promise<Reminder[]> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/reminders`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch reminders');
    }

    const backendResponse: BackendListResponse<Reminder> =
      await response.json();
    return backendResponse.data || [];
  }

  async getReminder(id: number): Promise<Reminder> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/reminders/${id}`
    );

    if (!response.ok) {
      throw new Error('Reminder not found');
    }

    const backendResponse: BackendSingleResponse<Reminder> =
      await response.json();
    return backendResponse.data;
  }

  async createReminder(reminderData: CreateReminderRequest): Promise<Reminder> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/reminders`,
      {
        method: 'POST',
        body: JSON.stringify(reminderData),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create reminder');
    }

    const backendResponse: BackendSingleResponse<Reminder> =
      await response.json();
    return backendResponse.data;
  }

  async updateReminder(
    id: number,
    updates: UpdateReminderRequest
  ): Promise<Reminder> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/reminders/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update reminder');
    }

    const backendResponse: BackendSingleResponse<Reminder> =
      await response.json();
    return backendResponse.data;
  }

  async deleteReminder(id: number): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/reminders/${id}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete reminder');
    }
  }

  async completeReminder(reminderId: number): Promise<Reminder> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/reminders/${reminderId}/complete`,
      { method: 'POST' }
    );

    if (!response.ok) {
      throw new Error('Failed to complete reminder');
    }

    const backendResponse: BackendSingleResponse<Reminder> =
      await response.json();
    return backendResponse.data;
  }

  async revertCompletion(reminderId: number): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/reminders/${reminderId}/complete`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error('Failed to revert reminder completion');
    }
  }
}

export const reminderService = new ReminderService();
