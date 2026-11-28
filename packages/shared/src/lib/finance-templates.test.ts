import { describe, expect, it } from 'vitest';
import { FINANCE_TEMPLATES } from './finance-templates';

// The catalog is plain data; the tests guard the invariants the UI and i18n
// layer rely on (unique keys, valid enums, amount hint contract).

const TRANSACTION_TYPES = ['income', 'outcome'] as const;
const PAYMENT_FREQUENCIES = ['monthly', 'bimonthly', 'yearly'] as const;

describe('FINANCE_TEMPLATES', () => {
  it('is a non-empty catalog with unique keys', () => {
    expect(FINANCE_TEMPLATES.length).toBeGreaterThan(0);
    const keys = FINANCE_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only uses valid transaction types and payment frequencies', () => {
    for (const template of FINANCE_TEMPLATES) {
      expect(TRANSACTION_TYPES).toContain(template.type);
      expect(PAYMENT_FREQUENCIES).toContain(template.paymentFrequency);
      expect(template.category).not.toBe('');
    }
  });

  it('keeps suggested amounts as a positive number or null (never prefill money)', () => {
    for (const template of FINANCE_TEMPLATES) {
      if (template.suggestedAmount === null) {
        continue;
      }
      expect(template.suggestedAmount).toBeGreaterThan(0);
    }
  });

  it('covers both income and outcome templates', () => {
    expect(FINANCE_TEMPLATES.some((t) => t.type === 'income')).toBe(true);
    expect(FINANCE_TEMPLATES.some((t) => t.type === 'outcome')).toBe(true);
  });
});
