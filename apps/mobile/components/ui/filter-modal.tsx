import { useEffect, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { useTranslations } from '@shared';
import { Button } from './button';
import { FormField } from './form-field';
import { OptionSelect } from './option-select';

export type FilterValue = string | undefined;
export type FilterState = Record<string, FilterValue>;

export interface FilterField {
  id: string;
  label: string;
  type: 'select' | 'date';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  helperText?: string;
}

/** Number of active (non-"all") values in a filter state. */
export function getActiveFilterCount(filter: FilterState): number {
  return Object.values(filter).filter((v) => v !== undefined && v !== 'all').length;
}

interface FilterModalProps {
  visible: boolean;
  title?: string;
  fields: FilterField[];
  currentFilter: FilterState;
  onApplyFilter: (filter: FilterState) => void;
  onClose: () => void;
}

/**
 * Schema-driven filter modal mirroring web's FilterForm: local draft state,
 * select/date fields, Reset + Apply actions.
 */
export function FilterModal({
  visible,
  title,
  fields,
  currentFilter,
  onApplyFilter,
  onClose,
}: FilterModalProps) {
  const t = useTranslations('filterModal');
  const [draft, setDraft] = useState<FilterState>(currentFilter);

  // Keep the draft in sync with the applied filter (e.g. after reopening).
  useEffect(() => {
    if (visible) setDraft(currentFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const hasActiveFilters = getActiveFilterCount(draft) > 0;

  const handleApply = () => {
    const cleaned = Object.entries(draft).reduce<FilterState>((acc, [key, value]) => {
      if (value !== undefined && value !== 'all' && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {});
    onApplyFilter(cleaned);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-black/50 p-6">
        <View className="rounded-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-4">
            {title ?? t('filter')}
          </Text>
          {fields.map((field, index) => (
            <View key={field.id} className={index > 0 ? 'mt-4' : undefined}>
              {field.type === 'select' ? (
                <OptionSelect
                  label={field.label}
                  value={draft[field.id] ?? null}
                  options={[
                    { value: 'all', label: field.placeholder ?? t('filter') },
                    ...(field.options ?? []),
                  ]}
                  onSelect={(value) =>
                    setDraft((prev) => ({ ...prev, [field.id]: value === 'all' ? undefined : value }))
                  }
                  placeholder={field.placeholder}
                />
              ) : (
                <FormField
                  label={field.label}
                  placeholder="YYYY-MM-DD"
                  value={draft[field.id] ?? ''}
                  onChangeText={(value) => setDraft((prev) => ({ ...prev, [field.id]: value || undefined }))}
                />
              )}
              {field.helperText ? (
                <Text className="text-xs text-muted dark:text-dark-muted mt-1">{field.helperText}</Text>
              ) : null}
            </View>
          ))}
          <View className="flex-row gap-3 mt-5">
            {hasActiveFilters ? (
              <Button variant="ghost" onPress={() => setDraft({})}>
                {t('reset')}
              </Button>
            ) : null}
            <Button className="flex-1" onPress={handleApply}>
              {t('applyFilters')}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
