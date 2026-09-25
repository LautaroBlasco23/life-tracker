'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthGuard } from '@/components/auth-guard';
import { Navigation } from '@/components/navigation';
import { reminderService } from '@shared/services/reminder-service';
import type { Reminder, ReminderStatus } from '@shared/types/reminder';
import { getReminderStatus } from '@shared/types/reminder';
import {
  Plus,
  AlarmClockOff,
  Bell,
  Clock,
  CheckCircle2,
  Undo2,
  Check,
} from 'lucide-react';
import { showToast } from '@/lib/toast';
import { CategoryHeader } from '@/components/ui/category/categoryHeader';
import { EntityCard } from '@/components/ui/card/entityCard';
import { CreateReminderModal } from './modal/create-reminder-modal';
import { EditReminderModal } from './modal/edit-reminder-modal';
import { Countdown } from './components/countdown';
import { useTranslations } from '@shared/contexts/language-context';

type Bucket = 'overdue' | 'active' | 'upcoming' | 'completed';

const STATUS_TO_BUCKET: Record<ReminderStatus, Bucket> = {
  missed: 'overdue',
  active: 'active',
  locked: 'upcoming',
  completed: 'completed',
};

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function RemindersPage() {
  const t = useTranslations('reminders');
  const tCommon = useTranslations('common');

  const BUCKET_CONFIG = {
    overdue: {
      label: t('sectionOverdue'),
      icon: AlarmClockOff,
      description: t('sectionOverdueDescription'),
      accentColor: 'border-red-400',
      iconColor: 'text-red-500',
    },
    active: {
      label: t('sectionActive'),
      icon: Bell,
      description: t('sectionActiveDescription'),
      accentColor: 'border-green-400',
      iconColor: 'text-green-500',
    },
    upcoming: {
      label: t('sectionUpcoming'),
      icon: Clock,
      description: t('sectionUpcomingDescription'),
      accentColor: 'border-sky-400',
      iconColor: 'text-sky-500',
    },
    completed: {
      label: t('sectionCompleted'),
      icon: CheckCircle2,
      description: t('sectionCompletedDescription'),
      accentColor: 'border-slate-400',
      iconColor: 'text-slate-500',
    },
  } as const;

  const BUCKET_ORDER: Bucket[] = ['overdue', 'active', 'upcoming', 'completed'];

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [now, setNow] = useState(() => new Date());

  // Shared 30s tick: re-derives every card's status (locked → active, etc.)
  // without reloading. Minute precision is enough for reminders.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loadReminders = useCallback(async () => {
    try {
      setIsLoading(true);
      setReminders(await reminderService.getReminders());
    } catch (error) {
      console.error('Failed to load reminders:', error);
      showToast({
        title: t('failedToLoad'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const updateReminderState = (updated: Reminder) => {
    setReminders((prev) =>
      prev.map((reminder) => (reminder.id === updated.id ? updated : reminder))
    );
  };

  const handleDeleteReminder = async (reminderId: number) => {
    try {
      await reminderService.deleteReminder(reminderId);
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
      showToast({
        title: t('reminderDeleted'),
        description: t('reminderDeletedDescription'),
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

  const handleReminderCreated = (newReminder: Reminder) => {
    setReminders((prev) => [newReminder, ...prev]);
    setShowCreateModal(false);
  };

  const handleReminderUpdated = (updated: Reminder) => {
    updateReminderState(updated);
    setShowEditModal(false);
    setEditingReminder(null);
  };

  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setShowEditModal(true);
  };

  const handleComplete = async (reminder: Reminder) => {
    if (reminder.completedAt) return;

    setProcessingIds((prev) => new Set(prev).add(reminder.id));
    const optimistic = { ...reminder, completedAt: new Date().toISOString() };
    updateReminderState(optimistic);

    try {
      const completed = await reminderService.completeReminder(reminder.id);
      updateReminderState(completed);
      showToast({
        title: t('reminderComplete'),
        description: t('reminderCompletedDescription', {
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
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(reminder.id);
        return next;
      });
    }
  };

  const handleRevert = async (reminder: Reminder) => {
    setProcessingIds((prev) => new Set(prev).add(reminder.id));
    const optimistic = { ...reminder, completedAt: null };
    updateReminderState(optimistic);

    try {
      await reminderService.revertCompletion(reminder.id);
      showToast({
        title: t('completionReverted'),
        description: t('revertDescription', { title: reminder.title }),
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
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(reminder.id);
        return next;
      });
    }
  };

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

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
          <Navigation />
          <div className="flex items-center justify-center h-[calc(100vh-4rem)] lg:h-screen">
            <div className="text-muted-foreground">
              {t('loadingReminders')}
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

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

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
        <Navigation />
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="flex flex-col gap-4 mb-8 md:hidden">
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-1">
                {t('title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('description')}
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('newReminder')}
              </Button>
            </div>
          </div>

          <div className="hidden md:flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-2">
                {t('title')}
              </h1>
              <p className="text-muted-foreground">{t('description')}</p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('newReminder')}
            </Button>
          </div>

          {reminders.length === 0 ? (
            <Card className="text-center py-12 bg-muted/30">
              <CardContent>
                <div className="text-muted-foreground mb-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {t('noRemindersYet')}
                  </h3>
                  <p>{t('noRemindersDescription')}</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)}>
                  {t('createFirstReminder')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {BUCKET_ORDER.map((bucket) => {
                const bucketReminders = remindersByBucket[bucket] || [];
                const config = BUCKET_CONFIG[bucket];

                if (bucketReminders.length === 0) return null;

                return (
                  <div key={bucket} className="space-y-4">
                    <CategoryHeader
                      icon={config.icon}
                      label={config.label}
                      description={config.description}
                      accentColor={config.accentColor}
                      iconColor={config.iconColor}
                      summaryValue={bucketReminders.length.toString()}
                      summaryLabel={tCommon('total')}
                      itemCount={bucketReminders.length}
                      itemName={t('remindersTotal')}
                    />
                    <div className="space-y-4">
                      {bucketReminders.map((reminder) => {
                        const status = getReminderStatus(reminder, now);
                        const isCompletable =
                          status === 'active' || status === 'missed';

                        return (
                          <EntityCard
                            key={reminder.id}
                            title={reminder.title}
                            subtitle={reminder.description}
                            badges={buildBadges(reminder, status)}
                            metadata={renderCountdown(reminder, status)}
                            isCompleted={status === 'completed'}
                            onClick={
                              status === 'active' || status === 'missed'
                                ? () => handleComplete(reminder)
                                : undefined
                            }
                            onEdit={() => handleEditReminder(reminder)}
                            onDelete={() => handleDeleteReminder(reminder.id)}
                            isProcessing={processingIds.has(reminder.id)}
                            extraMenuItems={
                              status === 'completed'
                                ? [
                                    {
                                      label: t('revertCompletion'),
                                      icon: Undo2,
                                      onClick: () => handleRevert(reminder),
                                      disabled: processingIds.has(reminder.id),
                                    },
                                  ]
                                : isCompletable
                                  ? [
                                      {
                                        label: t('completeNow'),
                                        icon: Check,
                                        onClick: () => handleComplete(reminder),
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
                                      <div className="mb-1">
                                        {reminder.description}
                                      </div>
                                    )}
                                    <div>
                                      {t('dueBy', {
                                        date: formatDateTime(
                                          new Date(reminder.dueAt)
                                        ),
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
            </div>
          )}

          <CreateReminderModal
            open={showCreateModal}
            onOpenChange={setShowCreateModal}
            onReminderCreated={handleReminderCreated}
          />
          <EditReminderModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            reminder={editingReminder}
            onReminderUpdated={handleReminderUpdated}
          />
        </div>
      </div>
    </AuthGuard>
  );
}
