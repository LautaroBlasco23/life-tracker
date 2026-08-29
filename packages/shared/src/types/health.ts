export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'traps',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

// Nutrition

export interface MealLog {
  id: string;
  userId: number;
  mealType: MealType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMealLogRequest {
  mealType: MealType;
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  date?: string;
}

export interface UpdateMealLogRequest {
  mealType?: MealType;
  name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  date?: string;
}

export interface DailyNutritionSummary {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

export interface NutritionSummary {
  startDate: string;
  endDate: string;
  daily: DailyNutritionSummary[];
  totals: DailyNutritionSummary;
}

// Gym — exercises

export interface Exercise {
  id: string;
  userId: number;
  name: string;
  muscleGroups: string[];
  createdAt: string;
}

export interface CreateExerciseRequest {
  name: string;
  muscleGroups: string[];
}

export interface UpdateExerciseRequest {
  name?: string;
  muscleGroups?: string[];
}

// Gym — workout sessions

export interface WorkoutSet {
  reps: number;
  weightKg: number;
}

export interface SessionExercise {
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  userId: number;
  date: string;
  durationMinutes?: number;
  notes?: string;
  exercises: SessionExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkoutSessionRequest {
  date?: string;
  durationMinutes?: number;
  notes?: string;
  exercises: SessionExercise[];
}

export interface UpdateWorkoutSessionRequest {
  date?: string;
  durationMinutes?: number;
  notes?: string;
  exercises?: SessionExercise[];
}

export interface MuscleVolume {
  muscleGroup: string;
  volumeKg: number;
  sessions: number;
}

export interface WeeklyVolume {
  weekStart: string;
  volumeKg: number;
}

export interface GymStats {
  startDate: string;
  endDate: string;
  workoutCount: number;
  muscleVolume: MuscleVolume[];
  weeklyVolume: WeeklyVolume[];
}
