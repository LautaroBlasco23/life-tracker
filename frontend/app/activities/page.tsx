'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthGuard } from '@/components/auth-guard';
import { Navigation } from '@/components/navigation';
import { activityService } from '@/services/activity-service';
import type { Activity, DayTime } from '@/types/activity';
import {
  Plus,
  Sun,
  CloudSun,
  Moon,
  Filter,
  X,
  Undo2,
  Clock,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { ActivityFilter } from '@/types';
import { CategoryHeader } from '@/components/ui/category/categoryHeader';
import { EntityCard } from '@/components/ui/card/entityCard';
import { CreateActivityModal } from './modal/create-activity-modal';
import { EditActivityModal } from './modal/edit-activity-modal';
import { GenericFilterModal } from '@/components/ui/filterModal/filterModal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from '@/contexts/language-context';

type DayTimeFilter = 'all' | 'morning' | 'afternoon' | 'evening';

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
  const tCommon = useTranslations('common');

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
    { value: 'oneTime', label: t('oneTime') },
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
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>({});
  const [activeDayTime, setActiveDayTime] = useState<DayTimeFilter>('all');
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  const targetDate =
    viewMode === 'filtered' ? activeFilter.scheduledFor : undefined;
  const dateLabel = formatDateLabel(targetDate);

  const filteredActivities =
    activeDayTime === 'all'
      ? activities
      : activities.filter((activity) => activity.dayTime === activeDayTime);

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

  const activitiesByCategory = filteredActivities.reduce(
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
    const badges: Array<{ label: string; variant: 'outline' | 'default' }> = [
      { label: t(activity.frequency), variant: 'outline' },
    ];
    const formattedDays = formatDayFrequency(activity.dayFrequency);
    if (activity.frequency === 'weekly' && formattedDays) {
      badges.push({ label: formattedDays, variant: 'outline' });
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
                onClick={() => setShowFilterModal(true)}
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
                onClick={() => setShowFilterModal(true)}
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
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('newActivity')}
              </Button>
            </div>
          </div>

          <Tabs
            value={activeDayTime}
            onValueChange={(value) => setActiveDayTime(value as DayTimeFilter)}
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">{t('all')}</TabsTrigger>
              <TabsTrigger value="morning">{t('morning')}</TabsTrigger>
              <TabsTrigger value="afternoon">{t('afternoon')}</TabsTrigger>
              <TabsTrigger value="evening">{t('evening')}</TabsTrigger>
            </TabsList>
          </Tabs>

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

          {filteredActivities.length === 0 ? (
            <Card className="text-center py-12 bg-muted/30">
              <CardContent>
                <div className="text-muted-foreground mb-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {activeDayTime !== 'all'
                      ? t('noActivitiesForDayTime', { dayTime: activeDayTime })
                      : viewMode === 'today'
                        ? t('noActivitiesForToday')
                        : t('noActivitiesMatch')}
                  </h3>
                  <p>
                    {activeDayTime !== 'all'
                      ? t('noDayTimeScheduled', { dayTime: activeDayTime })
                      : viewMode === 'today'
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

          <CreateActivityModal
            open={showCreateModal}
            onOpenChange={setShowCreateModal}
            onActivityCreated={handleActivityCreated}
          />
          <EditActivityModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            activity={editingActivity}
            onActivityUpdated={handleActivityUpdated}
          />
          <GenericFilterModal
            open={showFilterModal}
            onOpenChange={setShowFilterModal}
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
        </div>
      </div>
    </AuthGuard>
  );
}
