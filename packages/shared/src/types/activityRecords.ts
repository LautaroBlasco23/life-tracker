export interface ActivityRecord {
  id: string;
  activityId: number;
  userId: number;
  completionDate: string;
  notes?: string;
  createdAt: string;
}

export interface RecordActivityRequest {
  completionDate?: string;
  notes?: string;
}

export interface ActivityStats {
  activityId: number;
  title: string;
  totalCompletions: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  recentRecords: ActivityRecord[];
}

export interface ActivityFilter
  extends Record<string, string | number | undefined> {
  frequency?: string;
  dayTime?: string;
  scheduledFor?: string;
}
