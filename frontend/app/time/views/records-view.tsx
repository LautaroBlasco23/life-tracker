'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { timeService } from '@shared/services/time-service';
import type { TimeRecord } from '@shared/types/time';
import {
  Plus,
  Clock,
  Timer,
  CalendarDays,
  Filter,
  X,
  Play,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { CreateTimeRecordModal } from '../modal/create-time-record-modal';
import { EditTimeRecordModal } from '../modal/edit-time-record-modal';
import { useActiveSessions } from '../hooks/use-active-sessions';
import { ActiveSessionCard } from '../components/active-session-card';
import { formatDuration } from '../format-time';
import { CategoryHeader } from '@/components/ui/category/categoryHeader';
import { EntityCard } from '@/components/ui/card/entityCard';
import { Badge } from '@/components/ui/badge';
import { TIME_CATEGORIES } from '@shared/types/time';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MONTHS, YEARS } from '@/components/ui/filterModal/filterModal';
import { FilterSidebar } from '@/components/ui/filterModal/filterSidebar';
import { useTranslations } from '@shared/contexts/language-context';

type TimePeriodFilter = 'thisWeek' | 'thisMonth' | 'lastMonth' | 'allTime';

interface TimeRecordFilter extends Record<string, string | number | undefined> {
  month?: number;
  year?: number;
  category?: string;
}

const CATEGORY_COLORS: Record<
  string,
  { accentColor: string; iconColor: string }
> = {
  // Mirrors the mobile mapping (apps/mobile/app/(app)/time.tsx): tokens only.
  Work: { accentColor: 'border-secondary', iconColor: 'text-secondary' },
  Personal: { accentColor: 'border-success', iconColor: 'text-success' },
  Health: { accentColor: 'border-danger', iconColor: 'text-danger' },
  Learning: { accentColor: 'border-warning', iconColor: 'text-warning' },
  default: { accentColor: 'border-primary', iconColor: 'text-primary' },
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatTotalTime(minutes: number): string {
  if (minutes === 0) return '0h 0m';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatRecordDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTimePeriodDates(period: TimePeriodFilter): {
  month?: number;
  year?: number;
  startDate?: Date;
  endDate?: Date;
} {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  switch (period) {
    case 'thisWeek': {
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return { startDate: startOfWeek, endDate: endOfWeek };
    }
    case 'thisMonth':
      return { month: currentMonth, year: currentYear };
    case 'lastMonth': {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      return { month: lastMonth, year: lastMonthYear };
    }
    case 'allTime':
    default:
      return {};
  }
}

export function RecordsView() {
  const t = useTranslations('time');
  const tCommon = useTranslations('common');

  const getTimePeriodLabel = (period: TimePeriodFilter): string => {
    const now = new Date();
    switch (period) {
      case 'thisWeek':
        return t('thisWeek');
      case 'thisMonth':
        return MONTH_NAMES[now.getMonth()];
      case 'lastMonth': {
        const lastMonthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        return MONTH_NAMES[lastMonthIndex];
      }
      case 'allTime':
        return t('allTime');
    }
  };

  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TimeRecord | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriodFilter>('thisMonth');
  const [activeFilter, setActiveFilter] = useState<TimeRecordFilter>({});

  const [timerCategory, setTimerCategory] = useState<string>('');
  const [timerDescription, setTimerDescription] = useState('');

  const loadRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      const periodDates = getTimePeriodDates(timePeriod);
      const data = await timeService.getRecords({
        category: activeFilter.category,
        month: activeFilter.month ?? periodDates.month,
        year: activeFilter.year ?? periodDates.year,
      });

      let filteredData = data;
      if (
        timePeriod === 'thisWeek' &&
        periodDates.startDate &&
        periodDates.endDate
      ) {
        filteredData = data.filter((record) => {
          const recordDate = new Date(record.createdAt);
          return (
            recordDate >= periodDates.startDate! &&
            recordDate <= periodDates.endDate!
          );
        });
      }

      setRecords(filteredData);
    } catch (error) {
      console.error('Failed to load records:', error);
      showToast({
        title: t('failedToLoad'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, timePeriod]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const {
    sessions: activeSessions,
    now: timerNow,
    savingId,
    start: startSession,
    pause: pauseSession,
    resume: resumeSession,
    discard: discardSession,
    save: saveActiveSession,
  } = useActiveSessions(loadRecords);

  const handleStartTimer = () => {
    if (startSession(timerCategory, timerDescription)) {
      setTimerCategory('');
      setTimerDescription('');
    }
  };

  const handleTimePeriodChange = (value: string) => {
    setTimePeriod(value as TimePeriodFilter);
    setActiveFilter({});
  };

  const handleApplyFilter = (filter: TimeRecordFilter) => {
    setActiveFilter(filter);
    if (filter.month !== undefined || filter.year !== undefined) {
      setTimePeriod('allTime');
    }
  };

  const handleClearFilters = () => {
    setActiveFilter({});
  };

  const getActiveFilterCount = (): number => {
    let count = 0;
    if (activeFilter.month !== undefined || activeFilter.year !== undefined)
      count++;
    if (activeFilter.category !== undefined) count++;
    return count;
  };

  const getFilterBadgeText = (): string | null => {
    if (activeFilter.month !== undefined && activeFilter.year !== undefined) {
      return `${MONTH_NAMES[activeFilter.month - 1]} ${activeFilter.year}`;
    }
    if (activeFilter.month !== undefined) {
      return MONTH_NAMES[activeFilter.month - 1];
    }
    if (activeFilter.year !== undefined) {
      return activeFilter.year.toString();
    }
    return null;
  };

  const handleDeleteRecord = async (recordId: number) => {
    try {
      await timeService.deleteRecord(recordId);
      setRecords(records.filter((r) => r.id !== recordId));
      showToast({
        title: t('recordDeleted'),
        description: t('recordDeletedDescription'),
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

  const handleRecordCreated = (_newRecord: TimeRecord) => {
    loadRecords();
    setShowCreateModal(false);
  };

  const handleRecordUpdated = (updatedRecord: TimeRecord) => {
    setRecords(
      records.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
    );
    setShowEditModal(false);
    setEditingRecord(null);
  };

  const handleEditRecord = (record: TimeRecord) => {
    setEditingRecord(record);
    setShowEditModal(true);
  };

  const stats = useMemo(() => {
    const totalMinutes = records.reduce((sum, r) => sum + r.durationMinutes, 0);
    const categoryTotals = records.reduce(
      (acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + r.durationMinutes;
        return acc;
      },
      {} as Record<string, number>
    );

    const topCategory = Object.entries(categoryTotals).sort(
      ([, a], [, b]) => b - a
    )[0];

    return {
      totalMinutes,
      recordCount: records.length,
      topCategory: topCategory ? topCategory[0] : null,
      topCategoryMinutes: topCategory ? topCategory[1] : 0,
    };
  }, [records]);

  const recordsByCategory = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        if (!acc[record.category]) {
          acc[record.category] = [];
        }
        acc[record.category].push(record);
        return acc;
      },
      {} as Record<string, TimeRecord[]>
    );
  }, [records]);

  const filterCount = getActiveFilterCount();
  const periodLabel = getTimePeriodLabel(timePeriod);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        {tCommon('loading')}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {timePeriod === 'allTime'
            ? t('allRecords')
            : t('viewing', { period: periodLabel })}
        </p>
        <div className="flex items-center gap-2">
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
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('logTime')}
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <Select value={timePeriod} onValueChange={handleTimePeriodChange}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder={t('selectPeriod')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="thisWeek">{t('thisWeek')}</SelectItem>
            <SelectItem value="thisMonth">{t('thisMonth')}</SelectItem>
            <SelectItem value="lastMonth">{t('lastMonth')}</SelectItem>
            <SelectItem value="allTime">{t('allTime')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filterCount > 0 && (
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            {tCommon('activeFilters')}
          </span>
          <div className="flex flex-wrap gap-2">
            {getFilterBadgeText() && (
              <Badge variant="secondary">{getFilterBadgeText()}</Badge>
            )}
            {activeFilter.category && (
              <Badge variant="secondary">{activeFilter.category}</Badge>
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

      {activeSessions.length > 0 && (
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary animate-pulse" />
            <h3 className="font-semibold text-foreground">
              {t('activeRecordings')}
            </h3>
            <Badge variant="secondary">{activeSessions.length}</Badge>
          </div>
          {activeSessions.map((session) => (
            <ActiveSessionCard
              key={session.id}
              session={session}
              now={timerNow}
              isSaving={savingId === session.id}
              onPause={pauseSession}
              onResume={resumeSession}
              onSave={saveActiveSession}
              onDiscard={discardSession}
            />
          ))}
        </div>
      )}

      <Card className="mb-8 bg-surface border-secondary/30 relative overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">
              {t('startRecording')}
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="timer-category">{t('category')}</Label>
              <Select value={timerCategory} onValueChange={setTimerCategory}>
                <SelectTrigger id="timer-category">
                  <SelectValue placeholder={t('selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {TIME_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timer-description">{t('description')}</Label>
              <Textarea
                id="timer-description"
                placeholder={t('whatAreYouWorkingOn')}
                value={timerDescription}
                onChange={(e) => setTimerDescription(e.target.value)}
                rows={1}
                className="min-h-[40px] resize-none"
              />
            </div>

            <div className="flex flex-col justify-end">
              <Button
                onClick={handleStartTimer}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                {t('start')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-surface border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('totalTime')}
                </p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">
                  {formatTotalTime(stats.totalMinutes)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-secondary/10">
                <Clock className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-surface border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('entries')}
                </p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">
                  {stats.recordCount}
                </p>
              </div>
              <div className="p-3 rounded-full bg-secondary/10">
                <CalendarDays className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-surface border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('topCategory')}
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {stats.topCategory ?? 'N/A'}
                </p>
                {stats.topCategory && (
                  <p className="text-xs text-muted-foreground">
                    {formatTotalTime(stats.topCategoryMinutes)}
                  </p>
                )}
              </div>
              <div className="p-3 rounded-full bg-secondary/10">
                <Timer className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {records.length === 0 ? (
        <Card className="text-center py-12 bg-muted/30">
          <CardContent>
            <div className="text-muted-foreground mb-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Clock className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {filterCount > 0
                  ? t('noEntriesMatch')
                  : t('noEntriesFor', {
                      period: periodLabel.toLowerCase(),
                    })}
              </h3>
              <p>
                {filterCount > 0 ? t('tryAdjusting') : t('startRecordingOrLog')}
              </p>
            </div>
            {filterCount > 0 ? (
              <Button variant="outline" onClick={handleClearFilters}>
                {tCommon('clearFilters')}
              </Button>
            ) : (
              <Button onClick={() => setShowCreateModal(true)}>
                {t('logFirstEntry')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(recordsByCategory).map(
            ([category, categoryRecords]) => {
              const categoryTotal = categoryRecords.reduce(
                (sum, r) => sum + r.durationMinutes,
                0
              );
              const colors =
                CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;

              return (
                <div key={category} className="space-y-4">
                  <CategoryHeader
                    icon={Clock}
                    label={category}
                    accentColor={colors.accentColor}
                    iconColor={colors.iconColor}
                    summaryValue={formatTotalTime(categoryTotal)}
                    summaryLabel={tCommon('total')}
                    itemCount={categoryRecords.length}
                    itemName={t('entry')}
                  />

                  <div className="space-y-4">
                    {categoryRecords.map((record) => (
                      <EntityCard
                        key={record.id}
                        title={record.description}
                        badges={[
                          { label: record.category, variant: 'default' },
                        ]}
                        metadata={
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {formatDuration(record.durationMinutes)}
                            </span>
                            <span>•</span>
                            <span>{formatRecordDate(record.createdAt)}</span>
                          </div>
                        }
                        onEdit={() => handleEditRecord(record)}
                        onDelete={() => handleDeleteRecord(record.id)}
                        deleteModal={{
                          title: t('deleteTimeEntry'),
                          itemName: record.description,
                          confirmLabel: t('deleteEntry'),
                          itemDetails: (
                            <div className="text-sm">
                              <div className="font-medium text-foreground mb-1">
                                {record.description}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                <div>
                                  {record.category} •{' '}
                                  {formatDuration(record.durationMinutes)}
                                </div>
                                <div className="mt-1">
                                  {formatRecordDate(record.createdAt)}
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
            }
          )}
        </div>
      )}

      <CreateTimeRecordModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onRecordCreated={handleRecordCreated}
      />

      <EditTimeRecordModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        record={editingRecord}
        onRecordUpdated={handleRecordUpdated}
      />

      <FilterSidebar
        open={showFilterSidebar}
        onOpenChange={setShowFilterSidebar}
        currentFilter={activeFilter}
        onApplyFilter={handleApplyFilter}
        title={t('filterTimeRecords')}
        fields={[
          {
            id: 'month',
            label: t('month'),
            type: 'select',
            options: MONTHS,
            placeholder: t('allMonths'),
          },
          {
            id: 'year',
            label: t('year'),
            type: 'select',
            options: YEARS.map((y) => ({ value: y, label: String(y) })),
            placeholder: t('allYears'),
          },
          {
            id: 'category',
            label: t('category'),
            type: 'select',
            options: TIME_CATEGORIES.map((cat) => ({
              value: cat,
              label: cat,
            })),
            placeholder: t('allCategories'),
          },
        ]}
      />
    </div>
  );
}
