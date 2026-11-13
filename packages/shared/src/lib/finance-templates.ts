// Curated catalog of predefined finance templates (bills, subscriptions,
// salary) users can clone into their fixed transactions. Mirrors the shape of
// `activity-templates.ts`.
// Titles are translated via the `financeTemplates` i18n namespace using the
// template `key` (e.g. `template_electricity`). Categories must match the
// server-side catalog (`finance` domain, `category.go`); only categories
// applicable to `fixed` frequency are used.
import type { PaymentFrequency, TransactionType } from '../types/finance';

export interface FinanceTemplate {
  /** i18n key suffix for the title: `template_{key}`. */
  key: string;
  category: string;
  type: TransactionType;
  paymentFrequency: PaymentFrequency;
  /** Shown as an amount hint; real amounts are user-entered (never prefilled). */
  suggestedAmount: number | null;
}

export const FINANCE_TEMPLATES: FinanceTemplate[] = [
  // Housing & Utilities
  { key: 'electricity', category: 'Housing & Utilities', type: 'outcome', paymentFrequency: 'monthly', suggestedAmount: 50 },
  { key: 'gas', category: 'Housing & Utilities', type: 'outcome', paymentFrequency: 'monthly', suggestedAmount: 20 },
  { key: 'water', category: 'Housing & Utilities', type: 'outcome', paymentFrequency: 'monthly', suggestedAmount: 15 },
  { key: 'internet', category: 'Housing & Utilities', type: 'outcome', paymentFrequency: 'monthly', suggestedAmount: 30 },
  { key: 'rent', category: 'Housing & Utilities', type: 'outcome', paymentFrequency: 'monthly', suggestedAmount: null },

  // Taxes & Fees
  { key: 'insurance', category: 'Taxes & Fees', type: 'outcome', paymentFrequency: 'monthly', suggestedAmount: null },

  // Income
  { key: 'salary', category: 'Primary Income', type: 'income', paymentFrequency: 'monthly', suggestedAmount: null },
];
