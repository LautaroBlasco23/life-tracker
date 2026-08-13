import type {
  MealLog,
  CreateMealLogRequest,
  UpdateMealLogRequest,
  NutritionSummary,
  Exercise,
  CreateExerciseRequest,
  UpdateExerciseRequest,
  WorkoutSession,
  CreateWorkoutSessionRequest,
  UpdateWorkoutSessionRequest,
  GymStats,
  MealType,
} from '@/types';
import { authService } from './auth-service';
import { getConfig } from '@/lib/config';

interface ApiResponse<T> {
  message: string;
  data: T;
  count?: number;
}

interface GetMealLogsParams {
  mealType?: MealType;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

interface GetWorkoutsParams {
  startDate?: string;
  endDate?: string;
}

class HealthService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  // Nutrition

  async getMealLogs(params?: GetMealLogsParams): Promise<MealLog[]> {
    const searchParams = new URLSearchParams();
    if (params?.mealType) searchParams.append('meal_type', params.mealType);
    if (params?.startDate) searchParams.append('start_date', params.startDate);
    if (params?.endDate) searchParams.append('end_date', params.endDate);
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/nutrition/meals?${searchParams.toString()}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch meal logs');
    }

    const result: ApiResponse<MealLog[]> = await response.json();
    return result.data;
  }

  async createMealLog(data: CreateMealLogRequest): Promise<MealLog> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/nutrition/meals`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          date: data.date || new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create meal log');
    }

    const result: ApiResponse<MealLog> = await response.json();
    return result.data;
  }

  async updateMealLog(
    id: string,
    data: UpdateMealLogRequest
  ): Promise<MealLog> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/nutrition/meals/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update meal log');
    }

    const result: ApiResponse<MealLog> = await response.json();
    return result.data;
  }

  async deleteMealLog(id: string): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/nutrition/meals/${id}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete meal log');
    }
  }

  async getNutritionSummary(
    startDate: string,
    endDate: string
  ): Promise<NutritionSummary> {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/nutrition/summary?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch nutrition summary');
    }

    const result: ApiResponse<NutritionSummary> = await response.json();
    return result.data;
  }

  // Gym — exercises

  async getExercises(): Promise<Exercise[]> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/gym/exercises`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch exercises');
    }

    const result: ApiResponse<Exercise[]> = await response.json();
    return result.data;
  }

  async createExercise(data: CreateExerciseRequest): Promise<Exercise> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/gym/exercises`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create exercise');
    }

    const result: ApiResponse<Exercise> = await response.json();
    return result.data;
  }

  async updateExercise(
    id: string,
    data: UpdateExerciseRequest
  ): Promise<Exercise> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/gym/exercises/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update exercise');
    }

    const result: ApiResponse<Exercise> = await response.json();
    return result.data;
  }

  async deleteExercise(id: string): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/gym/exercises/${id}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete exercise');
    }
  }

  // Gym — workout sessions

  async getWorkouts(params?: GetWorkoutsParams): Promise<WorkoutSession[]> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('start_date', params.startDate);
    if (params?.endDate) searchParams.append('end_date', params.endDate);

    const queryString = searchParams.toString();
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/gym/workouts${queryString ? `?${queryString}` : ''}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch workout sessions');
    }

    const result: ApiResponse<WorkoutSession[]> = await response.json();
    return result.data;
  }

  async createWorkout(
    data: CreateWorkoutSessionRequest
  ): Promise<WorkoutSession> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/gym/workouts`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          date: data.date || new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create workout session');
    }

    const result: ApiResponse<WorkoutSession> = await response.json();
    return result.data;
  }

  async updateWorkout(
    id: string,
    data: UpdateWorkoutSessionRequest
  ): Promise<WorkoutSession> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/gym/workouts/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to update workout session');
    }

    const result: ApiResponse<WorkoutSession> = await response.json();
    return result.data;
  }

  async deleteWorkout(id: string): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/gym/workouts/${id}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete workout session');
    }
  }

  async getGymStats(startDate: string, endDate: string): Promise<GymStats> {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/health/gym/stats?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch gym stats');
    }

    const result: ApiResponse<GymStats> = await response.json();
    return result.data;
  }
}

export const healthService = new HealthService();
