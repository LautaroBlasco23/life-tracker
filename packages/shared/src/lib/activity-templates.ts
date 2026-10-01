// Curated catalog of predefined activities users can clone.
// Titles/descriptions are translated via the `activityTemplates` i18n namespace
// using the template `key` (e.g. `template_drinkWater`, `category_health`).
import type { DayOfWeek, DayTime, Frequency } from '../types/activity';

export type ActivityTemplateCategory =
  | 'health'
  | 'study'
  | 'goodHabits'
  | 'homeTraining'
  | 'home'
  | 'productivity'
  | 'mindSocial';

export interface ActivityTemplate {
  /** i18n key suffix for the title: `template_{key}`. */
  key: string;
  category: ActivityTemplateCategory;
  frequency: Frequency;
  dayFrequency?: DayOfWeek[];
  dayTime: DayTime;
  completionAmount: number;
}

export const ACTIVITY_TEMPLATE_CATEGORIES: ActivityTemplateCategory[] = [
  'health',
  'study',
  'goodHabits',
  'homeTraining',
  'home',
  'productivity',
  'mindSocial',
];

export const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  // Health
  { key: 'drinkWater', category: 'health', frequency: 'daily', dayTime: 'morning', completionAmount: 8 },
  { key: 'sleep7to8', category: 'health', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },
  { key: 'vitamins', category: 'health', frequency: 'daily', dayTime: 'morning', completionAmount: 1 },
  { key: 'walk10k', category: 'health', frequency: 'daily', dayTime: 'notSpecified', completionAmount: 1 },
  { key: 'floss', category: 'health', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },
  { key: 'stretch5', category: 'health', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },
  { key: 'mealPrep', category: 'health', frequency: 'weekly', dayFrequency: ['sunday'], dayTime: 'morning', completionAmount: 1 },

  // Study / Learning
  { key: 'read30', category: 'study', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },
  { key: 'study45', category: 'study', frequency: 'daily', dayTime: 'afternoon', completionAmount: 2 },
  { key: 'vocabulary', category: 'study', frequency: 'daily', dayTime: 'morning', completionAmount: 1 },
  { key: 'courseLesson', category: 'study', frequency: 'daily', dayTime: 'notSpecified', completionAmount: 1 },
  { key: 'reviewNotes', category: 'study', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },
  { key: 'exercises5', category: 'study', frequency: 'daily', dayTime: 'afternoon', completionAmount: 1 },

  // Good Habits
  { key: 'makeBed', category: 'goodHabits', frequency: 'daily', dayTime: 'morning', completionAmount: 1 },
  { key: 'noPhoneMorning', category: 'goodHabits', frequency: 'daily', dayTime: 'morning', completionAmount: 1 },
  { key: 'journal5', category: 'goodHabits', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },
  { key: 'meditate10', category: 'goodHabits', frequency: 'daily', dayTime: 'morning', completionAmount: 1 },
  { key: 'planTomorrow', category: 'goodHabits', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },
  { key: 'tidyWorkspace', category: 'goodHabits', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },
  { key: 'noSugar', category: 'goodHabits', frequency: 'daily', dayTime: 'notSpecified', completionAmount: 1 },

  // Home Training
  { key: 'pushups20', category: 'homeTraining', frequency: 'daily', dayTime: 'morning', completionAmount: 1 },
  { key: 'squats30', category: 'homeTraining', frequency: 'daily', dayTime: 'notSpecified', completionAmount: 1 },
  { key: 'plank1', category: 'homeTraining', frequency: 'daily', dayTime: 'notSpecified', completionAmount: 1 },
  { key: 'fullBody20', category: 'homeTraining', frequency: 'weekly', dayFrequency: ['monday', 'wednesday', 'friday'], dayTime: 'afternoon', completionAmount: 1 },
  { key: 'run3k', category: 'homeTraining', frequency: 'weekly', dayFrequency: ['monday', 'wednesday', 'friday'], dayTime: 'morning', completionAmount: 1 },
  { key: 'abs10', category: 'homeTraining', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },

  // Home & Chores
  { key: 'dishes', category: 'home', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },
  { key: 'laundry', category: 'home', frequency: 'weekly', dayFrequency: ['saturday'], dayTime: 'morning', completionAmount: 1 },
  { key: 'vacuum', category: 'home', frequency: 'weekly', dayFrequency: ['wednesday'], dayTime: 'notSpecified', completionAmount: 1 },
  { key: 'trash', category: 'home', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },
  { key: 'groceries', category: 'home', frequency: 'weekly', dayFrequency: ['saturday'], dayTime: 'morning', completionAmount: 1 },
  { key: 'waterPlants', category: 'home', frequency: 'weekly', dayFrequency: ['monday', 'thursday'], dayTime: 'morning', completionAmount: 1 },

  // Productivity / Work
  { key: 'deepWork90', category: 'productivity', frequency: 'weekly', dayFrequency: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], dayTime: 'morning', completionAmount: 1 },
  { key: 'inboxZero', category: 'productivity', frequency: 'daily', dayTime: 'afternoon', completionAmount: 1 },
  { key: 'dailyPlan', category: 'productivity', frequency: 'daily', dayTime: 'morning', completionAmount: 1 },
  { key: 'weeklyReview', category: 'productivity', frequency: 'weekly', dayFrequency: ['friday'], dayTime: 'evening', completionAmount: 1 },

  // Mind & Social
  { key: 'callLoved', category: 'mindSocial', frequency: 'weekly', dayFrequency: ['saturday'], dayTime: 'evening', completionAmount: 1 },
  { key: 'gratitude3', category: 'mindSocial', frequency: 'daily', dayTime: 'evening', completionAmount: 1 },
  { key: 'digitalDetox', category: 'mindSocial', frequency: 'weekly', dayFrequency: ['sunday'], dayTime: 'evening', completionAmount: 1 },
  { key: 'hobby30', category: 'mindSocial', frequency: 'daily', dayTime: 'notSpecified', completionAmount: 1 },
];
