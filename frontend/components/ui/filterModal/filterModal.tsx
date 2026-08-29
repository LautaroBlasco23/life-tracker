'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { Category } from '@shared/types';
import { useTranslations } from '@shared/contexts/language-context';

export type FilterValue = string | number | undefined;

export interface FilterField {
  id: string;
  label: string;
  type: 'select' | 'date';
  options?: Array<{ value: string | number; label: string }>;
  placeholder?: string;
  helperText?: string;
}

interface FilterFormProps<T extends Record<string, FilterValue>> {
  currentFilter: T;
  onApplyFilter: (filter: T) => void;
  onClose: () => void;
  fields: FilterField[];
}

/**
 * Shared filter body: local draft state + fields + Reset/Apply actions.
 * Used by the slide-in sidebar.
 */
export function FilterForm<T extends Record<string, FilterValue>>({
  currentFilter,
  onApplyFilter,
  onClose,
  fields,
}: FilterFormProps<T>) {
  const [filter, setFilter] = useState<T>(currentFilter);
  const t = useTranslations('filterModal');

  // Keep the draft in sync with the applied filter (e.g. after reopening).
  useEffect(() => {
    setFilter(currentFilter);
  }, [currentFilter]);

  const handleApply = () => {
    const cleanedFilter = Object.entries(filter).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== 'all') {
        acc[key as keyof T] = value as T[keyof T];
      }
      return acc;
    }, {} as T);

    onApplyFilter(cleanedFilter);
    onClose();
  };

  const handleReset = () => {
    setFilter({} as T);
  };

  const hasActiveFilters = Object.values(filter).some(
    (value) => value !== undefined && value !== 'all'
  );

  const handleSelectChange = (fieldId: string, value: string) => {
    setFilter((prev) => ({
      ...prev,
      [fieldId]:
        value === 'all'
          ? undefined
          : isNaN(Number(value))
            ? value
            : parseInt(value),
    }));
  };

  const handleInputChange = (fieldId: string, value: string) => {
    setFilter((prev) => ({
      ...prev,
      [fieldId]: value || undefined,
    }));
  };

  const getSelectValue = (fieldId: string): string => {
    const value = filter[fieldId as keyof T];
    return value !== undefined ? String(value) : 'all';
  };

  const getInputValue = (fieldId: string): string => {
    const value = filter[fieldId as keyof T];
    return value !== undefined ? String(value) : '';
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>{field.label}</Label>
            {field.type === 'select' ? (
              <Select
                value={getSelectValue(field.id)}
                onValueChange={(value) => handleSelectChange(field.id, value)}
              >
                <SelectTrigger id={field.id} className="w-full">
                  <SelectValue placeholder={field.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{field.placeholder}</SelectItem>
                  {field.options?.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={String(option.value)}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input
                  id={field.id}
                  type="date"
                  value={getInputValue(field.id)}
                  onChange={(e) =>
                    handleInputChange(field.id, e.target.value)
                  }
                />
                {field.helperText && (
                  <p className="text-xs text-muted-foreground">
                    {field.helperText}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3">
        {hasActiveFilters && (
          <Button variant="ghost" onClick={handleReset} className="mr-auto">
            {t('reset')}
          </Button>
        )}
        <Button onClick={handleApply}>{t('applyFilters')}</Button>
      </div>
    </div>
  );
}

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const YEARS = Array.from(
  { length: 10 },
  (_, i) => new Date().getFullYear() - i
);

export { MONTHS, YEARS };

export function createCategoryOptions(categories: Category[]) {
  return categories.map((cat) => ({ value: cat.name, label: cat.name }));
}
