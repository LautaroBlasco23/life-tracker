import { ActivityRecord } from './activityRecords';
import type { RoutineRef } from './routine';

// Canonical enum values. The unions below are derived from these arrays so a
// new wire value cannot be added without also becoming selectable in the UI.
export const FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DAY_TIMES = [
  'notSpecified',
  'morning',
  'afternoon',
  'evening',
] as const;
export type DayTime = (typeof DAY_TIMES)[number];

export const PRIVACY_STATUSES = ['private', 'public'] as const;
export type PrivacyStatus = (typeof PRIVACY_STATUSES)[number];

export interface StreakInfo {
  current: number;
  longest: number;
}

export interface Activity {
  id: number;
  userId: number;
  title: string;
  description: string;
  completionAmount: number;
  frequency: Frequency;
  dayFrequency?: string;
  dayTime: DayTime;
  isActive: boolean;
  privacyStatus?: PrivacyStatus;
  createdAt: string;
  updatedAt: string;
  todayCompletions: number;
  isCompletedToday: boolean;
  streak?: StreakInfo;
  routines?: RoutineRef[];
}

export interface CreateActivityRequest {
  title: string;
  description: string;
  completionAmount: number;
  frequency: Frequency;
  dayFrequency?: DayOfWeek[];
  dayTime: DayTime;
  privacyStatus?: PrivacyStatus;
}

export interface UpdateActivityRequest {
  title?: string;
  description?: string;
  completionAmount?: number;
  frequency?: Frequency;
  dayFrequency?: DayOfWeek[];
  dayTime?: DayTime;
  isActive?: boolean;
  privacyStatus?: PrivacyStatus;
}
