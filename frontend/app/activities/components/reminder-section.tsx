'use client';

import {
  AlarmClockOff,
  Bell,
  Clock,
  CheckCircle2,
  Undo2,
  Check,
} from 'lucide-react';
import { CategoryHeader } from '@/components/ui/category/categoryHeader';
import { EntityCard } from '@/components/ui/card/entityCard';
import { Countdown } from '@/components/ui/countdown';
import type { Reminder, ReminderStatus } from '@shared/types/reminder';
import { getReminderStatus } from '@shared/types/reminder';
import { useTranslations } from '@shared/contexts/language-context';

type Bucket = 'overdue' | 'active' | 'upcoming' | 'completed';

const STATUS_TO_BUCKET: Record<ReminderStatus, Bucket> = {
  missed: 'overdue',
  active: 'active',
  locked: 'upcoming',
  completed: 'completed',
};

const BUCKET_ORDER: Bucket[] = ['overdue', 'active', 'upcoming', 'completed'];

const BUCKET_ACCENT: Record<Bucket, { accentColor: string; iconColor: string }> =
  {
    overdue: { accentColor: 'border-red-400', iconColor: 'text-red-500' },
    active: { accentColor: 'border-green-400', iconColor: 'text-green-500' },
    upcoming: { accentColor: 'border-sky-400', iconColor: 'text-sky-500' },
    completed: { accentColor: 'border-slate-400', iconColor: 'text-slate-500' },
  };

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface ReminderSectionProps {
  reminders: Reminder[];
  /** Shared tick owned by the page — keeps all cards in sync. */
  now: Date;
  processingIds: Set<number>;
  onComplete: (reminder: Reminder) => void;
  onRevert: (reminder: Reminder) => void;
  onDelete: (reminderId: number) => void;
  onEdit: (reminder: Reminder) => void;
}

/** Reminders rendered as cards inside the Activities page (today view). */
export function ReminderSection({
  reminders,
  now,
  processingIds,
  onComplete,
  onRevert,
  onDelete,
  onEdit,
}: ReminderSectionProps) {
  const t = useTranslations('reminders');
  const tCommon = useTranslations('common');

  if (reminders.length === 0) return null;

  const buildBadges = (
    reminder: Reminder,
    status: ReminderStatus
  ): Array<{
    label: string;
    variant: 'outline' | 'default' | 'secondary' | 'destructive';
  }> => {
    const badges: Array<{
      label: string;
      variant: 'outline' | 'default' | 'secondary' | 'destructive';
    }> = [];

    if (status === 'missed') {
      badges.push({ label: t('statusMissed'), variant: 'destructive' });
    }
    if (status === 'locked') {
      badges.push({ label: t('statusLocked'), variant: 'outline' });
    }
    if (
      status === 'completed' &&
      reminder.completedAt &&
      new Date(reminder.completedAt) > new Date(reminder.dueAt)
    ) {
      badges.push({ label: t('completedLate'), variant: 'secondary' });
    }

    if (status === 'missed') {
      badges.push({
        label: t('expired', { date: formatDateTime(new Date(reminder.dueAt)) }),
        variant: 'outline',
      });
    } else if (status === 'active') {
      badges.push({
        label: t('dueBy', { date: formatDateTime(new Date(reminder.dueAt)) }),
        variant: 'outline',
      });
    } else if (status === 'locked' && reminder.activeFrom) {
      badges.push({
        label: t('opensAt', {
          date: formatDateTime(new Date(reminder.activeFrom)),
        }),
        variant: 'outline',
      });
    }

    return badges;
  };

  const renderCountdown = (reminder: Reminder, status: ReminderStatus) => {
    if (status === 'locked' && reminder.activeFrom) {
      return (
        <Countdown
          target={reminder.activeFrom}
          now={now}
          label={t('opensAt', {
            date: formatDateTime(new Date(reminder.activeFrom)),
          })}
        />
      );
    }
    if (status === 'active') {
      return (
        <Countdown
          target={reminder.dueAt}
          now={now}
          label={t('dueBy', { date: formatDateTime(new Date(reminder.dueAt)) })}
        />
      );
    }
    return null;
  };

  const remindersByBucket = reminders.reduce(
    (acc, reminder) => {
      const bucket = STATUS_TO_BUCKET[getReminderStatus(reminder, now)];
      if (!acc[bucket]) {
        acc[bucket] = [];
      }
      acc[bucket].push(reminder);
      return acc;
    },
    {} as Record<Bucket, Reminder[]>
  );

  const total = reminders.length;

  return (
    <section className="mt-10 space-y-6">
      <CategoryHeader
        icon={Bell}
        label={t('title')}
        description={t('description')}
        accentColor="border-indigo-400"
        iconColor="text-indigo-500"
        summaryValue={total.toString()}
        summaryLabel={tCommon('total')}
        itemCount={total}
        itemName={t('remindersTotal')}
      />
      {BUCKET_ORDER.map((bucket) => {
        const bucketReminders = remindersByBucket[bucket] || [];
        if (bucketReminders.length === 0) return null;
        const accent = BUCKET_ACCENT[bucket];
        const bucketIcon =
          bucket === 'overdue'
            ? AlarmClockOff
            : bucket === 'active'
              ? Bell
              : bucket === 'upcoming'
                ? Clock
                : CheckCircle2;

        return (
          <div key={bucket} className="space-y-4">
            <CategoryHeader
              icon={bucketIcon}
              label={
                bucket === 'overdue'
                  ? t('sectionOverdue')
                  : bucket === 'active'
                    ? t('sectionActive')
                    : bucket === 'upcoming'
                      ? t('sectionUpcoming')
                      : t('sectionCompleted')
              }
              description={
                bucket === 'overdue'
                  ? t('sectionOverdueDescription')
                  : bucket === 'active'
                    ? t('sectionActiveDescription')
                    : bucket === 'upcoming'
                      ? t('sectionUpcomingDescription')
                      : t('sectionCompletedDescription')
              }
              accentColor={accent.accentColor}
              iconColor={accent.iconColor}
              summaryValue={bucketReminders.length.toString()}
              summaryLabel={tCommon('total')}
              itemCount={bucketReminders.length}
              itemName={t('remindersTotal')}
            />
            <div className="space-y-4">
              {bucketReminders.map((reminder) => {
                const status = getReminderStatus(reminder, now);
                const isCompletable = status === 'active' || status === 'missed';

                return (
                  <EntityCard
                    key={reminder.id}
                    title={reminder.title}
                    subtitle={reminder.description}
                    badges={buildBadges(reminder, status)}
                    metadata={renderCountdown(reminder, status)}
                    isCompleted={status === 'completed'}
                    onClick={
                      isCompletable ? () => onComplete(reminder) : undefined
                    }
                    onEdit={() => onEdit(reminder)}
                    onDelete={async () => onDelete(reminder.id)}
                    isProcessing={processingIds.has(reminder.id)}
                    extraMenuItems={
                      status === 'completed'
                        ? [
                            {
                              label: t('revertCompletion'),
                              icon: Undo2,
                              onClick: () => onRevert(reminder),
                              disabled: processingIds.has(reminder.id),
                            },
                          ]
                        : isCompletable
                          ? [
                              {
                                label: t('completeNow'),
                                icon: Check,
                                onClick: () => onComplete(reminder),
                                disabled: processingIds.has(reminder.id),
                              },
                            ]
                          : undefined
                    }
                    deleteModal={{
                      title: t('deleteReminder'),
                      itemName: reminder.title,
                      confirmLabel: t('deleteReminder'),
                      itemDetails: (
                        <div className="text-sm">
                          <div className="font-medium text-foreground mb-1">
                            {reminder.title}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {reminder.description && (
                              <div className="mb-1">{reminder.description}</div>
                            )}
                            <div>
                              {t('dueBy', {
                                date: formatDateTime(new Date(reminder.dueAt)),
                              })}
                            </div>
                          </div>
                        </div>
                      ),
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
