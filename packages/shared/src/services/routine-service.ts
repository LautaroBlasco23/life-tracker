import type {
  Routine,
  CreateRoutineRequest,
  UpdateRoutineRequest,
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

class RoutineService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  async getRoutines(): Promise<Routine[]> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/routines/me`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch routines');
    }

    const backendResponse: BackendListResponse<Routine> = await response.json();
    return backendResponse.data || [];
  }

  async getRoutine(id: number): Promise<Routine> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/routines/${id}`
    );

    if (!response.ok) {
      throw new Error('Routine not found');
    }

    const backendResponse: BackendSingleResponse<Routine> =
      await response.json();
    return backendResponse.data;
  }

  async createRoutine(data: CreateRoutineRequest): Promise<Routine> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/routines`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create routine');
    }

    const backendResponse: BackendSingleResponse<Routine> =
      await response.json();
    return backendResponse.data;
  }

  async updateRoutine(
    id: number,
    updates: UpdateRoutineRequest
  ): Promise<Routine> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/routines/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update routine');
    }

    const backendResponse: BackendSingleResponse<Routine> =
      await response.json();
    return backendResponse.data;
  }

  async deleteRoutine(id: number): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/routines/${id}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete routine');
    }
  }
}

export const routineService = new RoutineService();
