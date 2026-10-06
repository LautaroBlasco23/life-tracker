import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { activityService, useTranslations } from '@shared';
import { reminderService } from '@shared/services/reminder-service';
import type { Activity, DayOfWeek, DayTime, Frequency } from '@shared/types/activity';
import type { Reminder } from '@shared/types/reminder';
import { buildDateTime, formatDateInput, formatTimeInput } from '@shared/lib/datetime';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { showToast } from '../ui/toast';
import { cn } from '../../lib/cn';
import { useColors } from '../../lib/use-colors';

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly'];
const DAY_TIMES: DayTime[] = ['notSpecified', 'morning', 'afternoon', 'evening'];
const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type EntityMode = 'activity' | 'reminder';

interface Prefill {
  title: string;
  completionAmount: number;
  frequency: Frequency;
  dayTime: DayTime;
  dayFrequency?: DayOfWeek[];
}

interface Props {
  visible: boolean;
  activity?: Activity | null; // present → edit activity
  reminder?: Reminder | null; // present → edit reminder
  /** Values to prefill an activity create form (e.g. a customized template). */
  prefill?: Prefill | null;
  /** Lock the create mode (e.g. the routine picker only accepts recurring activities). */
  mode?: EntityMode;
  onClose: () => void;
  /** Called after an activity is created/updated. */
  onSaved: (activity: Activity) => void;
  /** Called after a reminder is created/updated. */
  onReminderSaved?: (reminder: Reminder) => void;
}

/**
 * Unified create/edit form for recurring activities and reminders. A checkbox
 * switches the form between the two field sets when creating; edit mode is
 * locked to the entity being edited (activities and reminders are separate
 * resources and cannot be converted in place).
 */
export function ActivityFormModal({
  visible,
  activity = null,
  reminder = null,
  prefill = null,
  mode: lockedMode,
  onClose,
  onSaved,
  onReminderSaved,
}: Props) {
  const t = useTranslations('createActivity');
  const tAct = useTranslations('activities');
  const tReminder = useTranslations('createReminder');
  const tCommon = useTranslations('common');
  const colors = useColors();

  const [entityMode, setEntityMode] = useState<EntityMode>('reminder');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [completionAmount, setCompletionAmount] = useState('1');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [dayTime, setDayTime] = useState<DayTime>('notSpecified');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');
  const [hasWindow, setHasWindow] = useState(false);
  const [startTime, setStartTime] = useState('07:00');
  const [isSaving, setIsSaving] = useState(false);

  const isEdit = Boolean(activity || reminder);
  const effectiveMode: EntityMode = activity
    ? 'activity'
    : reminder
      ? 'reminder'
      : (lockedMode ?? entityMode);

  useEffect(() => {
    if (!visible) return;

    if (activity) {
      setTitle(activity.title);
      setDescription(activity.description);
      setCompletionAmount(String(activity.completionAmount));
      setFrequency(activity.frequency);
      setDayTime(activity.dayTime);
      setSelectedDays(
        activity.dayFrequency ? (JSON.parse(activity.dayFrequency) as DayOfWeek[]) : []
      );
      return;
    }

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
      return;
    }

    // Create mode: normal activity by default; the Reminder checkbox opts into
    // reminder mode.
    setEntityMode(lockedMode ?? 'activity');
    setTitle(prefill?.title ?? '');
    setDescription('');
    setCompletionAmount(String(prefill?.completionAmount ?? 1));
    setFrequency(prefill?.frequency ?? 'daily');
    setDayTime(prefill?.dayTime ?? 'notSpecified');
    setSelectedDays(prefill?.dayFrequency ?? []);
    setDueDate('');
    setHasWindow(false);
    setStartTime('07:00');
    setEndTime('23:59');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, activity, reminder, prefill, lockedMode]);

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const submitActivity = async () => {
    const amount = Number(completionAmount);
    if (!title.trim()) {
      Alert.alert(t('validationError'), t('titleLabel'));
      return;
    }
    if (!Number.isFinite(amount) || amount < 1) {
      Alert.alert(t('validationError'), t('targetAmount'));
      return;
    }
    if (frequency === 'weekly' && selectedDays.length === 0) {
      Alert.alert(t('validationError'), t('selectDayError'));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        completionAmount: amount,
        frequency,
        dayTime,
        dayFrequency: frequency === 'weekly' ? selectedDays : undefined,
      };
      const saved = isEdit && activity
        ? await activityService.updateActivity(activity.id, payload)
        : await activityService.createActivity(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      Alert.alert(t('creationFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const submitReminder = async () => {
    if (!dueDate.trim() || !DATE_RE.test(dueDate.trim())) {
      showToast({ title: tReminder('validationError'), description: tReminder('pickDateError'), variant: 'destructive' });
      return;
    }
    if (!TIME_RE.test(endTime) || (hasWindow && !TIME_RE.test(startTime))) {
      showToast({ title: tReminder('validationError'), description: tReminder('windowBeforeDeadlineError'), variant: 'destructive' });
      return;
    }

    const dueDateObj = new Date(
      Number(dueDate.slice(0, 4)),
      Number(dueDate.slice(5, 7)) - 1,
      Number(dueDate.slice(8, 10))
    );
    const dueAt = buildDateTime(dueDateObj, endTime);
    const activeFrom = hasWindow ? buildDateTime(dueDateObj, startTime) : new Date();
    if (activeFrom >= dueAt) {
      showToast({ title: tReminder('validationError'), description: tReminder('windowBeforeDeadlineError'), variant: 'destructive' });
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
      const saved = isEdit && reminder
        ? await reminderService.updateReminder(reminder.id, payload)
        : await reminderService.createReminder(payload);
      onReminderSaved?.(saved);
      showToast({
        title: reminder ? tReminder('reminderUpdated') : tReminder('reminderCreated'),
        description: reminder
          ? tReminder('reminderUpdatedDescription')
          : tReminder('reminderCreatedDescription'),
      });
      onClose();
    } catch {
      showToast({
        title: reminder ? tReminder('updateFailed') : tReminder('creationFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = () => {
    if (effectiveMode === 'activity') {
      void submitActivity();
    } else {
      void submitReminder();
    }
  };

  const dialogTitle = isEdit
    ? activity
      ? tAct('editActivity')
      : tReminder('updateReminder')
    : effectiveMode === 'activity'
      ? t('createActivity')
      : tReminder('title');
  const submitLabel = isEdit
    ? tCommon('save')
    : effectiveMode === 'activity'
      ? t('createActivity')
      : tReminder('createReminder');

  const modeToggle = !isEdit && !lockedMode;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
            {dialogTitle}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4">
            <FormField
              label={t('titleLabel')}
              placeholder={effectiveMode === 'activity' ? t('titlePlaceholder') : tReminder('titlePlaceholder')}
              value={title}
              onChangeText={setTitle}
            />
            <FormField
              label={t('descriptionLabel')}
              placeholder={effectiveMode === 'activity' ? t('descriptionPlaceholder') : tReminder('descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
            />

            {modeToggle ? (
              <View className="rounded-xl border border-border dark:border-dark-border p-3">
                <Pressable
                  onPress={() =>
                    setEntityMode((m) =>
                      m === 'activity' ? 'reminder' : 'activity'
                    )
                  }
                  className="flex-row items-center gap-2"
                >
                  <View
                    className={cn(
                      'h-5 w-5 rounded border items-center justify-center',
                      entityMode === 'reminder'
                        ? 'bg-primary dark:bg-dark-primary border-primary dark:border-dark-primary'
                        : 'border-border dark:border-dark-border'
                    )}
                  >
                    {entityMode === 'reminder' ? (
                      <Check size={14} color={colors.primaryForeground} />
                    ) : null}
                  </View>
                  <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                    {tAct('modeReminder')}
                  </Text>
                </Pressable>
                <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                  {tAct('modeHint')}
                </Text>
              </View>
            ) : null}

            {effectiveMode === 'activity' ? (
              <>
                <Text className="text-sm text-foreground dark:text-dark-foreground">{t('frequency')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {FREQUENCIES.map((f) => (
                    <Pressable
                      key={f}
                      onPress={() => setFrequency(f)}
                      className={cn(
                        'px-3 py-2 rounded-lg border',
                        frequency === f
                          ? 'bg-primary dark:bg-dark-primary border-primary dark:border-dark-primary'
                          : 'border-border dark:border-dark-border'
                      )}
                    >
                      <Text className={cn(frequency === f ? 'text-primary-foreground dark:text-dark-primary-foreground' : 'text-muted dark:text-dark-muted')}>
                        {tAct(f)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {frequency === 'weekly' ? (
                  <>
                    <Text className="text-sm text-foreground dark:text-dark-foreground">{t('daysOfWeek')}</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {DAYS.map((d) => {
                        const active = selectedDays.includes(d);
                        return (
                          <Pressable key={d} onPress={() => toggleDay(d)} className={cn('px-3 py-2 rounded-lg border', active ? 'bg-primary dark:bg-dark-primary border-primary dark:border-dark-primary' : 'border-border dark:border-dark-border')}>
                            <Text className={cn(active ? 'text-primary-foreground dark:text-dark-primary-foreground' : 'text-muted dark:text-dark-muted')}>
                              {t(d)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                <Text className="text-sm text-foreground dark:text-dark-foreground">{t('timeOfDay')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {DAY_TIMES.map((dt) => (
                    <Pressable key={dt} onPress={() => setDayTime(dt)} className={cn('px-3 py-2 rounded-lg border', dayTime === dt ? 'bg-primary dark:bg-dark-primary border-primary dark:border-dark-primary' : 'border-border dark:border-dark-border')}>
                      <Text className={cn(dayTime === dt ? 'text-primary-foreground dark:text-dark-primary-foreground' : 'text-muted dark:text-dark-muted')}>
                        {tAct(dt)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <FormField
                  label={t('targetAmount')}
                  value={completionAmount}
                  onChangeText={setCompletionAmount}
                  keyboardType="number-pad"
                />
              </>
            ) : (
              <>
                <FormField
                  label={tReminder('dueDate')}
                  placeholder={tReminder('dueDatePlaceholder')}
                  value={dueDate}
                  onChangeText={setDueDate}
                  autoCapitalize="none"
                />
                <FormField
                  label={tReminder('windowEndTime')}
                  placeholder="HH:MM"
                  value={endTime}
                  onChangeText={setEndTime}
                  autoCapitalize="none"
                />
                {!hasWindow ? (
                  <Text className="text-xs text-muted dark:text-dark-muted -mt-2">
                    {tReminder('windowEndHint')}
                  </Text>
                ) : null}

                <View className="rounded-xl border border-border dark:border-dark-border p-3">
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
                      {hasWindow ? <Check size={14} color={colors.primaryForeground} /> : null}
                    </View>
                    <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                      {tReminder('activeWindow')}
                    </Text>
                  </Pressable>
                  <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                    {tReminder('activeWindowHint')}
                  </Text>

                  {hasWindow ? (
                    <View className="flex-row gap-3 mt-3">
                      <View className="flex-1">
                        <FormField label={tReminder('windowStartTime')} placeholder="HH:MM" value={startTime} onChangeText={setStartTime} autoCapitalize="none" />
                      </View>
                      <View className="flex-1">
                        <FormField label={tReminder('windowEndTime')} placeholder="HH:MM" value={endTime} onChangeText={setEndTime} autoCapitalize="none" />
                      </View>
                    </View>
                  ) : null}
                </View>
              </>
            )}

            <View className="flex-row gap-3 pt-2">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                {tCommon('cancel')}
              </Button>
              <Button className="flex-1" onPress={handleSubmit} loading={isSaving}>
                {submitLabel}
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
