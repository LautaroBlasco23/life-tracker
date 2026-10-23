import type {
  CalendarEvent,
  CalendarEventScope,
  CreateCalendarEventInput,
  GetCalendarEventsParams,
  UpdateCalendarEventInput,
} from '../types/calendar';
import { authService } from './auth-service';
import { getConfig } from '../lib/config';

interface ApiResponse<T> {
  message: string;
  data: T;
  count?: number;
}

class CalendarService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  /**
   * Returns the events overlapping [from, to). The backend requires both
   * bounds: a half-open range is always a caller bug.
   */
  async getEvents(params: GetCalendarEventsParams): Promise<CalendarEvent[]> {
    const searchParams = new URLSearchParams({
      from: params.from,
      to: params.to,
    });

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/calendar-events?${searchParams.toString()}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }

    const result: ApiResponse<CalendarEvent[]> = await response.json();
    return result.data ?? [];
  }

  async getEvent(id: number): Promise<CalendarEvent> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/calendar-events/${id}`
    );

    if (!response.ok) {
      throw new Error('Calendar event not found');
    }

    const result: ApiResponse<CalendarEvent> = await response.json();
    return result.data;
  }

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/calendar-events`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create calendar event');
    }

    const result: ApiResponse<CalendarEvent> = await response.json();
    return result.data;
  }

  /**
   * Updates an event. `scope` decides whether the change applies to the
   * occurrence alone or to every occurrence of the series it belongs to.
   */
  async updateEvent(
    id: number,
    input: UpdateCalendarEventInput,
    scope?: CalendarEventScope
  ): Promise<CalendarEvent> {
    const body = scope ? { ...input, scope } : input;

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/calendar-events/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update calendar event');
    }

    const result: ApiResponse<CalendarEvent> = await response.json();
    return result.data;
  }

  /**
   * Deletes an event. `scope` decides whether the occurrence alone or every
   * occurrence of the series it belongs to is removed.
   */
  async deleteEvent(id: number, scope?: CalendarEventScope): Promise<void> {
    const query = scope ? `?scope=${scope}` : '';

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/calendar-events/${id}${query}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete calendar event');
    }
  }
}

export const calendarService = new CalendarService();
