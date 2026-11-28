import { describe, expect, it, vi } from 'vitest';
import {
  translateDayTime,
  translateFinanceCategory,
  translateFrequency,
  translatePaymentFrequency,
  translateTimeCategory,
  translateTransactionFrequency,
  translateTransactionType,
} from './translateEnums';

const t = vi.fn((key: string) => `<${key}>`);

describe('enum translations', () => {
  it('map enum values straight through as i18n keys', () => {
    translateFrequency('daily', t);
    expect(t).toHaveBeenLastCalledWith('daily');

    translateDayTime('morning', t);
    expect(t).toHaveBeenLastCalledWith('morning');

    translateTransactionType('income', t);
    expect(t).toHaveBeenLastCalledWith('income');

    translateTransactionFrequency('weekly', t);
    expect(t).toHaveBeenLastCalledWith('weekly');

    translatePaymentFrequency('monthly', t);
    expect(t).toHaveBeenLastCalledWith('monthly');
  });

  it('namespaced categories build the full message key', () => {
    translateTimeCategory('Reading', t);
    expect(t).toHaveBeenLastCalledWith('timeCategories.reading');

    // Backend categories may arrive capitalized; the key is lowercased.
    translateTimeCategory('WORK', t);
    expect(t).toHaveBeenLastCalledWith('timeCategories.work');

    translateFinanceCategory('groceries', t);
    expect(t).toHaveBeenLastCalledWith('financeCategories.groceries');
  });

  it('return the translated value, not the enum', () => {
    expect(translateFrequency('daily', t)).toBe('<daily>');
    expect(translateTimeCategory('Gaming', t)).toBe(
      '<timeCategories.gaming>'
    );
    expect(translateFinanceCategory('rent', t)).toBe(
      '<financeCategories.rent>'
    );
  });
});
