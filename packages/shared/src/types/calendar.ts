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
}

export interface CreateCalendarEventInput {
  title: string;
  description: string;
  category: string;
  startAt: string;
  endAt: string;
}

export type UpdateCalendarEventInput = Partial<CreateCalendarEventInput>;

export interface GetCalendarEventsParams {
  /** ISO-8601 instant. Must be sent together with `to`. */
  from: string;
  /** ISO-8601 instant. Exclusive upper bound. */
  to: string;
}
