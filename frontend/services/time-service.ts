import type {
  CreateTimeRecordInput,
  TimeRecord,
  TimeStats,
  UpdateTimeRecordInput,
} from '@/types/time';
import { authService } from './auth-service';
import { getConfig } from '@/lib/config';

interface ApiResponse<T> {
  message: string;
  data: T;
  count?: number;
}

interface GetRecordsParams {
  category?: string;
  month?: number;
  year?: number;
}

class TimeService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  async getRecords(params?: GetRecordsParams): Promise<TimeRecord[]> {
    const searchParams = new URLSearchParams();

    if (params?.category) searchParams.set('category', params.category);
    if (params?.month !== undefined)
      searchParams.set('month', params.month.toString());
    if (params?.year !== undefined)
      searchParams.set('year', params.year.toString());

    const query = searchParams.toString();
    const url = `${this.baseUrl}/time-records${query ? `?${query}` : ''}`;
    const response = await authService.makeAuthenticatedRequest(url);

    if (!response.ok) {
      throw new Error('Failed to fetch time records');
    }

    const result: ApiResponse<TimeRecord[]> = await response.json();
    return result.data ?? [];
  }

  async getRecord(id: number): Promise<TimeRecord> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/time-records/${id}`
    );

    if (!response.ok) {
      throw new Error('Time record not found');
    }

    const result: ApiResponse<TimeRecord> = await response.json();
    return result.data;
  }

  async createRecord(input: CreateTimeRecordInput): Promise<TimeRecord> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/time-records`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create time record');
    }

    const result: ApiResponse<TimeRecord> = await response.json();
    return result.data;
  }

  async updateRecord(
    id: number,
    input: UpdateTimeRecordInput
  ): Promise<TimeRecord> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/time-records/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update time record');
    }

    const result: ApiResponse<TimeRecord> = await response.json();
    return result.data;
  }

  async deleteRecord(id: number): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/time-records/${id}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete time record');
    }
  }

  async getStats(): Promise<TimeStats> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/time-records/stats`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch time stats');
    }

    const result: ApiResponse<TimeStats> = await response.json();
    return result.data;
  }
}

export const timeService = new TimeService();
