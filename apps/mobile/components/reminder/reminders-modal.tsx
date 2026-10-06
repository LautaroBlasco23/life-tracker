import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  AlarmClockOff,
  Bell,
  CheckCircle2,
  Check,
  Clock,
  Plus,
  Undo2,
  X,
} from 'lucide-react-native';
import { themeColors } from '@shared/lib/theme-colors';
import { reminderService } from '@shared/services/reminder-service';
import { useTranslations } from '@shared';
import type { Reminder, ReminderStatus } from '@shared/types/reminder';
import { getReminderStatus } from '@shared/types/reminder';
import { CategoryHeader } from '../ui/category-header';
import { DeleteModal } from '../ui/delete-modal';
import { ActivityFormModal } from '../activity/activity-form-modal';
import { showToast } from '../ui/toast';
import { useTheme } from '../../lib/theme-provider';
import { useColors } from '../../lib/use-colors';
import { cn } from '../../lib/cn';

type Bucket = 'overdue' | 'active' | 'upcoming' | 'completed';

const STATUS_TO_BUCKET: Record<ReminderStatus, Bucket> = {
  missed: 'overdue',
  active: 'active',
  locked: 'upcoming',
  completed: 'completed',
};

const BUCKET_ORDER: Bucket[] = ['overdue', 'active', 'upcoming', 'completed'];

function formatRemaining(ms: number): string {
  if (ms <= 0) return '';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface RemindersModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Reminders list, hosted inside the Activities screen (web reminders-modal). */
export function RemindersModal({ visible, onClose }: RemindersModalProps) {
  const t = useTranslations('reminders');
  const tCommon = useTranslations('common');
  const { theme } = useTheme();
  const colors = useColors();
  const palette = themeColors[theme];

  const BUCKET_CONFIG: Record<
    Bucket,
    { label: string; description: string; icon: typeof Bell; color: string }
  > = {
    overdue: {
      label: t('sectionOverdue'),
      description: t('sectionOverdueDescription'),
      icon: AlarmClockOff,
      color: palette.danger,
    },
    active: {
      label: t('sectionActive'),
      description: t('sectionActiveDescription'),
      icon: Bell,
      color: palette.success,
    },
    upcoming: {
      label: t('sectionUpcoming'),
      description: t('sectionUpcomingDescription'),
      icon: Clock,
      color: palette.primary,
    },
    completed: {
      label: t('sectionCompleted'),
      description: t('sectionCompletedDescription'),
      icon: CheckCircle2,
      color: palette.textMuted,
    },
  };

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [deleting, setDeleting] = useState<Reminder | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [now, setNow] = useState(() => new Date());

  // Shared 30s tick: re-derives every card's status (locked → active, etc.)
  // without reloading. Minute precision is enough for reminders.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [visible]);

  const loadReminders = useCallback(async () => {
    try {
      setReminders(await reminderService.getReminders());
    } catch {
      showToast({ title: t('failedToLoad'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      loadReminders();
      setEditing(null);
      setDeleting(null);
    }
  }, [visible, loadReminders]);

  const updateReminderState = (updated: Reminder) => {
    setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const setProcessing = (id: number, processing: boolean) => {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      if (processing) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleComplete = async (reminder: Reminder) => {
    if (reminder.completedAt) return;
    setProcessing(reminder.id, true);
    const optimistic = { ...reminder, completedAt: new Date().toISOString() };
    updateReminderState(optimistic);
    try {
      updateReminderState(await reminderService.completeReminder(reminder.id));
      showToast({
        title: t('reminderComplete'),
        description: t('reminderCompletedDescription', { title: reminder.title }),
      });
    } catch {
      updateReminderState(reminder);
      showToast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setProcessing(reminder.id, false);
    }
  };

  const handleRevert = async (reminder: Reminder) => {
    setProcessing(reminder.id, true);
    const optimistic = { ...reminder, completedAt: null };
    updateReminderState(optimistic);
    try {
      await reminderService.revertCompletion(reminder.id);
      showToast({
        title: t('completionReverted'),
        description: t('revertDescription', { title: reminder.title }),
      });
    } catch {
      updateReminderState(reminder);
      showToast({ title: tCommon('error'), variant: 'destructive' });
    } finally {
      setProcessing(reminder.id, false);
    }
  };

  const handleLongPress = (reminder: Reminder, status: ReminderStatus) => {
    const options: Array<{ text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }> = [];
    if (status === 'completed') {
      options.push({ text: t('revertCompletion'), onPress: () => handleRevert(reminder) });
    } else if (status === 'active' || status === 'missed') {
      options.push({ text: t('completeNow'), onPress: () => handleComplete(reminder) });
    }
    options.push({
      text: tCommon('edit'),
      onPress: () => {
        setEditing(reminder);
        setShowForm(true);
      },
    });
    options.push({
      text: t('deleteReminder'),
      style: 'destructive',
      onPress: () => setDeleting(reminder),
    });
    options.push({ text: tCommon('cancel'), style: 'cancel' });
    Alert.alert(reminder.title, undefined, options);
  };

  const handleReminderSaved = (saved: Reminder) => {
    setReminders((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev];
    });
    setShowForm(false);
    setEditing(null);
  };

  const remindersByBucket = reminders.reduce(
    (acc, reminder) => {
      const bucket = STATUS_TO_BUCKET[getReminderStatus(reminder, now)];
      (acc[bucket] ||= []).push(reminder);
      return acc;
    },
    {} as Record<Bucket, Reminder[]>
  );

  const sections = BUCKET_ORDER.filter((b) => (remindersByBucket[b] ?? []).length > 0).map(
    (bucket) => ({
      bucket,
      items: remindersByBucket[bucket],
    })
  );

  const renderCountdown = (reminder: Reminder, status: ReminderStatus) => {
    const target =
      status === 'locked' ? reminder.activeFrom : status === 'active' ? reminder.dueAt : null;
    if (!target) return null;
    const remaining = new Date(target).getTime() - now.getTime();
    if (remaining <= 0) return null;
    return (
      <View className="flex-row items-center gap-1.5 mt-1 flex-wrap">
        <Clock size={14} color={palette.textMuted} />
        <Text className="text-sm text-muted dark:text-dark-muted">
          {status === 'locked'
            ? t('opensAt', { date: formatDateTime(new Date(target)) })
            : t('dueBy', { date: formatDateTime(new Date(target)) })}
        </Text>
        <Text className="text-sm font-medium text-foreground dark:text-dark-foreground tabular-nums">
          {formatRemaining(remaining)}
        </Text>
      </View>
    );
  };

  const renderCard = (reminder: Reminder) => {
    const status = getReminderStatus(reminder, now);
    const isCompleted = status === 'completed';
    const completable = status === 'active' || status === 'missed';

    return (
      <Pressable
        onPress={
          completable
            ? () => handleComplete(reminder)
            : isCompleted
              ? () => handleRevert(reminder)
              : undefined
        }
        onLongPress={() => handleLongPress(reminder, status)}
        disabled={processingIds.has(reminder.id)}
        className={cn(
          'mx-4 mb-2 rounded-xl border p-4 bg-surface dark:bg-dark-surface',
          isCompleted
            ? 'border-border dark:border-dark-border opacity-70'
            : completable
              ? 'border-success/50 dark:border-dark-success/50'
              : 'border-border dark:border-dark-border',
          processingIds.has(reminder.id) && 'opacity-60'
        )}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text
              className={cn(
                'text-base font-medium',
                isCompleted
                  ? 'text-muted dark:text-dark-muted line-through'
                  : 'text-foreground dark:text-dark-foreground'
              )}
            >
              {reminder.title}
            </Text>
            {reminder.description ? (
              <Text className="text-sm text-muted dark:text-dark-muted mt-0.5" numberOfLines={2}>
                {reminder.description}
              </Text>
            ) : null}
            <View className="flex-row flex-wrap gap-2 mt-2 items-center">
              {status === 'missed' ? (
                <View className="rounded-md border border-danger/50 dark:border-dark-danger/50 px-2 py-0.5">
                  <Text className="text-xs text-danger dark:text-dark-danger">
                    {t('statusMissed')} · {t('expired', { date: formatDateTime(new Date(reminder.dueAt)) })}
                  </Text>
                </View>
              ) : null}
              {status === 'locked' ? (
                <View className="rounded-md border border-border dark:border-dark-border px-2 py-0.5">
                  <Text className="text-xs text-muted dark:text-dark-muted">
                    {t('statusLocked')}
                    {reminder.activeFrom
                      ? ` · ${t('opensAt', { date: formatDateTime(new Date(reminder.activeFrom)) })}`
                      : ''}
                  </Text>
                </View>
              ) : null}
              {status === 'active' ? (
                <View className="rounded-md border border-border dark:border-dark-border px-2 py-0.5">
                  <Text className="text-xs text-muted dark:text-dark-muted">
                    {t('dueBy', { date: formatDateTime(new Date(reminder.dueAt)) })}
                  </Text>
                </View>
              ) : null}
              {isCompleted && reminder.completedAt && new Date(reminder.completedAt) > new Date(reminder.dueAt) ? (
                <View className="rounded-md border border-warning/50 dark:border-dark-warning/50 px-2 py-0.5">
                  <Text className="text-xs text-warning dark:text-dark-warning">
                    {t('completedLate')}
                  </Text>
                </View>
              ) : null}
            </View>
            {renderCountdown(reminder, status)}
          </View>
          {isCompleted ? (
            <Pressable
              onPress={() => handleRevert(reminder)}
              disabled={processingIds.has(reminder.id)}
              className="p-1"
            >
              <Undo2 size={18} color={palette.textMuted} />
            </Pressable>
          ) : completable ? (
            <Check size={20} color={palette.success} />
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View className="flex-1 bg-background dark:bg-dark-background">
          <View className="flex-row items-center justify-between px-4 pt-3 pb-2 border-b border-border dark:border-dark-border">
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={onClose}
                className="h-9 w-9 rounded-lg items-center justify-center"
              >
                <X size={20} color={colors.primary} />
              </Pressable>
              <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground">
                {t('title')}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="flex-row items-center gap-1.5 rounded-lg bg-primary dark:bg-dark-primary px-3 py-2"
            >
              <Plus size={16} color={colors.primaryForeground} />
              <Text className="text-sm text-primary-foreground dark:text-dark-primary-foreground">
                {t('newReminder')}
              </Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-muted dark:text-dark-muted">{t('loadingReminders')}</Text>
            </View>
          ) : (
            <FlatList
              data={sections}
              keyExtractor={(s) => s.bucket}
              renderItem={({ item }) => {
                const config = BUCKET_CONFIG[item.bucket];
                return (
                  <View className="mt-2">
                    <CategoryHeader
                      icon={config.icon}
                      label={config.label}
                      description={config.description}
                      accentColor={config.color}
                      iconColor={config.color}
                      summaryValue={item.items.length}
                      itemCount={item.items.length}
                      itemName={t('remindersTotal')}
                    />
                    {item.items.map(renderCard)}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View className="mt-8 items-center px-6">
                  <View className="h-16 w-16 rounded-full bg-surface dark:bg-dark-surface items-center justify-center">
                    <Plus size={32} color={palette.textMuted} />
                  </View>
                  <Text className="text-lg font-medium text-foreground dark:text-dark-foreground mt-4">
                    {t('noRemindersYet')}
                  </Text>
                  <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                    {t('noRemindersDescription')}
                  </Text>
                </View>
              }
              contentContainerClassName="pb-8"
            />
          )}
        </View>
      </Modal>

      <ActivityFormModal
        visible={showForm}
        reminder={editing}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        onSaved={() => {}}
        onReminderSaved={handleReminderSaved}
      />

      <DeleteModal
        visible={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('deleteReminder')}
        itemName={deleting?.title ?? ''}
        itemDetails={
          deleting ? (
            <View>
              <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                {deleting.title}
              </Text>
              {deleting.description ? (
                <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                  {deleting.description}
                </Text>
              ) : null}
              <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                {t('dueBy', { date: formatDateTime(new Date(deleting.dueAt)) })}
              </Text>
            </View>
          ) : null
        }
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await reminderService.deleteReminder(deleting.id);
            setReminders((prev) => prev.filter((r) => r.id !== deleting.id));
            setDeleting(null);
            showToast({ title: t('reminderDeleted'), description: t('reminderDeletedDescription') });
          } catch {
            showToast({ title: t('deleteFailed'), variant: 'destructive' });
            throw new Error('delete failed');
          }
        }}
      />
    </>
  );
}
