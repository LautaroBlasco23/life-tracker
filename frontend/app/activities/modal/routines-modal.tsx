'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { DeleteModal } from '@/components/ui/card/delete-modal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Plus,
  Search,
  ChevronLeft,
  Play,
  Square,
  Pencil,
  Trash2,
  ListChecks,
} from 'lucide-react';
import { routineService } from '@shared/services/routine-service';
import type {
  Routine,
  RoutineActivityItem,
  RoutineStatus,
} from '@shared/types';
import { showToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useTranslations } from '@shared/contexts/language-context';
import { CreateRoutineModal } from './create-routine-modal';
import { EditRoutineModal } from './edit-routine-modal';

interface RoutinesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Routine to preselect when opening (e.g. from an activity badge click). */
  initialRoutineId?: number | null;
}

const STATUS_OPTIONS: RoutineStatus[] = ['draft', 'active', 'stopped'];

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

function RoutineActivityCard({
  item,
}: {
  item: RoutineActivityItem;
}) {
  const tActivities = useTranslations('activities');
  const tPrivacy = useTranslations('privacy');

  const badges: Array<{
    label: string;
    variant: 'default' | 'outline' | 'secondary';
  }> = [{ label: tActivities(item.frequency), variant: 'outline' }];
  if (item.frequency === 'weekly') {
    const days = formatDayFrequency(item.dayFrequency);
    if (days) badges.push({ label: days, variant: 'outline' });
  }
  if (item.dayTime && item.dayTime !== 'notSpecified') {
    badges.push({ label: tActivities(item.dayTime), variant: 'outline' });
  }
  badges.push({
    label: tPrivacy(item.privacyStatus),
    variant: 'secondary',
  });

  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0 mt-0.5">
            {item.position + 1}
          </span>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="font-medium text-foreground break-words">
              {item.activityTitle}
            </div>
            {item.description && (
              <p className="text-sm text-muted-foreground break-words">
                {item.description}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {badges.map((badge, index) => (
                <Badge key={index} variant={badge.variant} className="text-xs">
                  {badge.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RoutinesModal({
  open,
  onOpenChange,
  initialRoutineId = null,
}: RoutinesModalProps) {
  const t = useTranslations('routines');
  const tCommon = useTranslations('common');
  const tPrivacy = useTranslations('privacy');

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(
    null
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RoutineStatus>(
    'all'
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingRoutine, setDeletingRoutine] = useState<Routine | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const loadRoutines = useCallback(async () => {
    setIsLoading(true);
    try {
      const userRoutines = await routineService.getRoutines();
      setRoutines(userRoutines);
    } catch (error) {
      console.error('Failed to load routines:', error);
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
    if (open) {
      loadRoutines();
      setSelectedRoutineId(initialRoutineId);
      setSearch('');
      setStatusFilter('all');
    } else {
      setSelectedRoutineId(null);
    }
  }, [open, initialRoutineId, loadRoutines]);

  const selectedRoutine =
    routines.find((routine) => routine.id === selectedRoutineId) ?? null;

  const filteredRoutines = useMemo(() => {
    const query = search.trim().toLowerCase();
    return routines.filter((routine) => {
      if (statusFilter !== 'all' && (routine.status ?? 'active') !== statusFilter)
        return false;
      if (query) {
        const haystack = `${routine.title} ${routine.description}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [routines, search, statusFilter]);

  const handleRoutineCreated = (routine: Routine) => {
    setRoutines([routine, ...routines]);
    setSelectedRoutineId(routine.id);
    setShowCreateModal(false);
  };

  const handleRoutineUpdated = (updated: Routine) => {
    setRoutines(
      routines.map((routine) => (routine.id === updated.id ? updated : routine))
    );
    setShowEditModal(false);
  };

  const handleStatusChange = async (
    routine: Routine,
    status: RoutineStatus
  ) => {
    setIsUpdatingStatus(true);
    const previous = routines;
    setRoutines(
      routines.map((r) => (r.id === routine.id ? { ...r, status } : r))
    );
    try {
      const updated = await routineService.updateRoutine(routine.id, { status });
      setRoutines(
        previous.map((r) => (r.id === updated.id ? updated : r))
      );
    } catch (error) {
      setRoutines(previous);
      showToast({
        title: t('updateFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteRoutine = async (routineId: number) => {
    try {
      await routineService.deleteRoutine(routineId);
      const remaining = routines.filter(
        (routine) => routine.id !== routineId
      );
      setRoutines(remaining);
      if (selectedRoutineId === routineId) setSelectedRoutineId(null);
      showToast({
        title: t('routineDeleted'),
        description: t('routineDeletedDescription'),
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

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setShowCreateModal(false);
      setShowEditModal(false);
      setDeletingRoutine(null);
    }
    onOpenChange(newOpen);
  };

  const sortedActivities = selectedRoutine
    ? [...selectedRoutine.activities].sort((a, b) => a.position - b.position)
    : [];

  const statusBadgeClass: Record<RoutineStatus, string> = {
    draft: 'border-dashed text-muted-foreground',
    active: '',
    stopped: 'text-muted-foreground opacity-80',
  };

  const renderStatusBadge = (status?: RoutineStatus) => {
    const value: RoutineStatus = status ?? 'active';
    return (
      <Badge variant="outline" className={cn('text-xs', statusBadgeClass[value])}>
        {t(`status_${value}`)}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[85vh] max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left pane: routine list */}
          <aside
            className={cn(
              'w-full md:w-72 shrink-0 border-r flex flex-col min-h-0',
              selectedRoutineId ? 'hidden md:flex' : 'flex'
            )}
          >
            <div className="p-4 space-y-3 shrink-0">
              <Button
                size="sm"
                className="w-full"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="h-4 w-4" />
                {t('newRoutine')}
              </Button>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchRoutines')}
                  className="pl-8 h-8 bg-input border-border"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {(['all', 'draft', 'active', 'stopped'] as const).map(
                  (value) => (
                    <Button
                      key={value}
                      variant={statusFilter === value ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setStatusFilter(value)}
                    >
                      {value === 'all'
                        ? t('allStatuses')
                        : t(`status_${value}`)}
                    </Button>
                  )
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('loadingRoutines')}
                </div>
              ) : filteredRoutines.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground px-4">
                  <ListChecks className="h-8 w-8" />
                  <p className="text-sm">
                    {routines.length === 0
                      ? t('noRoutines')
                      : t('noMatchingRoutines')}
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredRoutines.map((routine) => (
                    <li key={routine.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedRoutineId(routine.id)}
                        className={cn(
                          'w-full text-left rounded-md px-3 py-2.5 transition-colors hover:bg-accent',
                          selectedRoutineId === routine.id && 'bg-accent'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {routine.title}
                          </span>
                          {renderStatusBadge(routine.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {t('activityCount', {
                            count: routine.activities.length,
                          })}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* Right pane: selected routine */}
          <section
            className={cn(
              'flex-1 min-w-0 flex flex-col min-h-0',
              selectedRoutineId ? 'flex' : 'hidden md:flex'
            )}
          >
            {!selectedRoutine ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground px-6 text-center">
                {isLoading ? (
                  <div className="flex items-center text-sm">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('loadingRoutines')}
                  </div>
                ) : (
                  <p className="text-sm">{t('selectRoutinePrompt')}</p>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-4 md:px-6 pt-4 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 md:hidden"
                    onClick={() => setSelectedRoutineId(null)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('backToList')}
                  </Button>
                </div>
                <div className="px-4 md:px-6 py-3 border-b shrink-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-semibold text-foreground truncate">
                          {selectedRoutine.title}
                        </h2>
                        {renderStatusBadge(selectedRoutine.status)}
                        <Badge variant="secondary" className="text-xs">
                          {tPrivacy(selectedRoutine.privacyStatus)}
                        </Badge>
                      </div>
                      {selectedRoutine.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {selectedRoutine.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(selectedRoutine.status ?? 'active') === 'active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isUpdatingStatus}
                          onClick={() =>
                            handleStatusChange(selectedRoutine, 'stopped')
                          }
                        >
                          <Square className="h-3.5 w-3.5" />
                          {t('stop')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={isUpdatingStatus}
                          onClick={() =>
                            handleStatusChange(selectedRoutine, 'active')
                          }
                        >
                          <Play className="h-3.5 w-3.5" />
                          {t('start')}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={tCommon('edit')}
                        onClick={() => setShowEditModal(true)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={tCommon('delete')}
                        onClick={() => setDeletingRoutine(selectedRoutine)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t('activityCount', {
                      count: sortedActivities.length,
                    })}
                  </p>
                  {sortedActivities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('noActivitiesInRoutine')}
                    </p>
                  ) : (
                    sortedActivities.map((item) => (
                      <RoutineActivityCard key={item.activityId} item={item} />
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </DialogContent>

      <CreateRoutineModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onRoutineCreated={handleRoutineCreated}
      />
      <EditRoutineModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        routine={selectedRoutine}
        onRoutineUpdated={handleRoutineUpdated}
      />
      <DeleteModal
        open={deletingRoutine !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRoutine(null);
        }}
        title={t('deleteRoutine')}
        itemName={deletingRoutine?.title ?? ''}
        itemDetails={
          <div className="text-sm">
            <div className="font-medium text-foreground mb-1">
              {deletingRoutine?.title}
            </div>
            <div className="text-muted-foreground text-xs">
              {deletingRoutine &&
                t('activityCount', {
                  count: deletingRoutine.activities.length,
                })}
              <div className="mt-1">{t('deleteRoutineKeepsActivities')}</div>
            </div>
          </div>
        }
        confirmLabel={t('deleteRoutine')}
        onConfirm={async () => {
          if (deletingRoutine) {
            await handleDeleteRoutine(deletingRoutine.id);
          }
        }}
      />
    </Dialog>
  );
}
