import { useTranslations } from '@shared';
import type { Option } from '../components/ui/option-select';

const MONTH_KEYS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

/** i18n'd month/year options for the filter modal (web parity: MONTHS/YEARS). */
export function useMonthYearOptions() {
  const tMonths = useTranslations('months');
  const monthOptions: Option[] = MONTH_KEYS.map((key, i) => ({
    value: String(i + 1),
    label: tMonths(key),
  }));
  const yearOptions: Option[] = Array.from(
    { length: 10 },
    (_, i) => new Date().getFullYear() - i
  ).map((y) => ({ value: String(y), label: String(y) }));
  return { monthOptions, yearOptions };
}

/** Localized month label ("March"), 1-12. */
export function useMonthLabel() {
  const tMonths = useTranslations('months');
  return (month: number) => tMonths(MONTH_KEYS[month - 1]);
}
