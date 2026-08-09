import type { Frequency, DayTime } from '@/types/activity';
import type {
  TransactionType,
  TransactionFrequency,
  PaymentFrequency,
} from '@/types/finance';

export function translateFrequency(
  frequency: Frequency | string,
  t: (key: string) => string
): string {
  return t(frequency);
}

export function translateDayTime(
  dayTime: DayTime | string,
  t: (key: string) => string
): string {
  return t(dayTime);
}

export function translateTransactionType(
  type: TransactionType | string,
  t: (key: string) => string
): string {
  return t(type);
}

export function translateTransactionFrequency(
  frequency: TransactionFrequency | string,
  t: (key: string) => string
): string {
  return t(frequency);
}

export function translatePaymentFrequency(
  frequency: PaymentFrequency | string,
  t: (key: string) => string
): string {
  return t(frequency);
}

export function translateTimeCategory(
  category: string,
  t: (key: string) => string
): string {
  const key = category.toLowerCase() as keyof {
    reading: string;
    gaming: string;
    exercise: string;
    work: string;
    study: string;
    meditation: string;
    hobbies: string;
    social: string;
    entertainment: string;
    other: string;
  };
  return t(`timeCategories.${key}`);
}

export function translateFinanceCategory(
  category: string,
  t: (key: string) => string
): string {
  return t(`financeCategories.${category}`);
}
