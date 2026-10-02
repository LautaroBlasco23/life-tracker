import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Plus, Repeat, SlidersHorizontal, X, LayoutTemplate } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { activityService, useTranslations } from '@shared';
import type { Activity, DayTime, Frequency, DayOfWeek, StreakInfo } from '@shared/types/activity';
import { Navigation } from '../../components/navigation';
import { Button } from '../../components/ui/button';
import { ActivityCard } from '../../components/ui/activity-card';
import { ActivityFormModal } from '../../components/activity/activity-form-modal';
import { RoutinesModal } from '../../components/activity/routines-modal';
import { TemplatesModal } from '../../components/activity/templates-modal';
import type { ActivityTemplate } from '@shared/lib/activity-templates';
import { StreakBadge } from '../../components/ui/streak-badge';
import { DeleteModal } from '../../components/ui/delete-modal';
import { FilterModal, getActiveFilterCount } from '../../components/ui/filter-modal';
import type { FilterField, FilterState } from '../../components/ui/filter-modal';
import { showToast } from '../../components/ui/toast';
import { useTheme } from '../../lib/theme-provider';

const CATEGORY_ORDER: DayTime[] = ['notSpecified', 'morning', 'afternoon', 'evening'];

export default function ActivitiesScreen() {
  const t = useTranslations('activities');
  const tCommon = useTranslations('common');
  const tRoutines = useTranslations('routines');
  const tTemplates = useTranslations('activityTemplates');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [globalStreak, setGlobalStreak] = useState<StreakInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [showRoutines, setShowRoutines] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [prefill, setPrefill] = useState<{
    title: string;
    completionAmount: number;
    frequency: Frequency;
    dayTime: DayTime;
    dayFrequency?: DayOfWeek[];
  } | null>(null);
  const [filter, setFilter] = useState<FilterState>({});
  const [showFilterModal, setShowFilterModal] = useState(false);
  const { theme } = useTheme();
  const spinnerColor = theme === 'dark' ? '#61dafb' : '#0583f2';

  const filterFields: FilterField[] = [
    {
      id: 'frequency',
      label: t('frequency'),
      type: 'select',
      options: [
        { value: 'daily', label: t('daily') },
        { value: 'weekly', label: t('weekly') },
        { value: 'monthly', label: t('monthly') },
        { value: 'oneTime', label: t('oneTime') },
      ],
      placeholder: t('allFrequencies'),
    },
    {
      id: 'dayTime',
      label: t('timeOfDay'),
      type: 'select',
      options: [
        { value: 'notSpecified', label: t('anyMoment') },
        { value: 'morning', label: t('morning') },
        { value: 'afternoon', label: t('afternoon') },
        { value: 'evening', label: t('evening') },
      ],
      placeholder: t('allTimes'),
    },
    {
      id: 'scheduledFor',
      label: t('scheduledFor'),
      type: 'date',
    },
  ];

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
      showToast({ title: t('activityComplete'), description: t('activityAlreadyCompleted') });
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
      showToast({
        title: tCommon('error'),
        description: t('activityAlreadyCompleted'),
        variant: 'destructive',
      });
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

  const handleDeleteActivity = async () => {
    if (!deleting) return;
    try {
      await activityService.deleteActivity(deleting.id);
      setActivities((prev) => prev.filter((a) => a.id !== deleting.id));
      setDeleting(null);
    } catch {
      showToast({ title: t('deleteFailed'), variant: 'destructive' });
      throw new Error('delete failed');
    }
  };

  const handleLongPress = (activity: Activity) => {
    const options: Array<{ text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }> = [
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
    options.push({
      text: t('deleteActivity'),
      style: 'destructive',
      onPress: () => setDeleting(activity),
    });
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

  // Web parity: customize a template = prefill the create form.
  const handleCustomizeTemplate = (template: ActivityTemplate) => {
    setShowTemplates(false);
    setPrefill({
      title: tTemplates(`template_${template.key}`),
      completionAmount: template.completionAmount,
      frequency: template.frequency,
      dayTime: template.dayTime,
      dayFrequency: template.frequency === 'weekly' ? (template.dayFrequency ?? []) : undefined,
    });
    setEditing(null);
    setShowForm(true);
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    dayTime: cat,
    items: activities.filter((a) => a.dayTime === cat),
  })).filter((g) => g.items.length > 0);

  const filterCount = getActiveFilterCount(filter);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background">
        <ActivityIndicator color={spinnerColor} />
      </View>
    );
  }

  return (
    <View className="flex-1 relative bg-background dark:bg-dark-background">
      <Navigation />
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.dayTime}
        ListHeaderComponent={
          <View className="p-4 pb-2">
            <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
              {t('title')}
            </Text>
            <Text className="text-sm text-muted dark:text-dark-muted mt-1">{t('description')}</Text>

            <View className="flex-row items-center gap-2 mt-3 flex-wrap">
              <Button variant="outline" className="h-9" onPress={() => setShowRoutines(true)}>
                <View className="flex-row items-center gap-1.5">
                  <Repeat size={14} color={spinnerColor} />
                  <Text className="text-sm text-foreground dark:text-dark-foreground">
                    {tRoutines('title')}
                  </Text>
                </View>
              </Button>
              <Button variant="outline" className="h-9" onPress={() => { setPrefill(null); setShowTemplates(true); }}>
                <View className="flex-row items-center gap-1.5">
                  <LayoutTemplate size={14} color={spinnerColor} />
                  <Text className="text-sm text-foreground dark:text-dark-foreground">
                    {tTemplates('button')}
                  </Text>
                </View>
              </Button>
              <Button variant="outline" className="h-9" onPress={() => setShowFilterModal(true)}>
                <View className="flex-row items-center gap-1.5">
                  <SlidersHorizontal size={14} color={spinnerColor} />
                  <Text className="text-sm text-foreground dark:text-dark-foreground">
                    {tCommon('filters')}
                    {filterCount > 0 ? ` (${filterCount})` : ''}
                  </Text>
                </View>
              </Button>
              {filterCount > 0 ? (
                <Button variant="ghost" className="h-9" onPress={() => setFilter({})}>
                  <View className="flex-row items-center gap-1">
                    <X size={14} color={spinnerColor} />
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
                <StreakBadge current={globalStreak.current} />
                <View>
                  <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                    {t('globalStreakTitle')}
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
        prefill={prefill}
        onClose={() => { setShowForm(false); setEditing(null); setPrefill(null); }}
        onSaved={onSaved}
      />

      <RoutinesModal visible={showRoutines} onClose={() => setShowRoutines(false)} />

      <TemplatesModal
        visible={showTemplates}
        onClose={() => setShowTemplates(false)}
        onCreated={loadActivities}
        onCustomize={handleCustomizeTemplate}
      />

      <FilterModal
        visible={showFilterModal}
        fields={filterFields}
        currentFilter={filter}
        onApplyFilter={setFilter}
        onClose={() => setShowFilterModal(false)}
      />

      <DeleteModal
        visible={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('deleteActivity')}
        itemName={deleting?.title ?? ''}
        onConfirm={handleDeleteActivity}
      />
    </View>
  );
}
