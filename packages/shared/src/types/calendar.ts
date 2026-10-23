/** Recurrence rules supported by the API. Only weekly so far. */
export type CalendarRecurrenceRule = 'weekly';

/**
 * Scope of an update or delete on an event that belongs to a recurring
 * series: the event itself or every occurrence of its series.
 */
export type CalendarEventScope = 'occurrence' | 'series';

export interface CalendarRecurrenceInput {
  rule: CalendarRecurrenceRule;
  /** Weeks between occurrences. Defaults to 1. */
  interval?: number;
  /** ISO-8601 instant. Required for weekly rules. */
  until: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  category: string;
  /** ISO-8601 instant. */
  startAt: string;
  /** ISO-8601 instant. */
  endAt: string;
  createdAt: string;
  updatedAt: string;
  /** Set when the event is one occurrence of a recurring series. */
  seriesId?: string;
  recurrenceRule?: CalendarRecurrenceRule;
  /** ISO-8601 instant. Last day the series repeats on. */
  recurrenceUntil?: string;
  /** Position of the occurrence inside its series, starting at 0. */
  occurrenceIndex?: number;
}

export interface CreateCalendarEventInput {
  title: string;
  description: string;
  category: string;
  startAt: string;
  endAt: string;
  /** When set, the event is materialized as a recurring series. */
  recurrence?: CalendarRecurrenceInput;
}

export type UpdateCalendarEventInput = Partial<
  Omit<CreateCalendarEventInput, 'recurrence'>
>;

export interface GetCalendarEventsParams {
  /** ISO-8601 instant. Must be sent together with `to`. */
  from: string;
  /** ISO-8601 instant. Exclusive upper bound. */
  to: string;
}
