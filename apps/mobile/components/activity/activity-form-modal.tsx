import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { activityService, useTranslations } from '@shared';
import type { Activity, DayOfWeek, DayTime, Frequency } from '@shared/types/activity';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { cn } from '../../lib/cn';

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'oneTime'];
const DAY_TIMES: DayTime[] = ['notSpecified', 'morning', 'afternoon', 'evening'];
const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface Props {
  visible: boolean;
  activity?: Activity | null; // null/undefined = create
  onClose: () => void;
  onSaved: (activity: Activity) => void;
}

export function ActivityFormModal({ visible, activity, onClose, onSaved }: Props) {
  const t = useTranslations('createActivity');
  const tAct = useTranslations('activities');
  const tCommon = useTranslations('common');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [completionAmount, setCompletionAmount] = useState('1');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [dayTime, setDayTime] = useState<DayTime>('notSpecified');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = Boolean(activity);

  useEffect(() => {
    if (visible) {
      setTitle(activity?.title ?? '');
      setDescription(activity?.description ?? '');
      setCompletionAmount(String(activity?.completionAmount ?? 1));
      setFrequency(activity?.frequency ?? 'daily');
      setDayTime(activity?.dayTime ?? 'notSpecified');
      setSelectedDays(activity?.dayFrequency ? (JSON.parse(activity.dayFrequency) as DayOfWeek[]) : []);
    }
  }, [visible, activity]);

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = async () => {
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
            {isEdit ? t('title') : t('createActivity')}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" className="space-y-4">
            <FormField
              label={t('titleLabel')}
              placeholder={t('titlePlaceholder')}
              value={title}
              onChangeText={setTitle}
            />
            <FormField
              label={t('descriptionLabel')}
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
            />

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
                  <Text className={cn(frequency === f ? 'text-secondaryForeground dark:text-dark-secondaryForeground' : 'text-muted dark:text-dark-muted')}>
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
                        <Text className={cn(active ? 'text-secondaryForeground dark:text-dark-secondaryForeground' : 'text-muted dark:text-dark-muted')}>
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
                  <Text className={cn(dayTime === dt ? 'text-secondaryForeground dark:text-dark-secondaryForeground' : 'text-muted dark:text-dark-muted')}>
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

            <View className="flex-row gap-3 pt-2">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                {tCommon('cancel')}
              </Button>
              <Button className="flex-1" onPress={handleSubmit} loading={isSaving}>
                {isSaving ? t('creating') : isEdit ? tCommon('save') : t('createActivity')}
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
