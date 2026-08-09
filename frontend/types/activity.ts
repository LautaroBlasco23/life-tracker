import { ActivityRecord } from './activityRecords';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'oneTime';
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';
export type DayTime = 'notSpecified' | 'morning' | 'afternoon' | 'evening';
export type PrivacyStatus = 'public' | 'private';

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
