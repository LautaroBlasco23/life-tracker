import type { DayTime, Frequency, PrivacyStatus } from './activity';

export interface RoutineRef {
  id: number;
  title: string;
}

export interface RoutineActivityItem {
  activityId: number;
  activityTitle: string;
  description: string;
  frequency: Frequency;
  dayFrequency?: string;
  dayTime: DayTime;
  privacyStatus: PrivacyStatus;
  completionAmount: number;
  position: number;
}

export interface Routine {
  id: number;
  userId: number;
  title: string;
  description: string;
  privacyStatus: PrivacyStatus;
  activities: RoutineActivityItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityIDPosition {
  activityId: number;
  position: number;
}

export interface CreateRoutineRequest {
  title: string;
  description: string;
  privacyStatus: PrivacyStatus;
  activityIds: ActivityIDPosition[];
}

export interface UpdateRoutineRequest {
  title?: string;
  description?: string;
  privacyStatus?: PrivacyStatus;
  activityIds?: ActivityIDPosition[];
}
