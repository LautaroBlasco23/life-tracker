import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { calendarService, useTranslations } from '@shared';
import type { CalendarEvent } from '@shared/types/calendar';
import { TIME_CATEGORIES } from '@shared/types/time';
import { showToast } from '../ui/toast';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { OptionSelect } from '../ui/option-select';
import { useCategoryLabel } from '../../lib/category-labels';
import { useColors } from '../../lib/use-colors';
import {
  combineDateAndTime,
  isValidDateValue,
  isValidTimeOfDay,
  isWithinMaxDuration,
  toDateInputValue,
} from '../../lib/calendar-week';

const DEFAULT_CATEGORY = 'Other';
const DEFAULT_START_HOURS = 9;
const DEFAULT_START_MINUTES = 0;
const DEFAULT_DURATION_MINUTES = 60;

export interface CalendarEventDefaults {
  date: Date;
  startMinutes: number;
  endMinutes: number;
}

interface CalendarEventFormModalProps {
  visible: boolean;
  onClose: () => void;
  /** Event being edited; null creates a new one. */
  event?: CalendarEvent | null;
  /** Prefill for creation (selected day + default time). */
  defaults?: CalendarEventDefaults | null;
  onSaved: (event: CalendarEvent) => void;
  /** Asks the parent to open the delete confirmation. */
  onRequestDelete: (event: CalendarEvent) => void;
}

interface TimeInputProps {
  label: string;
  hours: string;
  minutes: string;
  onChangeHours: (value: string) => void;
  onChangeMinutes: (value: string) => void;
}

/** Two numeric inputs (hours + minutes) with a ":" separator. */
function TimeInput({
  label,
  hours,
  minutes,
  onChangeHours,
  onChangeMinutes,
}: TimeInputProps) {
  const tTime = useTranslations('time');
  return (
    <View className="flex-1">
      <Text className="text-sm text-foreground dark:text-dark-foreground mb-1.5">
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <FormField
            label=""
            placeholder="09"
            value={hours}
            onChangeText={onChangeHours}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
        <Text className="text-muted dark:text-dark-muted">:</Text>
        <View className="flex-1">
          <FormField
            label=""
            placeholder="00"
            value={minutes}
            onChangeText={onChangeMinutes}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>
      <View className="flex-row gap-2 mt-1">
        <Text className="flex-1 text-xs text-muted dark:text-dark-muted">
          {tTime('hours')}
        </Text>
        <Text className="flex-1 text-xs text-muted dark:text-dark-muted">
          {tTime('minutes')}
        </Text>
      </View>
    </View>
  );
}

/**
 * Create / edit form for a calendar event (mobile port of web's
 * calendar-event-modal): title, category, date, start/end time, description.
 */
export function CalendarEventFormModal({
  visible,
  onClose,
  event,
  defaults,
  onSaved,
  onRequestDelete,
}: CalendarEventFormModalProps) {
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');
  const categoryLabel = useCategoryLabel();
  const colors = useColors();
  const isEdit = event !== null && event !== undefined;

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [description, setDescription] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [startHours, setStartHours] = useState(String(DEFAULT_START_HOURS));
  const [startMinutes, setStartMinutes] = useState(String(DEFAULT_START_MINUTES));
  const [endHours, setEndHours] = useState('');
  const [endMinutes, setEndMinutes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;

    if (event) {
      const start = new Date(event.startAt);
      const end = new Date(event.endAt);
      setTitle(event.title);
      setCategory(event.category || DEFAULT_CATEGORY);
      setDescription(event.description);
      setDateValue(toDateInputValue(start));
      setStartHours(String(start.getHours()).padStart(2, '0'));
      setStartMinutes(String(start.getMinutes()).padStart(2, '0'));
      setEndHours(String(end.getHours()).padStart(2, '0'));
      setEndMinutes(String(end.getMinutes()).padStart(2, '0'));
      return;
    }

    const date = defaults?.date ?? new Date();
    const startMinutes = defaults?.startMinutes ?? DEFAULT_START_HOURS * 60;
    const endMinutes = defaults?.endMinutes ?? startMinutes + DEFAULT_DURATION_MINUTES;
    setTitle('');
    setCategory(DEFAULT_CATEGORY);
    setDescription('');
    setDateValue(toDateInputValue(date));
    setStartHours(String(Math.floor(startMinutes / 60)).padStart(2, '0'));
    setStartMinutes(String(startMinutes % 60).padStart(2, '0'));
    setEndHours(String(Math.floor((endMinutes % (24 * 60)) / 60)).padStart(2, '0'));
    setEndMinutes(String(endMinutes % 60).padStart(2, '0'));
  }, [visible, event, defaults]);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showToast({
        title: t('titleRequired'),
        description: t('titleRequiredDescription'),
        variant: 'destructive',
      });
      return;
    }

    if (!isValidDateValue(dateValue)) {
      showToast({ title: t('invalidDate'), variant: 'destructive' });
      return;
    }

    const startHourValue = parseInt(startHours, 10);
    const startMinuteValue = parseInt(startMinutes, 10);
    const endHourValue = parseInt(endHours, 10);
    const endMinuteValue = parseInt(endMinutes, 10);
    if (
      !isValidTimeOfDay(startHourValue, startMinuteValue) ||
      !isValidTimeOfDay(endHourValue, endMinuteValue)
    ) {
      showToast({ title: t('invalidTime'), variant: 'destructive' });
      return;
    }

    const start = combineDateAndTime(dateValue, startHourValue, startMinuteValue);
    const end = combineDateAndTime(dateValue, endHourValue, endMinuteValue);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      showToast({ title: t('invalidRange'), variant: 'destructive' });
      return;
    }

    if (!isWithinMaxDuration(start, end)) {
      showToast({ title: t('tooLong'), variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: trimmedTitle,
        description,
        category,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      };

      if (isEdit && event) {
        const updated = await calendarService.updateEvent(event.id, payload);
        onSaved(updated);
        showToast({
          title: t('eventUpdated'),
          description: t('eventUpdatedDescription', { title: trimmedTitle }),
        });
      } else {
        const created = await calendarService.createEvent(payload);
        onSaved(created);
        showToast({
          title: t('eventCreated'),
          description: t('eventCreatedDescription', { title: trimmedTitle }),
        });
      }
      onClose();
    } catch (error) {
      showToast({
        title: t('failedToSave'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
            {isEdit ? t('editEvent') : t('newEvent')}
          </Text>

          <FormField
            label={t('eventTitle')}
            placeholder={t('titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
            maxLength={255}
          />
          <View className="h-4" />

          <OptionSelect
            label={t('category')}
            value={category}
            options={TIME_CATEGORIES.map((cat) => ({
              value: cat as string,
              label: categoryLabel(cat),
            }))}
            onSelect={setCategory}
            placeholder={t('category')}
          />
          <View className="h-4" />

          <FormField
            label={t('date')}
            placeholder="YYYY-MM-DD"
            value={dateValue}
            onChangeText={setDateValue}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
          />
          <View className="h-4" />

          <View className="flex-row gap-3">
            <TimeInput
              label={t('startTime')}
              hours={startHours}
              minutes={startMinutes}
              onChangeHours={setStartHours}
              onChangeMinutes={setStartMinutes}
            />
            <TimeInput
              label={t('endTime')}
              hours={endHours}
              minutes={endMinutes}
              onChangeHours={setEndHours}
              onChangeMinutes={setEndMinutes}
            />
          </View>
          <View className="h-4" />

          <FormField
            label={t('description')}
            placeholder={t('descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            autoCapitalize="sentences"
            maxLength={1000}
            multiline
            numberOfLines={3}
            className="min-h-[72px] py-2"
          />

          <View className="flex-row gap-3 pt-5">
            {isEdit && event ? (
              <Button
                variant="destructive"
                className="flex-1"
                onPress={() => onRequestDelete(event)}
                disabled={isSubmitting}
              >
                <Trash2 size={16} color={colors.primaryForeground} />
                <Text className="text-primary-foreground dark:text-dark-primary-foreground text-base ml-1.5">
                  {tCommon('delete')}
                </Text>
              </Button>
            ) : (
              <View className="flex-1" />
            )}
            <Button
              variant="outline"
              className="flex-1"
              onPress={onClose}
              disabled={isSubmitting}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              className="flex-1"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
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
