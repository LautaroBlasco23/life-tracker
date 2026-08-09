export interface TimeRecord {
  id: number;
  category: string;
  description: string;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimeRecordInput {
  category: string;
  description: string;
  durationMinutes: number;
}

export interface UpdateTimeRecordInput {
  category?: string;
  description?: string;
  durationMinutes?: number;
}

export interface TimeStats {
  totalMinutes: number;
  recordCount: number;
  categoryTotals: Record<string, number>;
  topCategory?: string;
  topCategoryMinutes?: number;
}

export const TIME_CATEGORIES = [
  'Reading',
  'Gaming',
  'Exercise',
  'Work',
  'Study',
  'Meditation',
  'Hobbies',
  'Social',
  'Entertainment',
  'Other',
] as const;

export type TimeCategory = (typeof TIME_CATEGORIES)[number];
