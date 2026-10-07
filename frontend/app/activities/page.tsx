'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthGuard } from '@/components/auth-guard';
import { Navigation } from '@/components/navigation';
import { activityService } from '@shared/services/activity-service';
import { reminderService } from '@shared/services/reminder-service';
import type { Activity, DayTime } from '@shared/types/activity';
import type { StreakInfo } from '@shared/types/activity';
import type { Reminder } from '@shared/types/reminder';
import { isReminderVisibleOn } from '@shared/types/reminder';
import { StreakBadge } from '@/components/ui/streak-badge';

import {
  Plus,
  Sun,
  CloudSun,
  Moon,
  Filter,
  X,
  Undo2,
  Clock,
  Flame,
  Repeat,
  LayoutTemplate,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { ActivityFilter } from '@shared/types';
import { CategoryHeader } from '@/components/ui/category/categoryHeader';
import { EntityCard } from '@/components/ui/card/entityCard';
import { ActivityFormModal } from './modal/activity-form-modal';
import type { ActivityFormInitialValues } from './modal/activity-form-modal';
import { ReminderSection } from './components/reminder-section';
import { RoutinesModal } from './modal/routines-modal';
import { TemplatesModal } from './modal/templates-modal';
import type { ActivityTemplate } from '@shared/lib/activity-templates';

import { FilterSidebar } from '@/components/ui/filterModal/filterSidebar';
import { useTranslations } from '@shared/contexts/language-context';

type ViewMode = 'today' | 'filtered';

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isToday(dateString?: string): boolean {
  if (!dateString) return true;
  const target = parseLocalDate(dateString);
  const today = new Date();
  return (
    target.getFullYear() === today.getFullYear() &&
    target.getMonth() === today.getMonth() &&
    target.getDate() === today.getDate()
  );
}

function formatDateLabel(dateString?: string): string {
  if (!dateString || isToday(dateString)) return 'today';
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toCompletionDateISO(dateString?: string): string | undefined {
  if (!dateString || isToday(dateString)) return undefined;
  const date = parseLocalDate(dateString);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

function formatDayFrequency(dayFrequency?: string): string | null {
  if (!dayFrequency) return null;
  try {
    const days: string[] = JSON.parse(dayFrequency);
    return days
      .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
      .join(', ');
  } catch {
    return null;
  }
}

export default function ActivitiesPage() {
  const t = useTranslations('activities');
  const tRoutines = useTranslations('routines');
  const tReminders = useTranslations('reminders');
  const tCommon = useTranslations('common');
  const tTemplates = useTranslations('activityTemplates');

  const CATEGORY_CONFIG = {
    notSpecified: {
      label: t('anyMoment'),
      icon: Clock,
      description: t('flexibleTiming'),
      accentColor: 'border-slate-400',
      iconColor: 'text-slate-500',
    },
    morning: {
      label: t('morning'),
      icon: Sun,
      description: t('startYourDay'),
      accentColor: 'border-amber-400',
      iconColor: 'text-amber-500',
    },
    afternoon: {
      label: t('afternoon'),
      icon: CloudSun,
      description: t('keepMomentum'),
      accentColor: 'border-sky-400',
      iconColor: 'text-sky-500',
    },
    evening: {
      label: t('evening'),
      icon: Moon,
      description: t('windDown'),
      accentColor: 'border-indigo-400',
      iconColor: 'text-indigo-500',
    },
  } as const;

  const FREQUENCY_OPTIONS = [
    { value: 'daily', label: t('daily') },
    { value: 'weekly', label: t('weekly') },
    { value: 'monthly', label: t('monthly') },
  ];

  const DAY_TIME_OPTIONS = [
    { value: 'notSpecified', label: t('anyMoment') },
    { value: 'morning', label: t('morning') },
    { value: 'afternoon', label: t('afternoon') },
    { value: 'evening', label: t('evening') },
  ];

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showRoutinesModal, setShowRoutinesModal] = useState(false);
  const [initialRoutineId, setInitialRoutineId] = useState<number | null>(null);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [createInitialValues, setCreateInitialValues] =
    useState<ActivityFormInitialValues | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>({});
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [globalStreak, setGlobalStreak] = useState<StreakInfo | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminderProcessingIds, setReminderProcessingIds] = useState<
    Set<number>
  >(new Set());
  const [now, setNow] = useState(() => new Date());

  const targetDate =
    viewMode === 'filtered' ? activeFilter.scheduledFor : undefined;
  const dateLabel = formatDateLabel(targetDate);

  // Reminders shown for the date the page is displaying. Pending/missed ones
  // stay visible on today's view; completed ones only show on their due day.
  const visibleReminders = reminders.filter((reminder) =>
    isReminderVisibleOn(
      reminder,
      targetDate ? parseLocalDate(targetDate) : now,
      now
    )
  );

  useEffect(() => {
    activityService
      .getGlobalStreak()
      .then(setGlobalStreak)
      .catch(() => setGlobalStreak(null));
  }, []);

  const loadActivities = useCallback(async () => {
    try {
      setIsLoading(true);
      const userActivities =
        viewMode === 'today'
          ? await activityService.getTodayActivities()
          : await activityService.getActivities(activeFilter);
      setActivities(userActivities);
    } catch (error) {
      console.error('Failed to load activities:', error);
      showToast({
        title: t('failedToLoad'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [viewMode, activeFilter]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Reminders: loaded once on mount; kept in sync via local handlers below.
  const loadReminders = useCallback(async () => {
    try {
      setReminders(await reminderService.getReminders());
    } catch (error) {
      console.error('Failed to load reminders:', error);
    }
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  // 30s tick: re-derives reminder statuses (locked → active, etc.) without
  // reloading. Minute precision is enough for reminders.
  useEffect(() => {
    if (reminders.length === 0) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [reminders.length]);

  const updateReminderState = (updated: Reminder) => {
    setReminders((prev) =>
      prev.map((reminder) => (reminder.id === updated.id ? updated : reminder))
    );
  };

  const setReminderProcessing = (id: number, processing: boolean) => {
    setReminderProcessingIds((prev) => {
      const next = new Set(prev);
      if (processing) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleReminderCreated = (newReminder: Reminder) => {
    setReminders((prev) => [newReminder, ...prev]);
  };

  const handleReminderUpdated = (updated: Reminder) => {
    updateReminderState(updated);
    setEditingReminder(null);
  };

  const handleEditReminder = (reminder: Reminder) => {
    setEditingActivity(null);
    setEditingReminder(reminder);
    setShowEditModal(true);
  };

  const handleCompleteReminder = async (reminder: Reminder) => {
    if (reminder.completedAt) return;
    setReminderProcessing(reminder.id, true);
    const optimistic = { ...reminder, completedAt: new Date().toISOString() };
    updateReminderState(optimistic);

    try {
      const completed = await reminderService.completeReminder(reminder.id);
      updateReminderState(completed);
      showToast({
        title: tReminders('reminderComplete'),
        description: tReminders('reminderCompletedDescription', {
          title: reminder.title,
        }),
      });
    } catch (error) {
      updateReminderState(reminder);
      showToast({
        title: tCommon('error'),
        description:
          error instanceof Error
            ? error.message
            : 'Failed to complete reminder',
        variant: 'destructive',
      });
    } finally {
      setReminderProcessing(reminder.id, false);
    }
  };

  const handleRevertReminder = async (reminder: Reminder) => {
    setReminderProcessing(reminder.id, true);
    const optimistic = { ...reminder, completedAt: null };
    updateReminderState(optimistic);

    try {
      await reminderService.revertCompletion(reminder.id);
      showToast({
        title: tReminders('completionReverted'),
        description: tReminders('revertDescription', { title: reminder.title }),
      });
    } catch (error) {
      updateReminderState(reminder);
      showToast({
        title: tCommon('error'),
        description:
          error instanceof Error
            ? error.message
            : 'Failed to revert completion',
        variant: 'destructive',
      });
    } finally {
      setReminderProcessing(reminder.id, false);
    }
  };

  const handleDeleteReminder = async (reminderId: number) => {
    try {
      await reminderService.deleteReminder(reminderId);
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
      showToast({
        title: tReminders('reminderDeleted'),
        description: tReminders('reminderDeletedDescription'),
      });
    } catch (error) {
      showToast({
        title: tReminders('deleteFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleApplyFilter = (filter: ActivityFilter) => {
    const hasFilters = Object.keys(filter).length > 0;
    setActiveFilter(filter);
    setViewMode(hasFilters ? 'filtered' : 'today');
  };

  const handleClearFilters = () => {
    setActiveFilter({});
    setViewMode('today');
  };

  const getActiveFilterCount = (): number => {
    return Object.values(activeFilter).filter(Boolean).length;
  };

  const handleDeleteActivity = async (activityId: number) => {
    try {
      await activityService.deleteActivity(activityId);
      setActivities(
        activities.filter((activity) => activity.id !== activityId)
      );
      showToast({
        title: t('activityDeleted'),
        description: t('activityDeletedDescription'),
      });
    } catch (error) {
      showToast({
        title: t('deleteFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleActivityCreated = (newActivity: Activity) => {
    if (viewMode === 'today') {
      loadActivities();
    } else {
      setActivities([newActivity, ...activities]);
    }
    setShowCreateModal(false);
  };

  const handleActivityUpdated = (updatedActivity: Activity) => {
    setActivities(
      activities.map((activity) =>
        activity.id === updatedActivity.id ? updatedActivity : activity
      )
    );
    setShowEditModal(false);
    setEditingActivity(null);
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setShowEditModal(true);
  };

  const handleCustomizeTemplate = (template: ActivityTemplate) => {
    setShowTemplatesModal(false);
    setCreateInitialValues({
      title: tTemplates(`template_${template.key}`),
      description: '',
      completionAmount: template.completionAmount,
      frequency: template.frequency,
      dayFrequency:
        template.frequency === 'weekly'
          ? (template.dayFrequency ?? [])
          : undefined,
      dayTime: template.dayTime,
      privacyStatus: 'private',
    });
    setShowCreateModal(true);
  };

  const updateActivity = (updatedActivity: Activity) => {
    setActivities(
      activities.map((activity) =>
        activity.id === updatedActivity.id ? updatedActivity : activity
      )
    );
  };

  const handleRecordCompletion = async (activity: Activity) => {
    if (activity.isCompletedToday) {
      showToast({
        title: t('activityComplete'),
        description: t('activityAlreadyCompleted', { date: dateLabel }),
        variant: 'default',
      });
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(activity.id));

    const newCompletions = activity.todayCompletions + 1;
    const isNowCompleted = newCompletions >= activity.completionAmount;

    const optimisticActivity: Activity = {
      ...activity,
      todayCompletions: newCompletions,
      isCompletedToday: isNowCompleted,
      streak:
        isNowCompleted && activity.streak
          ? {
              current: activity.streak.current + 1,
              longest: Math.max(
                activity.streak.longest,
                activity.streak.current + 1
              ),
            }
          : activity.streak,
    };
    updateActivity(optimisticActivity);

    try {
      const completionDate = toCompletionDateISO(targetDate);
      await activityService.recordActivity(activity.id, { completionDate });

      showToast({
        title: isNowCompleted ? t('activityCompleted') : t('progressUpdated'),
        description: isNowCompleted
          ? t('greatJob', { title: activity.title, date: dateLabel })
          : t('progress', {
              current: newCompletions,
              total: activity.completionAmount,
            }),
        variant: 'default',
      });
    } catch (error) {
      updateActivity(activity);
      showToast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to record completion',
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

    const optimisticActivity: Activity = {
      ...activity,
      todayCompletions: newCompletions,
      isCompletedToday: isStillCompleted,
      streak:
        wasCompleted && !isStillCompleted && activity.streak
          ? {
              current: Math.max(0, activity.streak.current - 1),
              longest: activity.streak.longest,
            }
          : activity.streak,
    };
    updateActivity(optimisticActivity);

    try {
      const revertDate = toCompletionDateISO(targetDate);
      await activityService.revertLastCompletion(activity.id, revertDate);

      showToast({
        title: t('completionReverted'),
        description: t('revertedDescription', {
          title: activity.title,
          date: dateLabel,
        }),
        variant: 'default',
      });
    } catch (error) {
      updateActivity(activity);
      showToast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to revert completion',
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

  const activitiesByCategory = activities.reduce(
    (acc, activity) => {
      const dayTime = activity.dayTime;
      if (!acc[dayTime]) {
        acc[dayTime] = [];
      }
      acc[dayTime].push(activity);
      return acc;
    },
    {} as Record<DayTime, Activity[]>
  );

  const filterCount = getActiveFilterCount();

  const getPageTitle = (): string => {
    if (viewMode === 'today') return t('title');
    if (activeFilter.scheduledFor) {
      const date = parseLocalDate(activeFilter.scheduledFor);
      return t('titleForDate', { date: date.toLocaleDateString() });
    }
    return t('titleFiltered');
  };

  const getPageDescription = (): string => {
    if (viewMode === 'today') return t('description');
    const parts: string[] = [];
    if (activeFilter.frequency) parts.push(t(activeFilter.frequency));
    if (activeFilter.dayTime) parts.push(t(activeFilter.dayTime));
    return parts.length > 0
      ? t('descriptionShowing', { parts: parts.join(', ') })
      : t('descriptionFiltered');
  };

  const buildActivityBadges = (activity: Activity) => {
    const badges: Array<{
      label: string;
      variant: 'outline' | 'default' | 'secondary';
      onClick?: () => void;
    }> = [{ label: t(activity.frequency), variant: 'outline' }];
    const formattedDays = formatDayFrequency(activity.dayFrequency);
    if (activity.frequency === 'weekly' && formattedDays) {
      badges.push({ label: formattedDays, variant: 'outline' });
    }
    for (const routine of activity.routines ?? []) {
      badges.push({
        label: routine.title,
        variant: 'secondary',
        onClick: () => {
          setInitialRoutineId(routine.id);
          setShowRoutinesModal(true);
        },
      });
    }
    return badges;
  };

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
          <Navigation />
          <div className="flex items-center justify-center h-[calc(100vh-4rem)] lg:h-screen">
            <div className="text-muted-foreground">
              {t('loadingActivities')}
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
        <Navigation />
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="flex flex-col gap-4 mb-8 md:hidden">
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-1">
                {getPageTitle()}
              </h1>
              <p className="text-sm text-muted-foreground">
                {getPageDescription()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInitialRoutineId(null);
                  setShowRoutinesModal(true);
                }}
                className="flex items-center gap-2"
              >
                <Repeat className="h-4 w-4" />
                {tRoutines('title')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilterSidebar(true)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                {tCommon('filters')}
                {filterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 w-5 p-0 flex items-center justify-center"
                  >
                    {filterCount}
                  </Badge>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplatesModal(true)}
                className="flex items-center gap-2"
              >
                <LayoutTemplate className="h-4 w-4" />
                {tTemplates('button')}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('newActivity')}
              </Button>
            </div>
          </div>

          <div className="hidden md:flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-2">
                {getPageTitle()}
              </h1>
              <p className="text-muted-foreground">{getPageDescription()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setInitialRoutineId(null);
                  setShowRoutinesModal(true);
                }}
                className="flex items-center gap-2"
              >
                <Repeat className="h-4 w-4" />
                {tRoutines('title')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFilterSidebar(true)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                {tCommon('filters')}
                {filterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 w-5 p-0 flex items-center justify-center"
                  >
                    {filterCount}
                  </Badge>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowTemplatesModal(true)}
                className="flex items-center gap-2"
              >
                <LayoutTemplate className="h-4 w-4" />
                {tTemplates('button')}
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('newActivity')}
              </Button>
            </div>
          </div>

          {viewMode === 'filtered' && filterCount > 0 && (
            <div className="mb-6 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {tCommon('activeFilters')}
              </span>
              <div className="flex flex-wrap gap-2">
                {activeFilter.frequency && (
                  <Badge variant="secondary">{t(activeFilter.frequency)}</Badge>
                )}
                {activeFilter.dayTime && (
                  <Badge variant="secondary">{t(activeFilter.dayTime)}</Badge>
                )}
                {activeFilter.scheduledFor && (
                  <Badge variant="secondary">
                    {parseLocalDate(
                      activeFilter.scheduledFor
                    ).toLocaleDateString()}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-6 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  {tCommon('clearAll')}
                </Button>
              </div>
            </div>
          )}

          {viewMode === 'today' && globalStreak && globalStreak.current > 0 && (
            <Card className="mb-6 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-900/50">
              <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Flame
                    className="h-6 w-6 text-orange-500"
                    fill="currentColor"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      {t('globalStreakTitle')}
                      <StreakBadge
                        current={globalStreak.current}
                        showZero
                        size="sm"
                      />
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('globalStreak', { count: globalStreak.current })}
                      {globalStreak.longest > globalStreak.current && (
                        <span className="ml-2">
                          {t('globalStreakLongest', {
                            count: globalStreak.longest,
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activities.length === 0 ? (
            <Card className="text-center py-12 bg-muted/30">
              <CardContent>
                <div className="text-muted-foreground mb-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {viewMode === 'today'
                      ? t('noActivitiesForToday')
                      : t('noActivitiesMatch')}
                  </h3>
                  <p>
                    {viewMode === 'today'
                      ? t('createToSeeHere')
                      : t('tryAdjustingFilters')}
                  </p>
                </div>
                {viewMode === 'filtered' ? (
                  <Button variant="outline" onClick={handleClearFilters}>
                    {tCommon('clearFilters')}
                  </Button>
                ) : (
                  <Button onClick={() => setShowCreateModal(true)}>
                    {t('createFirstActivity')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {(Object.keys(CATEGORY_CONFIG) as DayTime[]).map((dayTime) => {
                const categoryActivities = activitiesByCategory[dayTime] || [];
                const config = CATEGORY_CONFIG[dayTime];

                if (categoryActivities.length === 0) return null;

                return (
                  <div key={dayTime} className="space-y-4">
                    <CategoryHeader
                      icon={config.icon}
                      label={config.label}
                      description={config.description}
                      accentColor={config.accentColor}
                      iconColor={config.iconColor}
                      summaryValue={categoryActivities.length.toString()}
                      summaryLabel={tCommon('total')}
                      itemCount={categoryActivities.length}
                      itemName="activity"
                    />
                    <div className="space-y-4">
                      {categoryActivities.map((activity) => (
                        <EntityCard
                          key={activity.id}
                          title={activity.title}
                          subtitle={activity.description}
                          badges={buildActivityBadges(activity)}
                          progress={{
                            current: activity.todayCompletions,
                            total: activity.completionAmount,
                            completedLabel: t('complete'),
                            incompleteHint: t('tapToComplete'),
                          }}
                          streak={activity.streak}
                          isCompleted={activity.isCompletedToday}
                          onClick={() => handleRecordCompletion(activity)}
                          onEdit={() => handleEditActivity(activity)}
                          onDelete={() => handleDeleteActivity(activity.id)}
                          isProcessing={processingIds.has(activity.id)}
                          extraMenuItems={
                            activity.todayCompletions > 0
                              ? [
                                  {
                                    label: t('revertLast'),
                                    icon: Undo2,
                                    onClick: () =>
                                      handleRevertCompletion(activity),
                                    disabled: processingIds.has(activity.id),
                                  },
                                ]
                              : undefined
                          }
                          deleteModal={{
                            title: t('deleteActivity'),
                            itemName: activity.title,
                            confirmLabel: t('deleteActivity'),
                            itemDetails: (
                              <div className="text-sm">
                                <div className="font-medium text-foreground mb-1">
                                  {activity.title}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {activity.description && (
                                    <div className="mb-1">
                                      {activity.description}
                                    </div>
                                  )}
                                  <div>
                                    {t(activity.frequency)} •{' '}
                                    {t(activity.dayTime)} •{t('target')}{' '}
                                    {activity.completionAmount}
                                  </div>
                                </div>
                              </div>
                            ),
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <ReminderSection
            reminders={visibleReminders}
            now={now}
            processingIds={reminderProcessingIds}
            onComplete={handleCompleteReminder}
            onRevert={handleRevertReminder}
            onDelete={handleDeleteReminder}
            onEdit={handleEditReminder}
          />

          <ActivityFormModal
            open={showCreateModal || showEditModal}
            onOpenChange={(open) => {
              setShowCreateModal(open);
              setShowEditModal(open);
              if (!open) {
                setCreateInitialValues(null);
                setEditingActivity(null);
                setEditingReminder(null);
              }
            }}
            activity={editingActivity}
            reminder={editingReminder}
            initialValues={createInitialValues}
            onActivityCreated={handleActivityCreated}
            onActivityUpdated={handleActivityUpdated}
            onReminderCreated={handleReminderCreated}
            onReminderUpdated={handleReminderUpdated}
          />
          <FilterSidebar
            open={showFilterSidebar}
            onOpenChange={setShowFilterSidebar}
            currentFilter={activeFilter}
            onApplyFilter={handleApplyFilter}
            title={t('filterActivities')}
            fields={[
              {
                id: 'frequency',
                label: t('frequency'),
                type: 'select',
                options: FREQUENCY_OPTIONS,
                placeholder: t('allFrequencies'),
              },
              {
                id: 'dayTime',
                label: t('timeOfDay'),
                type: 'select',
                options: DAY_TIME_OPTIONS,
                placeholder: t('allTimes'),
              },
              {
                id: 'scheduledFor',
                label: t('scheduledFor'),
                type: 'date',
                helperText: t('showForDate'),
              },
            ]}
          />
          <RoutinesModal
            open={showRoutinesModal}
            onOpenChange={setShowRoutinesModal}
            initialRoutineId={initialRoutineId}
          />
          <TemplatesModal
            open={showTemplatesModal}
            onOpenChange={setShowTemplatesModal}
            onCreated={loadActivities}
            onCustomize={handleCustomizeTemplate}
          />
        </div>
      </div>
    </AuthGuard>
  );
}
