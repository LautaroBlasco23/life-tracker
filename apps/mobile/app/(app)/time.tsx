import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Clock, Filter, Plus, Timer } from 'lucide-react-native';
import { timeService, useTranslations } from '@shared';
import { TIME_CATEGORIES, type TimeRecord } from '@shared/types/time';
import { Button } from '../../components/ui/button';
import { CategoryHeader } from '../../components/ui/category-header';
import { DeleteModal } from '../../components/ui/delete-modal';
import { FilterModal, getActiveFilterCount } from '../../components/ui/filter-modal';
import type { FilterState } from '../../components/ui/filter-modal';
import { OptionSelect } from '../../components/ui/option-select';
import { FormField } from '../../components/ui/form-field';
import { SegmentedTabs } from '../../components/ui/segmented-tabs';
import { RecordFormModal } from '../../components/time/record-form-modal';
import { CalendarView } from '../../components/time/calendar-view';
import { ActiveSessionCard } from '../../components/time/active-session-card';
import { useActiveSessions } from '../../hooks/use-active-sessions';
import { formatDuration, formatRecordDate } from '../../lib/format-time';
import { useMonthLabel, useMonthYearOptions } from '../../lib/filter-options';
import { showToast } from '../../components/ui/toast';
import { useColors } from '../../lib/use-colors';
import { useTheme } from '../../lib/theme-provider';
import { cn } from '../../lib/cn';
import { Navigation } from '../../components/navigation';

import { themeColors } from '@shared/lib/theme-colors';

type Period = 'thisWeek' | 'thisMonth' | 'lastMonth' | 'allTime';

const PERIODS: Period[] = ['thisWeek', 'thisMonth', 'lastMonth', 'allTime'];

/** Tabs of the time screen (web parity: records / calendar). */
type TimeView = 'records' | 'calendar';

function getPeriodParams(period: Period): { month?: number; year?: number; startDate?: Date; endDate?: Date } {
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
    default:
      return {};
  }
}

// Same per-category accent mapping as web (app/time/page.tsx), resolved to
// shared palette tokens (Work→secondary/violet, Personal→success, Health→danger,
// Learning→warning, default→primary).
const CATEGORY_ACCENT_KEYS: Record<string, 'secondary'|'success'|'danger'|'warning'|'primary'> = {
  Work: 'secondary',
  Personal: 'success',
  Health: 'danger',
  Learning: 'warning',
};

export default function TimeScreen() {
  const t = useTranslations('time');
  const tCommon = useTranslations('common');
  const tCalendar = useTranslations('calendar');
  const { theme } = useTheme();
  const colors = useColors();
  const monthLabel = useMonthLabel();
  const { monthOptions, yearOptions } = useMonthYearOptions();

  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('thisMonth');
  const [view, setView] = useState<TimeView>('records');
  const [filter, setFilter] = useState<FilterState>({});
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TimeRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<TimeRecord | null>(null);

  // Timer start inputs (web parity: start recording card).
  const [timerCategory, setTimerCategory] = useState<string | null>(null);
  const [timerDescription, setTimerDescription] = useState('');

  const getPeriodLabel = (p: Period): string => {
    const now = new Date();
    switch (p) {
      case 'thisWeek':
        return t('thisWeek');
      case 'thisMonth':
        return monthLabel(now.getMonth() + 1);
      case 'lastMonth':
        return monthLabel(now.getMonth() === 0 ? 12 : now.getMonth());
      default:
        return t('allTime');
    }
  };
  const periodLabel = getPeriodLabel(period);

  const loadRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = getPeriodParams(period);
      const data = await timeService.getRecords({
        category: filter.category,
        month:
          period === 'allTime'
            ? (filter.month !== undefined ? Number(filter.month) : undefined)
            : params.month,
        year:
          period === 'allTime'
            ? (filter.year !== undefined ? Number(filter.year) : undefined)
            : params.year,
      });
      let filtered = data;
      if (period === 'thisWeek' && params.startDate && params.endDate) {
        filtered = data.filter((r) => {
          const d = new Date(r.createdAt);
          return d >= params.startDate! && d <= params.endDate!;
        });
      }
      setRecords(filtered);
    } catch {
      showToast({ title: t('failedToLoad'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [period, filter, t]);

  useFocusEffect(
    useCallback(() => {
      if (view !== 'records') return;
      loadRecords();
    }, [loadRecords, view])
  );

  const {
    sessions,
    now: timerNow,
    savingId,
    start: startSession,
    pause: pauseSession,
    resume: resumeSession,
    discard: discardSession,
    save: saveActiveSession,
  } = useActiveSessions(loadRecords);

  const handleStartTimer = () => {
    if (startSession(timerCategory ?? '', timerDescription)) {
      setTimerCategory(null);
      setTimerDescription('');
    }
  };

  const handleApplyFilter = (next: FilterState) => {
    setFilter(next);
    if (next.month !== undefined || next.year !== undefined) {
      setPeriod('allTime');
    }
  };

  const handlePeriodChange = (value: string) => {
    setPeriod(value as Period);
    setFilter({});
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;
    const record = deletingRecord;
    const snapshot = records;
    // Optimistic removal, reverted on failure (modal stays open on throw).
    setRecords((prev) => prev.filter((r) => r.id !== record.id));
    try {
      await timeService.deleteRecord(record.id);
      showToast({
        title: t('recordDeleted'),
        description: t('recordDeletedDescription'),
      });
    } catch (error) {
      setRecords(snapshot);
      showToast({
        title: t('deleteFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('delete failed');
    }
  };

  const handleEditLongPress = (record: TimeRecord) => {
    Alert.alert(t('editEntry'), undefined, [
      { text: tCommon('edit'), onPress: () => setEditingRecord(record) },
      { text: tCommon('delete'), style: 'destructive', onPress: () => setDeletingRecord(record) },
      { text: tCommon('cancel'), style: 'cancel' },
    ]);
  };

  const stats = useMemo(() => {
    const totalMinutes = records.reduce((sum, r) => sum + r.durationMinutes, 0);
    const categoryTotals = records.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + r.durationMinutes;
      return acc;
    }, {} as Record<string, number>);
    const topCategory = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0];
    return {
      totalMinutes,
      recordCount: records.length,
      topCategory: topCategory ? topCategory[0] : null,
      topCategoryMinutes: topCategory ? topCategory[1] : 0,
    };
  }, [records]);

  const recordsByCategory = useMemo(() => {
    return records.reduce((acc, record) => {
      (acc[record.category] ||= []).push(record);
      return acc;
    }, {} as Record<string, TimeRecord[]>);
  }, [records]);

  const grouped = useMemo(
    () => Object.entries(recordsByCategory).sort(([, a], [, b]) => {
      // Most recent first inside sections (by newest record in the category).
      return new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime();
    }),
    [recordsByCategory]
  );

  const filterCount = getActiveFilterCount(filter);

  const timerCategoryOptions = useMemo(
    () =>
      TIME_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
    []
  );

  return (
    <View className="flex-1 relative bg-background dark:bg-dark-background">
      <Navigation />
      <View className="px-4 pt-4">
        <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
          {t('title')}
        </Text>
      </View>
      <View className="px-4">
        <SegmentedTabs<TimeView>
          value={view}
          onChange={setView}
          options={[
            { value: 'records', label: tCalendar('recordsTab') },
            { value: 'calendar', label: tCalendar('tab') },
          ]}
        />
      </View>
      {view === 'records' ? (
        <FlatList
          data={grouped}
          keyExtractor={([category]) => category}
          ListHeaderComponent={
            <View className="px-4 pb-0">
              <Text className="text-sm text-muted dark:text-dark-muted mt-1">
                {period === 'allTime' ? t('allRecords') : t('viewing', { period: periodLabel })}
              </Text>

              <View className="flex-row items-center gap-2 mt-3 mb-4">
                <Button variant="outline" className="h-9" onPress={() => setShowFilterModal(true)}>
                  <View className="flex-row items-center gap-1.5">
                    <Filter size={14} color={colors.primary} />
                    <Text className="text-sm text-foreground dark:text-dark-foreground">
                      {tCommon('filters')}
                      {filterCount > 0 ? ` (${filterCount})` : ''}
                    </Text>
                  </View>
                </Button>
                <Button className="h-9" onPress={() => { setEditingRecord(null); setShowFormModal(true); }}>
                  <View className="flex-row items-center gap-1.5">
                    <Plus size={14} color={colors.primaryForeground} />
                    <Text className="text-sm text-primary-foreground dark:text-dark-primary-foreground">{t('logTime')}</Text>
                  </View>
                </Button>
              </View>

              {/* Period selector */}
              <View className="flex-row flex-wrap gap-2 mb-4">
                {PERIODS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => handlePeriodChange(p)}
                    className={cn(
                      'px-3 py-2 rounded-lg border',
                      period === p
                        ? 'bg-primary dark:bg-dark-primary border-primary dark:border-dark-primary'
                        : 'border-border dark:border-dark-border'
                    )}
                  >
                    <Text className={cn(period === p ? 'text-primary-foreground dark:text-dark-primary-foreground' : 'text-muted dark:text-dark-muted')}>
                      {t(p)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Active sessions (persisted across restarts) */}
              {sessions.length > 0 ? (
                <View className="mb-6 gap-3">
                  <View className="flex-row items-center gap-2">
                    <Timer size={18} color={colors.primary} />
                    <Text className="font-semibold text-foreground dark:text-dark-foreground">
                      {t('activeRecordings')}
                    </Text>
                    <View className="rounded-md bg-primary/10 dark:bg-dark-primary/10 px-2 py-0.5">
                      <Text className="text-xs text-primary dark:text-dark-primary">{sessions.length}</Text>
                    </View>
                  </View>
                  {sessions.map((session) => (
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
                </View>
              ) : null}

              {/* Start recording (web parity card) */}
              <View className="rounded-xl border border-border dark:border-dark-border p-4 mb-6">
                <View className="flex-row items-center gap-2 mb-4">
                  <Timer size={18} color={colors.textMuted} />
                  <Text className="font-semibold text-foreground dark:text-dark-foreground">
                    {t('startRecording')}
                  </Text>
                </View>
                <OptionSelect
                  label={t('category')}
                  value={timerCategory}
                  options={timerCategoryOptions}
                  onSelect={setTimerCategory}
                  placeholder={t('selectCategory')}
                />
                <View className="h-4" />
                <FormField
                  label={t('description')}
                  placeholder={t('whatAreYouWorkingOn')}
                  value={timerDescription}
                  onChangeText={setTimerDescription}
                />
                <Button className="mt-4" onPress={handleStartTimer}>
                  {t('start')}
                </Button>
              </View>

              {/* Stats cards */}
              <View className="flex-row gap-3 mb-6">
                <View className="flex-1 rounded-xl border border-border dark:border-dark-border p-3 bg-surface dark:bg-dark-surface">
                  <Text className="text-sm text-muted dark:text-dark-muted">{t('totalTime')}</Text>
                  <Text className="text-lg font-bold text-foreground dark:text-dark-foreground mt-1">
                    {formatDuration(stats.totalMinutes)}
                  </Text>
                </View>
                <View className="flex-1 rounded-xl border border-border dark:border-dark-border p-3 bg-surface dark:bg-dark-surface">
                  <Text className="text-sm text-muted dark:text-dark-muted">{t('entries')}</Text>
                  <Text className="text-lg font-bold text-foreground dark:text-dark-foreground mt-1">
                    {stats.recordCount}
                  </Text>
                </View>
                <View className="flex-1 rounded-xl border border-border dark:border-dark-border p-3 bg-surface dark:bg-dark-surface">
                  <Text className="text-sm text-muted dark:text-dark-muted">{t('topCategory')}</Text>
                  <Text className="text-lg font-bold text-foreground dark:text-dark-foreground mt-1" numberOfLines={1}>
                    {stats.topCategory ?? tCommon('na')}
                  </Text>
                  {stats.topCategory ? (
                    <Text className="text-xs text-muted dark:text-dark-muted">
                      {formatDuration(stats.topCategoryMinutes)}
                    </Text>
                  ) : null}
                </View>
              </View>

              {records.length === 0 && !isLoading ? (
                <View className="mb-8 items-center">
                  <View className="h-16 w-16 rounded-full bg-surface dark:bg-dark-surface items-center justify-center mb-4">
                    <Clock size={28} color={colors.textMuted} />
                  </View>
                  <Text className="text-lg font-medium text-foreground dark:text-dark-foreground text-center">
                    {filterCount > 0
                      ? t('noEntriesMatch')
                      : t('noEntriesFor', { period: periodLabel.toLowerCase() })}
                  </Text>
                  <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                    {filterCount > 0 ? t('tryAdjusting') : t('startRecordingOrLog')}
                  </Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item: [category, categoryRecords] }) => {
            const categoryTotal = categoryRecords.reduce(
              (sum, r) => sum + r.durationMinutes,
              0
            );
            const key = CATEGORY_ACCENT_KEYS[category] ?? 'primary';
            const accentColor = themeColors[theme][key];
            return (
              <View className="mb-4">
                <CategoryHeader
                  icon={Clock}
                  label={category}
                  accentColor={accentColor}
                  iconColor={accentColor}
                  summaryValue={formatDuration(categoryTotal)}
                  itemCount={categoryRecords.length}
                  itemName={t('entry')}
                />
                <View className="px-4 gap-2">
                  {categoryRecords.map((record) => (
                    <Pressable
                      key={record.id}
                      onLongPress={() => handleEditLongPress(record)}
                      className="rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-3">
                          <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
                            {record.description}
                          </Text>
                          <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                            {formatRecordDate(record.createdAt)}
                          </Text>
                        </View>
                        <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                          {formatDuration(record.durationMinutes)}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          }}
          contentContainerClassName="pb-24"
          ListEmptyComponent={
            isLoading ? (
              <View className="py-10 items-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : undefined
          }
        />
      ) : (
        <CalendarView />
      )}

      <RecordFormModal
        visible={showFormModal}
        record={editingRecord}
        onClose={() => {
          setShowFormModal(false);
          setEditingRecord(null);
        }}
        onSaved={() => {
          loadRecords();
        }}
      />

      <DeleteModal
        visible={deletingRecord !== null}
        onClose={() => setDeletingRecord(null)}
        title={t('deleteTimeEntry')}
        itemName={deletingRecord?.description ?? ''}
        itemDetails={
          deletingRecord ? (
            <Text className="text-sm">
              {deletingRecord.category} · {formatDuration(deletingRecord.durationMinutes)}
            </Text>
          ) : null
        }
        confirmLabel={t('deleteEntry')}
        onConfirm={handleDeleteRecord}
      />

      <FilterModal
        visible={showFilterModal}
        title={t('filterTimeRecords')}
        currentFilter={filter}
        onApplyFilter={handleApplyFilter}
        onClose={() => setShowFilterModal(false)}
        fields={[
          {
            id: 'month',
            label: t('month'),
            type: 'select',
            options: monthOptions,
            placeholder: t('allMonths'),
          },
          {
            id: 'year',
            label: t('year'),
            type: 'select',
            options: yearOptions,
            placeholder: t('allYears'),
          },
          {
            id: 'category',
            label: t('category'),
            type: 'select',
            options: timerCategoryOptions,
            placeholder: t('allCategories'),
          },
        ]}
      />
    </View>
  );
}
