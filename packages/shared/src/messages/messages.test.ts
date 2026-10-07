import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';

// en.json is the source of truth for translations. A key present in en but
// missing in es renders raw keys (or English text) to Spanish users silently.

type Messages = Record<string, unknown>;

function flatten(obj: Messages, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      return flatten(value as Messages, path);
    }
    return [path];
  });
}

const enKeys = flatten(en).sort();
const esKeys = flatten(es).sort();

describe('i18n message parity', () => {
  it('en and es define the same set of keys', () => {
    const missingInEs = enKeys.filter((key) => !esKeys.includes(key));
    const missingInEn = esKeys.filter((key) => !enKeys.includes(key));
    expect(missingInEs).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it('en.json is not empty', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it('translations are non-empty strings', () => {
    for (const key of enKeys) {
      const value = key.split('.').reduce<unknown>(
        (acc, part) => (acc as Messages)[part],
        en as unknown
      );
      expect(value, `en.${key}`).toBeTypeOf('string');
      expect(value as string, `en.${key}`).not.toBe('');
    }
  });
});
