export type TransactionType = 'income' | 'outcome';
export type TransactionFrequency = 'fixed' | 'variable';
export type PaymentFrequency = 'monthly' | 'bimonthly' | 'yearly';

export const INCOME_CATEGORIES = [
  'Primary Income',
  'Side Income',
  'Investments',
  'Other Income',
] as const;

export const EXPENSE_CATEGORIES = [
  'Housing & Utilities',
  'Food & Groceries',
  'Transportation',
  'Health & Fitness',
  'Education',
  'Entertainment & Travel',
  'Taxes & Fees',
  'Pets & Misc',
] as const;

export const ALL_FINANCE_CATEGORIES = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type FinanceCategory = (typeof ALL_FINANCE_CATEGORIES)[number];

export interface Category {
  name: string;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  userId: number;
  type: TransactionType;
  frequency: TransactionFrequency;
  paymentFrequency?: PaymentFrequency;
  amount: number;
  category: string;
  description?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSummary {
  id: string;
  amount: number;
  date: string;
}

export interface FixedTransaction {
  id: string;
  type: TransactionType;
  paymentFrequency: PaymentFrequency;
  category: string;
  description?: string;
  totalPaid: number;
  payments?: PaymentSummary[];
  currentPeriodPayment?: PaymentSummary;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  transactionId: string;
  amount: number;
  date: string;
  createdAt: string;
}

export interface CreateTransactionRequest {
  type: TransactionType;
  frequency: TransactionFrequency;
  paymentFrequency?: PaymentFrequency;
  amount: number;
  category: string;
  description?: string;
  date?: string;
}

export interface UpdateTransactionRequest {
  type?: TransactionType;
  frequency?: TransactionFrequency;
  paymentFrequency?: PaymentFrequency;
  amount?: number;
  category?: string;
  description?: string;
  date?: string;
}

export interface CreatePaymentRequest {
  transactionId: string;
  amount: number;
  date?: string;
}

export interface CategorySummary {
  category: string;
  total: number;
  percentage: number;
  count: number;
}

export interface FinanceSummary {
  totalIncome: number;
  totalOutcome: number;
  balance: number;
  incomeByCategory: CategorySummary[];
  outcomeByCategory: CategorySummary[];
  period: string;
}

export interface MonthlyStats {
  month: string;
  year: number;
  totalIncome: number;
  totalOutcome: number;
  balance: number;
  transactionCount: number;
}
