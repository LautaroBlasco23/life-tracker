import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { timeService, useTranslations } from '@shared';
import type { TimeRecord } from '@shared/types/time';
import { Button } from '../../components/ui/button';
import { FormField } from '../../components/ui/form-field';
import { useTheme } from '../../lib/theme-provider';
import { cn } from '../../lib/cn';

type Period = 'thisWeek' | 'thisMonth' | 'lastMonth' | 'allTime';

const PERIODS: Period[] = ['thisWeek', 'thisMonth', 'lastMonth', 'allTime'];

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

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function TimeScreen() {
  const t = useTranslations('time');
  const tCommon = useTranslations('common');
  const { theme } = useTheme();
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('thisMonth');

  // Stopwatch
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = getPeriodParams(period);
      const data = await timeService.getRecords({ month: params.month, year: params.year });
      let filtered = data;
      if (period === 'thisWeek' && params.startDate && params.endDate) {
        filtered = data.filter((r) => {
          const d = new Date(r.createdAt);
          return d >= params.startDate! && d <= params.endDate!;
        });
      }
      setRecords(filtered);
    } catch {
      Alert.alert(t('failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [period, t]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startTimer = () => {
    setRunning(true);
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const pauseTimer = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const discardTimer = () => {
    pauseTimer();
    setElapsed(0);
  };

  const saveTimer = async () => {
    if (!category.trim()) {
      Alert.alert(t('categoryRequired'), t('categoryRequiredDescription'));
      return;
    }
    if (!description.trim()) {
      Alert.alert(t('descriptionRequired'), t('descriptionRequiredDescription'));
      return;
    }
    const durationMinutes = Math.max(1, Math.round(elapsed / 60));
    setIsSaving(true);
    try {
      await timeService.createRecord({ category, description, durationMinutes });
      discardTimer();
      setShowSaveModal(false);
      setCategory('');
      setDescription('');
      loadRecords();
    } catch {
      Alert.alert(t('failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (record: TimeRecord) => {
    Alert.alert(t('editEntry'), undefined, [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: tCommon('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await timeService.deleteRecord(record.id);
            setRecords((prev) => prev.filter((r) => r.id !== record.id));
          } catch {
            Alert.alert(t('failedToLoad'));
          }
        },
      },
    ]);
  };

  const totalMinutes = records.reduce((sum, r) => sum + r.durationMinutes, 0);

  return (
    <View className="flex-1 bg-background dark:bg-dark-background">
      <FlatList
        data={records}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={
          <View className="p-4">
            <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
              {t('title')}
            </Text>

            {/* Stopwatch */}
            <View className="mt-4 rounded-xl border border-border dark:border-dark-border p-6 items-center">
              <Text className="text-5xl font-mono text-foreground dark:text-dark-foreground tabular-nums">
                {formatElapsed(elapsed)}
              </Text>
              <View className="flex-row gap-3 mt-5">
                {!running ? (
                  <Button onPress={startTimer}>{elapsed > 0 ? t('resume') : t('start')}</Button>
                ) : (
                  <Button variant="outline" onPress={pauseTimer}>{t('pause')}</Button>
                )}
                {elapsed > 0 ? (
                  <>
                    <Button variant="outline" onPress={discardTimer}>Discard</Button>
                    <Button onPress={() => setShowSaveModal(true)}>{t('save')}</Button>
                  </>
                ) : null}
              </View>
            </View>

            {/* Period filter */}
            <View className="flex-row flex-wrap gap-2 mt-4">
              {PERIODS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  className={cn(
                    'px-3 py-2 rounded-lg border',
                    period === p
                      ? 'bg-primary dark:bg-dark-primary border-primary dark:border-dark-primary'
                      : 'border-border dark:border-dark-border'
                  )}
                >
                  <Text className={cn(period === p ? 'text-secondaryForeground dark:text-dark-secondaryForeground' : 'text-muted dark:text-dark-muted')}>
                    {t(p)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="mt-4 flex-row justify-between">
              <Text className="text-sm text-muted dark:text-dark-muted">
                {t('totalTime')}: {formatDuration(totalMinutes)}
              </Text>
              <Text className="text-sm text-muted dark:text-dark-muted">
                {t('entries')}: {records.length}
              </Text>
            </View>

            {records.length === 0 && !isLoading ? (
              <View className="mt-8 items-center">
                <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
                  {t('noEntriesFor') ?? t('noEntriesMatch')}
                </Text>
                <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                  {t('startRecordingOrLog')}
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => handleDelete(item)}
            className="mx-4 mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
          >
            <View className="flex-row justify-between items-center">
              <View className="flex-1 mr-3">
                <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
                  {item.category}
                </Text>
                {item.description ? (
                  <Text className="text-sm text-muted dark:text-dark-muted mt-0.5" numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                {formatDuration(item.durationMinutes)}
              </Text>
            </View>
          </Pressable>
        )}
        contentContainerClassName="pb-24"
        ListEmptyComponent={
          isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color={theme === 'dark' ? '#61dafb' : '#0583f2'} />
            </View>
          ) : null
        }
      />

      {/* Save timer modal */}
      <Modal visible={showSaveModal} animationType="slide" transparent onRequestClose={() => setShowSaveModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-2xl bg-background dark:bg-dark-background p-5">
            <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
              {t('recordingTime')}
            </Text>
            <View className="space-y-4">
              <FormField label={t('category')} value={category} onChangeText={setCategory} placeholder={t('selectCategory')} />
              <FormField label={t('description')} value={description} onChangeText={setDescription} placeholder={t('whatAreYouWorkingOn')} />
              <View className="flex-row gap-3 pt-2">
                <Button variant="outline" className="flex-1" onPress={() => setShowSaveModal(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button className="flex-1" onPress={saveTimer} loading={isSaving}>
                  {t('save')}
                </Button>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}