import type {
  Activity,
  CreateActivityRequest,
  UpdateActivityRequest,
  ActivityRecord,
  ActivityStats,
  RecordActivityRequest,
  DayOfWeek,
  ActivityFilter,
} from '@/types';
import { authService } from './auth-service';
import { getConfig } from '@/lib/config';

interface CreateActivityPayload {
  title: string;
  description: string;
  completionAmount: number;
  frequency: string;
  dayFrequency?: string;
  dayTime: string;
  privacyStatus?: string;
}

interface UpdateActivityPayload {
  title?: string;
  description?: string;
  completionAmount?: number;
  frequency?: string;
  dayFrequency?: string;
  dayTime?: string;
  isActive?: boolean;
  privacyStatus?: string;
}

interface BackendListResponse<T> {
  count: number;
  data: T[] | null;
  message: string;
}

interface BackendSingleResponse<T> {
  data: T;
  message: string;
}

class ActivityService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  private buildQueryString(filter?: ActivityFilter): string {
    if (!filter) return '';

    const params = new URLSearchParams();

    if (filter.frequency) params.set('frequency', filter.frequency);
    if (filter.dayTime) params.set('day_time', filter.dayTime);
    if (filter.scheduledFor) params.set('scheduled_for', filter.scheduledFor);

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }

  async getActivities(filter?: ActivityFilter): Promise<Activity[]> {
    const queryString = this.buildQueryString(filter);
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/activities${queryString}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch activities');
    }

    const backendResponse: BackendListResponse<Activity> =
      await response.json();
    return backendResponse.data || [];
  }

  async getActivitiesByUserId(): Promise<Activity[]> {
    return this.getActivities();
  }

  async getTodayActivities(): Promise<Activity[]> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/activities/today`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch today's activities");
    }

    const backendResponse: BackendListResponse<Activity> =
      await response.json();
    return backendResponse.data || [];
  }

  async getActivity(id: number): Promise<Activity> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/activities/${id}`
    );

    if (!response.ok) {
      throw new Error('Activity not found');
    }

    const backendResponse: BackendSingleResponse<Activity> =
      await response.json();
    return backendResponse.data;
  }

  async createActivity(activityData: CreateActivityRequest): Promise<Activity> {
    const payload: CreateActivityPayload = {
      title: activityData.title,
      description: activityData.description,
      completionAmount: activityData.completionAmount,
      frequency: activityData.frequency,
      dayFrequency: activityData.dayFrequency
        ? JSON.stringify(activityData.dayFrequency)
        : undefined,
      dayTime: activityData.dayTime,
      privacyStatus: activityData.privacyStatus,
    };

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/activities`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create activity');
    }

    const backendResponse: BackendSingleResponse<Activity> =
      await response.json();
    return backendResponse.data;
  }

  async updateActivity(
    id: number,
    updates: UpdateActivityRequest
  ): Promise<Activity> {
    const payload: UpdateActivityPayload = {
      ...updates,
      dayFrequency: updates.dayFrequency
        ? JSON.stringify(updates.dayFrequency)
        : undefined,
      dayTime: updates.dayTime,
      privacyStatus: updates.privacyStatus,
    };

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/activities/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update activity');
    }

    const backendResponse: BackendSingleResponse<Activity> =
      await response.json();
    return backendResponse.data;
  }

  async deleteActivity(id: number): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/activities/${id}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete activity');
    }
  }

  async recordActivity(
    activityId: number,
    data: RecordActivityRequest = {}
  ): Promise<ActivityRecord> {
    const payload: RecordActivityRequest = {};

    if (data.completionDate) {
      payload.completionDate = data.completionDate;
    }
    if (data.notes) {
      payload.notes = data.notes;
    }

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/activities/${activityId}/record`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to record activity');
    }

    const backendResponse: BackendSingleResponse<ActivityRecord> =
      await response.json();
    return backendResponse.data;
  }

  async getActivityRecords(activityId: number): Promise<ActivityRecord[]> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/activities/${activityId}/records`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch activity records');
    }

    const backendResponse: BackendListResponse<ActivityRecord> =
      await response.json();
    return backendResponse.data || [];
  }

  async getActivityStats(activityId: number): Promise<ActivityStats> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/activities/${activityId}/stats`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch activity stats');
    }

    const backendResponse: BackendSingleResponse<ActivityStats> =
      await response.json();
    return backendResponse.data;
  }

  async revertLastCompletion(
    activityId: number,
    targetDate?: string
  ): Promise<void> {
    const body = targetDate ? JSON.stringify({ targetDate }) : undefined;

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/activities/${activityId}/revert`,
      {
        method: 'DELETE',
        ...(body && { body }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to revert completion');
    }
  }

  async incrementActivityProgress(
    activityId: number,
    completionDate?: string
  ): Promise<Activity> {
    await this.recordActivity(activityId, { completionDate });
    return this.getActivity(activityId);
  }

  parseDayFrequency(dayFrequency?: string): DayOfWeek[] {
    if (!dayFrequency) return [];
    try {
      return JSON.parse(dayFrequency);
    } catch {
      return [];
    }
  }
}

export const activityService = new ActivityService();
