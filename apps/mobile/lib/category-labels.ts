import { useTranslations } from '@shared';

/** Time categories (shared TIME_CATEGORIES) mapped to the i18n message keys. */
const CATEGORY_KEYS: Record<string, string> = {
  reading: 'reading',
  gaming: 'gaming',
  exercise: 'exercise',
  work: 'work',
  study: 'study',
  meditation: 'meditation',
  hobbies: 'hobbies',
  social: 'social',
  entertainment: 'entertainment',
  other: 'other',
};

/**
 * Localized label for a time/calendar category. Unknown categories fall back
 * to "Other" so a value added upstream never renders as a raw key.
 */
export function useCategoryLabel() {
  const tTimeCategories = useTranslations('timeCategories');
  return (category: string) =>
    tTimeCategories(CATEGORY_KEYS[category.toLowerCase()] ?? 'other');
}
