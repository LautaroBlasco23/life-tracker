import { Pressable, Text, View } from 'react-native';
import { Check, Clock, Undo2 } from 'lucide-react-native';
import { themeColors } from '@shared/lib/theme-colors';
import { useTranslations } from '@shared';
import type { Reminder, ReminderStatus } from '@shared/types/reminder';
import { getReminderStatus } from '@shared/types/reminder';
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

export function formatRemaining(ms: number): string {
  if (ms <= 0) return '';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Orders reminders overdue → active → upcoming → completed. */
export function sortReminders(reminders: Reminder[], now: Date): Reminder[] {
  return [...reminders].sort((a, b) => {
    const bucketA = BUCKET_ORDER.indexOf(STATUS_TO_BUCKET[getReminderStatus(a, now)]);
    const bucketB = BUCKET_ORDER.indexOf(STATUS_TO_BUCKET[getReminderStatus(b, now)]);
    return bucketA - bucketB;
  });
}

interface ReminderCardProps {
  reminder: Reminder;
  /** Shared tick owned by the screen — keeps all cards in sync. */
  now: Date;
  processing: boolean;
  onComplete: (reminder: Reminder) => void;
  onRevert: (reminder: Reminder) => void;
  onLongPress: (reminder: Reminder, status: ReminderStatus) => void;
}

/** One-time event card hosted inside the Activities screen. */
export function ReminderCard({
  reminder,
  now,
  processing,
  onComplete,
  onRevert,
  onLongPress,
}: ReminderCardProps) {
  const t = useTranslations('reminders');
  const { theme } = useTheme();
  const colors = useColors();
  const palette = themeColors[theme];

  const status = getReminderStatus(reminder, now);
  const isCompleted = status === 'completed';
  const completable = status === 'active' || status === 'missed';

  const renderCountdown = () => {
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

  return (
    <Pressable
      onPress={
        completable
          ? () => onComplete(reminder)
          : isCompleted
            ? () => onRevert(reminder)
            : undefined
      }
      onLongPress={() => onLongPress(reminder, status)}
      disabled={processing}
      className={cn(
        'mb-2 rounded-xl border p-4 bg-surface dark:bg-dark-surface',
        isCompleted
          ? 'border-border dark:border-dark-border opacity-70'
          : completable
            ? 'border-success/50 dark:border-dark-success/50'
            : 'border-border dark:border-dark-border',
        processing && 'opacity-60'
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
                  {t('statusMissed')} ·{' '}
                  {t('expired', { date: formatDateTime(new Date(reminder.dueAt)) })}
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
          {renderCountdown()}
        </View>
        {isCompleted ? (
          <Pressable
            onPress={() => onRevert(reminder)}
            disabled={processing}
            className="p-1"
          >
            <Undo2 size={18} color={palette.textMuted} />
          </Pressable>
        ) : completable ? (
          <Check size={20} color={colors.primary} />
        ) : null}
      </View>
    </Pressable>
  );
}
