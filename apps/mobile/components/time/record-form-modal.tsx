import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';
import { TIME_CATEGORIES, type TimeRecord } from '@shared/types/time';
import { timeService, useTranslations } from '@shared';
import { showToast } from '../ui/toast';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { OptionSelect } from '../ui/option-select';

const CATEGORY_KEYS: Record<string, string> = {
  reading: 'reading',
  gaming: 'gaming',
  exercise: 'exercise',
  work: 'work',
  study: 'study',
  meditation: 'meditation',
  hobbies: 'hobbies',
  social: 'social',
  entertainment: 'entertainment',
  other: 'other',
};

interface RecordFormModalProps {
  visible: boolean;
  onClose: () => void;
  /** Set when editing an existing entry; null creates a manual entry. */
  record?: TimeRecord | null;
  onSaved: (record: TimeRecord) => void;
}

/**
 * Manual "Log Time" / edit-entry form mirroring web's createTimeRecordModal /
 * editTimeRecordModal (category, description, h/m duration inputs).
 */
export function RecordFormModal({
  visible,
  onClose,
  record,
  onSaved,
}: RecordFormModalProps) {
  const t = useTranslations('time');
  const tTimeCategories = useTranslations('timeCategories');
  const tCommon = useTranslations('common');
  const isEdit = record !== null && record !== undefined;

  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (record) {
      setCategory(record.category);
      setDescription(record.description);
      setHours(String(Math.floor(record.durationMinutes / 60)));
      setMinutes(String(record.durationMinutes % 60));
    } else {
      setCategory(null);
      setDescription('');
      setHours('');
      setMinutes('');
    }
  }, [visible, record]);

  const translateCategory = (cat: string) =>
    tTimeCategories(CATEGORY_KEYS[cat.toLowerCase()] ?? 'other');

  const handleSubmit = async () => {
    const totalMinutes =
      (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);

    if (totalMinutes <= 0) {
      showToast({
        title: t('invalidDuration'),
        description: t('enterValidDuration'),
        variant: 'destructive',
      });
      return;
    }
    if (!category) {
      showToast({
        title: t('invalidDuration'),
        description: t('selectCategory'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && record) {
        const updated = await timeService.updateRecord(record.id, {
          category,
          description,
          durationMinutes: totalMinutes,
        });
        onSaved(updated);
        showToast({
          title: t('timeUpdated'),
          description: t('timeUpdatedDescription'),
        });
      } else {
        const created = await timeService.createRecord({
          category,
          description,
          durationMinutes: totalMinutes,
        });
        onSaved(created);
        showToast({
          title: t('timeRecorded'),
          description: t('timeRecordedDescription', {
            duration:
              totalMinutes >= 60
                ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
                : `${totalMinutes} min`,
            category,
          }),
        });
      }
      onClose();
    } catch (error) {
      showToast({
        title: isEdit ? tCommon('error') : t('failedToSave'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
            {isEdit ? t('editEntry') : t('logTime')}
          </Text>
          <OptionSelect
            label={t('category')}
            value={category}
            options={TIME_CATEGORIES.map((cat) => ({ value: cat, label: translateCategory(cat) }))}
            onSelect={setCategory}
            placeholder={t('selectCategory')}
          />
          <View className="h-4" />
          <FormField
            label={t('description')}
            placeholder={t('whatAreYouWorkingOn')}
            value={description}
            onChangeText={setDescription}
          />
          <View className="h-4" />
          <Text className="text-sm text-foreground dark:text-dark-foreground mb-1.5">
            {t('duration')}
          </Text>
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <FormField
                label=""
                placeholder="0"
                value={hours}
                onChangeText={setHours}
                keyboardType="number-pad"
              />
            </View>
            <Text className="text-muted dark:text-dark-muted">:</Text>
            <View className="flex-1">
              <FormField
                label=""
                placeholder="0"
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <View className="flex-row gap-3 mt-1">
            <Text className="flex-1 text-xs text-muted dark:text-dark-muted">{t('hours')}</Text>
            <Text className="flex-1 text-xs text-muted dark:text-dark-muted">{t('minutes')}</Text>
          </View>

          <View className="flex-row gap-3 pt-5">
            <Button variant="outline" className="flex-1" onPress={onClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </Button>
            <Button
              className="flex-1"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting || !category}
            >
              {isSubmitting
                ? isEdit
                  ? tCommon('updating')
                  : tCommon('saving')
                : tCommon('save')}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
