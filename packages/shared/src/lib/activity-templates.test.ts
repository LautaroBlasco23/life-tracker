import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_TEMPLATE_CATEGORIES,
  ACTIVITY_TEMPLATES,
  ROUTINE_TEMPLATES,
  TEMPLATE_CATEGORIES_BY_KIND,
} from './activity-templates';

// The catalogs are plain data; the tests guard the invariants the UI and
// i18n layer rely on (unique keys, valid enums, consistent cross-references).

const FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
const DAY_TIMES = ['notSpecified', 'morning', 'afternoon', 'evening'] as const;
const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

describe('ACTIVITY_TEMPLATES', () => {
  it('is a non-empty catalog', () => {
    expect(ACTIVITY_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('has unique keys and valid enum values', () => {
    const keys = new Set<string>();
    for (const template of ACTIVITY_TEMPLATES) {
      expect(keys.has(template.key)).toBe(false);
      keys.add(template.key);

      expect(FREQUENCIES).toContain(template.frequency);
      expect(DAY_TIMES).toContain(template.dayTime);
      expect(ACTIVITY_TEMPLATE_CATEGORIES).toContain(template.category);
      expect(template.completionAmount).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives weekly templates a non-empty, valid dayFrequency and daily templates none', () => {
    for (const template of ACTIVITY_TEMPLATES) {
      if (template.frequency === 'weekly') {
        expect(template.dayFrequency?.length).toBeGreaterThan(0);
        for (const day of template.dayFrequency ?? []) {
          expect(DAYS_OF_WEEK).toContain(day);
        }
      } else {
        expect(template.dayFrequency).toBeUndefined();
      }
    }
  });

  it('covers every category with at least one template', () => {
    for (const category of ACTIVITY_TEMPLATE_CATEGORIES) {
      expect(
        ACTIVITY_TEMPLATES.some((t) => t.category === category)
      ).toBe(true);
    }
  });
});

describe('ROUTINE_TEMPLATES', () => {
  it('is a non-empty catalog with unique keys', () => {
    expect(ROUTINE_TEMPLATES.length).toBeGreaterThan(0);
    const keys = ROUTINE_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only uses routine categories and non-empty activity lists', () => {
    for (const template of ROUTINE_TEMPLATES) {
      expect(['home', 'homeTraining']).toContain(template.category);
      expect(template.activities.length).toBeGreaterThan(0);
    }
  });

  it('references activity template keys that exist', () => {
    const activityKeys = new Set(ACTIVITY_TEMPLATES.map((t) => t.key));
    for (const template of ROUTINE_TEMPLATES) {
      for (const activityKey of template.activities) {
        expect(activityKeys.has(activityKey)).toBe(true);
      }
    }
  });
});

describe('TEMPLATE_CATEGORIES_BY_KIND', () => {
  it('maps activities to the full activity categories and routines to their subset', () => {
    expect(TEMPLATE_CATEGORIES_BY_KIND.activity).toBe(
      ACTIVITY_TEMPLATE_CATEGORIES
    );
    expect(TEMPLATE_CATEGORIES_BY_KIND.routine).toEqual([
      'home',
      'homeTraining',
    ]);
  });
});
