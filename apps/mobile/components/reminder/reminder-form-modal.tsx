import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { reminderService } from '@shared/services/reminder-service';
import { useTranslations } from '@shared';
import type { Reminder } from '@shared/types/reminder';
import { showToast } from '../ui/toast';
import { FormField } from '../ui/form-field';
import { Button } from '../ui/button';
import { cn } from '../../lib/cn';

/** Combines a YYYY-MM-DD date string with an "HH:MM" time value into a local Date. */
export function buildDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTimeInput(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface ReminderFormModalProps {
  visible: boolean;
  /** Present → edit mode, absent → create mode. */
  reminder: Reminder | null;
  onClose: () => void;
  onSaved: (reminder: Reminder) => void;
}

/** Create/edit reminder form mirroring web's create/edit reminder modals. */
export function ReminderFormModal({ visible, reminder, onClose, onSaved }: ReminderFormModalProps) {
  const t = useTranslations('createReminder');
  const tCommon = useTranslations('common');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');
  const [hasWindow, setHasWindow] = useState(false);
  const [startTime, setStartTime] = useState('07:00');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (reminder) {
      setTitle(reminder.title);
      setDescription(reminder.description);
      const due = new Date(reminder.dueAt);
      setDueDate(formatDateInput(due));
      setEndTime(formatTimeInput(due));
      if (reminder.activeFrom) {
        setHasWindow(true);
        setStartTime(formatTimeInput(new Date(reminder.activeFrom)));
      } else {
        setHasWindow(false);
      }
    } else {
      setTitle('');
      setDescription('');
      setDueDate('');
      setHasWindow(false);
      setStartTime('07:00');
      setEndTime('23:59');
    }
  }, [visible, reminder]);

  const handleSubmit = async () => {
    if (!dueDate.trim() || !DATE_RE.test(dueDate.trim())) {
      showToast({ title: t('validationError'), description: t('pickDateError'), variant: 'destructive' });
      return;
    }
    if (!TIME_RE.test(endTime) || (hasWindow && !TIME_RE.test(startTime))) {
      showToast({ title: t('validationError'), description: t('windowBeforeDeadlineError'), variant: 'destructive' });
      return;
    }

    const dueAt = buildDateTime(dueDate, endTime);
    const activeFrom = hasWindow ? buildDateTime(dueDate, startTime) : new Date();
    if (activeFrom >= dueAt) {
      showToast({ title: t('validationError'), description: t('windowBeforeDeadlineError'), variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        dueAt: dueAt.toISOString(),
        activeFrom: activeFrom.toISOString(),
      };
      const saved = reminder
        ? await reminderService.updateReminder(reminder.id, payload)
        : await reminderService.createReminder(payload);
      onSaved(saved);
      showToast({
        title: reminder ? t('reminderUpdated') : t('reminderCreated'),
        description: reminder ? t('reminderUpdatedDescription') : t('reminderCreatedDescription'),
      });
    } catch {
      showToast({
        title: reminder ? t('updateFailed') : t('creationFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
            {reminder ? t('updateReminder') : t('title')}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <FormField label={t('titleLabel')} placeholder={t('titlePlaceholder')} value={title} onChangeText={setTitle} />
            <View className="h-4" />
            <FormField
              label={t('descriptionLabel')}
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
            />
            <View className="h-4" />
            <FormField label={t('dueDate')} placeholder={t('dueDatePlaceholder')} value={dueDate} onChangeText={setDueDate} autoCapitalize="none" />
            <View className="h-4" />
            <FormField label={t('windowEndTime')} placeholder="HH:MM" value={endTime} onChangeText={setEndTime} autoCapitalize="none" />
            {!hasWindow ? (
              <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                {t('windowEndHint')}
              </Text>
            ) : null}

            <View className="rounded-xl border border-border dark:border-dark-border p-3 mt-4">
              <Pressable
                onPress={() => setHasWindow((s) => !s)}
                className="flex-row items-center gap-2"
              >
                <View
                  className={cn(
                    'h-5 w-5 rounded border items-center justify-center',
                    hasWindow
                      ? 'bg-primary dark:bg-dark-primary border-primary dark:border-dark-primary'
                      : 'border-border dark:border-dark-border'
                  )}
                >
                  {hasWindow ? <Check size={14} color="#0d1117" /> : null}
                </View>
                <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                  {t('activeWindow')}
                </Text>
              </Pressable>
              <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                {t('activeWindowHint')}
              </Text>

              {hasWindow ? (
                <View className="flex-row gap-3 mt-3">
                  <View className="flex-1">
                    <FormField label={t('windowStartTime')} placeholder="HH:MM" value={startTime} onChangeText={setStartTime} autoCapitalize="none" />
                  </View>
                  <View className="flex-1">
                    <FormField label={t('windowEndTime')} placeholder="HH:MM" value={endTime} onChangeText={setEndTime} autoCapitalize="none" />
                  </View>
                </View>
              ) : null}
            </View>

            <View className="flex-row gap-3 pt-4 pb-2">
              <Button variant="outline" className="flex-1" onPress={onClose} disabled={isSaving}>
                {tCommon('cancel')}
              </Button>
              <Button className="flex-1" onPress={handleSubmit} loading={isSaving}>
                {reminder ? t('updateReminder') : t('createReminder')}
              </Button>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
