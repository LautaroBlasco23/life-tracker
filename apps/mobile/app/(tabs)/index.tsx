import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, View, type AlertButton } from 'react-native';
import { Plus, Flame, SlidersHorizontal, X } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { activityService, useTranslations } from '@shared';
import type { Activity, DayTime, StreakInfo } from '@shared/types/activity';
import { Button } from '../../components/ui/button';
import { ActivityCard } from '../../components/ui/activity-card';
import { ActivityFormModal } from '../../components/activity/activity-form-modal';
import { OptionSelect } from '../../components/ui/option-select';
import { FormField } from '../../components/ui/form-field';
import { useTheme } from '../../lib/theme-provider';

const CATEGORY_ORDER: DayTime[] = ['notSpecified', 'morning', 'afternoon', 'evening'];

interface ActivityFilterState extends Record<string, string | undefined> {
  frequency?: string;
  dayTime?: string;
  scheduledFor?: string;
}

export default function ActivitiesScreen() {
  const t = useTranslations('activities');
  const tCommon = useTranslations('common');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [globalStreak, setGlobalStreak] = useState<StreakInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [filter, setFilter] = useState<ActivityFilterState>({});
  const [showFilterModal, setShowFilterModal] = useState(false);
  const { theme } = useTheme();

  const loadActivities = useCallback(async () => {
    try {
      const hasFilter = Object.values(filter).some((v) => v !== undefined);
      const [items, streak] = await Promise.all([
        hasFilter ? activityService.getActivities(filter) : activityService.getTodayActivities(),
        activityService.getGlobalStreak(),
      ]);
      setActivities(items);
      setGlobalStreak(streak);
      setError(null);
    } catch {
      setError(t('failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t, filter]);

  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [loadActivities])
  );

  const updateActivity = (updated: Activity) => {
    setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleRecordCompletion = async (activity: Activity) => {
    if (activity.isCompletedToday) {
      Alert.alert(t('activityComplete'), t('activityAlreadyCompleted'));
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(activity.id));
    const newCompletions = activity.todayCompletions + 1;
    const isNowCompleted = newCompletions >= activity.completionAmount;

    const optimistic: Activity = {
      ...activity,
      todayCompletions: newCompletions,
      isCompletedToday: isNowCompleted,
      streak:
        isNowCompleted && activity.streak
          ? {
              current: activity.streak.current + 1,
              longest: Math.max(activity.streak.longest, activity.streak.current + 1),
            }
          : activity.streak,
    };
    updateActivity(optimistic);

    try {
      await activityService.recordActivity(activity.id, {});
    } catch {
      updateActivity(activity);
      Alert.alert('Error', t('activityAlreadyCompleted'));
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(activity.id);
        return next;
      });
    }
  };

  const handleRevertCompletion = async (activity: Activity) => {
    setProcessingIds((prev) => new Set(prev).add(activity.id));
    const newCompletions = Math.max(0, activity.todayCompletions - 1);
    const wasCompleted = activity.isCompletedToday;
    const isStillCompleted = newCompletions >= activity.completionAmount;

    const optimistic: Activity = {
      ...activity,
      todayCompletions: newCompletions,
      isCompletedToday: isStillCompleted,
      streak:
        wasCompleted && !isStillCompleted && activity.streak
          ? { current: Math.max(0, activity.streak.current - 1), longest: activity.streak.longest }
          : activity.streak,
    };
    updateActivity(optimistic);

    try {
      await activityService.revertLastCompletion(activity.id);
    } catch {
      updateActivity(activity);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(activity.id);
        return next;
      });
    }
  };

  const handleDeleteActivity = (activity: Activity) => {
    Alert.alert(t('deleteActivity'), activity.title, [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: tCommon('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await activityService.deleteActivity(activity.id);
            setActivities((prev) => prev.filter((a) => a.id !== activity.id));
          } catch {
            Alert.alert('Error', t('deleteFailed'));
          }
        },
      },
    ]);
  };

  const handleLongPress = (activity: Activity) => {
    const options: AlertButton[] = [
      {
        text: t('editActivity'),
        onPress: () => {
          setEditing(activity);
          setShowForm(true);
        },
      },
    ];
    if (activity.todayCompletions > 0) {
      options.push({ text: t('revertLast'), onPress: () => handleRevertCompletion(activity) });
    }
    options.push({ text: t('deleteActivity'), style: 'destructive', onPress: () => handleDeleteActivity(activity) });
    options.push({ text: tCommon('cancel'), style: 'cancel' });

    Alert.alert(activity.title, undefined, options);
  };

  const onSaved = (saved: Activity) => {
    setActivities((prev) => {
      const exists = prev.some((a) => a.id === saved.id);
      return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
    });
    setEditing(null);
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    dayTime: cat,
    items: activities.filter((a) => a.dayTime === cat),
  })).filter((g) => g.items.length > 0);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background">
        <ActivityIndicator color={theme === 'dark' ? '#61dafb' : '#0583f2'} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-dark-background">
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.dayTime}
        ListHeaderComponent={
          <View className="p-4 pb-2">
            <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
              {t('title')}
            </Text>
            <Text className="text-sm text-muted dark:text-dark-muted mt-1">{t('description')}</Text>

            <View className="flex-row items-center gap-2 mt-3">
              <Button variant="outline" className="h-9" onPress={() => setShowFilterModal(true)}>
                <View className="flex-row items-center gap-1.5">
                  <SlidersHorizontal size={14} color={theme === 'dark' ? '#61dafb' : '#0583f2'} />
                  <Text className="text-sm text-foreground dark:text-dark-foreground">
                    {t('filterActivities')}
                  </Text>
                </View>
              </Button>
              {Object.values(filter).some((v) => v !== undefined) ? (
                <Button variant="ghost" className="h-9" onPress={() => setFilter({})}>
                  <View className="flex-row items-center gap-1">
                    <X size={14} color={theme === 'dark' ? '#61dafb' : '#0583f2'} />
                    <Text className="text-sm text-primary dark:text-dark-primary">
                      {tCommon('clearFilters')}
                    </Text>
                  </View>
                </Button>
              ) : null}
            </View>

            {error ? (
              <Text className="text-danger dark:text-dark-danger text-sm mt-3">{error}</Text>
            ) : null}

            {globalStreak && globalStreak.current > 0 ? (
              <View className="mt-4 flex-row items-center gap-3 rounded-xl border border-warning/40 dark:border-dark-warning/40 p-4">
                <Flame size={24} color="#e3b341" fill="#e3b341" />
                <View>
                  <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                    {t('globalStreakTitle')} — {globalStreak.current}
                  </Text>
                  <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                    {t('globalStreak', { count: globalStreak.current })}
                    {globalStreak.longest > globalStreak.current
                      ? ` ${t('globalStreakLongest', { count: globalStreak.longest })}`
                      : ''}
                  </Text>
                </View>
              </View>
            ) : null}

            {activities.length === 0 && !error ? (
              <View className="mt-8 items-center">
                <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
                  {t('noActivitiesForToday')}
                </Text>
                <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                  {t('createToSeeHere')}
                </Text>
                <Button className="mt-4" onPress={() => { setEditing(null); setShowForm(true); }}>
                  {t('createFirstActivity')}
                </Button>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View className="px-4 pb-2">
            <Text className="text-sm font-medium text-muted dark:text-dark-muted mb-2">
              {t(item.dayTime)}
            </Text>
            <View className="space-y-2">
              {item.items.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  isProcessing={processingIds.has(activity.id)}
                  onPress={() => handleRecordCompletion(activity)}
                  onLongPress={() => handleLongPress(activity)}
                />
              ))}
            </View>
          </View>
        )}
        contentContainerClassName="pb-24"
      />

      <Pressable
        onPress={() => { setEditing(null); setShowForm(true); }}
        className="absolute bottom-6 right-5 h-14 w-14 rounded-full bg-primary dark:bg-dark-primary items-center justify-center shadow-lg"
      >
        <Plus size={26} color="#0d1117" />
      </Pressable>

      <ActivityFormModal
        visible={showForm}
        activity={editing}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSaved={onSaved}
      />

      <Modal visible={showFilterModal} animationType="fade" transparent onRequestClose={() => setShowFilterModal(false)}>
        <View className="flex-1 justify-center bg-black/50 p-6">
          <View className="rounded-2xl bg-background dark:bg-dark-background p-5">
            <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-4">
              {t('filterActivities')}
            </Text>
            <ActivityFilterForm
              initial={filter}
              onApply={(f) => {
                setFilter(f);
                setShowFilterModal(false);
              }}
              onCancel={() => setShowFilterModal(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ActivityFilterForm({
  initial,
  onApply,
  onCancel,
}: {
  initial: ActivityFilterState;
  onApply: (filter: ActivityFilterState) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('activities');
  const tCommon = useTranslations('common');
  const [frequency, setFrequency] = useState<string | null>(initial.frequency ?? null);
  const [dayTime, setDayTime] = useState<string | null>(initial.dayTime ?? null);
  const [scheduledFor, setScheduledFor] = useState(initial.scheduledFor ?? '');

  return (
    <View>
      <OptionSelect
        label={t('frequency')}
        value={frequency}
        options={[
          { value: 'daily', label: t('daily') },
          { value: 'weekly', label: t('weekly') },
          { value: 'monthly', label: t('monthly') },
          { value: 'oneTime', label: t('oneTime') },
        ]}
        onSelect={setFrequency}
        placeholder={t('allFrequencies')}
      />
      <View className="h-4" />
      <OptionSelect
        label={t('timeOfDay')}
        value={dayTime}
        options={[
          { value: 'notSpecified', label: t('anyMoment') },
          { value: 'morning', label: t('morning') },
          { value: 'afternoon', label: t('afternoon') },
          { value: 'evening', label: t('evening') },
        ]}
        onSelect={setDayTime}
        placeholder={t('allTimes')}
      />
      <View className="h-4" />
      <FormField
        label={t('scheduledFor')}
        placeholder="YYYY-MM-DD"
        value={scheduledFor}
        onChangeText={setScheduledFor}
      />
      <View className="flex-row gap-3 mt-5">
        <Button variant="outline" className="flex-1" onPress={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button
          className="flex-1"
          onPress={() =>
            onApply({
              frequency: frequency ?? undefined,
              dayTime: dayTime ?? undefined,
              scheduledFor: scheduledFor.trim() || undefined,
            })
          }
        >
          {tCommon('save')}
        </Button>
      </View>
    </View>
  );
}
