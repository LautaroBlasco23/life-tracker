'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthGuard } from '@/components/auth-guard';
import { Navigation } from '@/components/navigation';
import { EntityCard } from '@/components/ui/card/entityCard';
import { routineService } from '@shared/services/routine-service';
import type { Routine } from '@shared/types';
import { Plus, ListChecks } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { CreateRoutineModal } from './modal/create-routine-modal';
import { EditRoutineModal } from './modal/edit-routine-modal';
import { RoutineDetailModal } from './modal/routine-detail-modal';
import { useTranslations } from '@shared/contexts/language-context';

const CHIP_LIMIT = 3;

export default function RoutinesPage() {
  const t = useTranslations('routines');
  const tPrivacy = useTranslations('privacy');

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [detailRoutineId, setDetailRoutineId] = useState<number | null>(null);

  const loadRoutines = useCallback(async () => {
    try {
      setIsLoading(true);
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
  }, []);

  useEffect(() => {
    loadRoutines();
  }, [loadRoutines]);

  const handleDeleteRoutine = async (routineId: number) => {
    try {
      await routineService.deleteRoutine(routineId);
      setRoutines(routines.filter((routine) => routine.id !== routineId));
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

  const handleRoutineCreated = (routine: Routine) => {
    setRoutines([routine, ...routines]);
    setShowCreateModal(false);
  };

  const handleRoutineUpdated = (updated: Routine) => {
    setRoutines(
      routines.map((routine) => (routine.id === updated.id ? updated : routine))
    );
    setShowEditModal(false);
    setEditingRoutine(null);
  };

  const handleEditRoutine = (routine: Routine) => {
    setEditingRoutine(routine);
    setShowEditModal(true);
  };

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
          <Navigation />
          <div className="flex items-center justify-center h-[calc(100vh-4rem)] lg:h-screen">
            <div className="text-muted-foreground">{t('loadingRoutines')}</div>
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
                {t('title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('description')}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('newRoutine')}
            </Button>
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
              {t('newRoutine')}
            </Button>
          </div>

          {routines.length === 0 ? (
            <Card className="text-center py-12 bg-muted/30">
              <CardContent>
                <div className="text-muted-foreground mb-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <ListChecks className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {t('noRoutines')}
                  </h3>
                  <p>{t('noRoutinesDescription')}</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)}>
                  {t('createFirstRoutine')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {routines.map((routine) => {
                const sortedActivities = [...routine.activities].sort(
                  (a, b) => a.position - b.position
                );
                const visibleChips = sortedActivities.slice(0, CHIP_LIMIT);
                const hiddenCount =
                  sortedActivities.length - visibleChips.length;

                return (
                  <EntityCard
                    key={routine.id}
                    title={routine.title}
                    subtitle={routine.description}
                    badges={[
                      {
                        label:
                          routine.privacyStatus === 'public'
                            ? tPrivacy('public')
                            : tPrivacy('private'),
                        variant:
                          routine.privacyStatus === 'public'
                            ? 'default'
                            : 'secondary',
                      },
                    ]}
                    metadata={
                      sortedActivities.length > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {visibleChips.map((activity) => (
                            <Badge
                              key={activity.activityId}
                              variant="outline"
                              className="text-xs"
                            >
                              {activity.activityTitle}
                            </Badge>
                          ))}
                          {hiddenCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              +{hiddenCount}
                            </span>
                          )}
                        </div>
                      ) : undefined
                    }
                    onClick={() => setDetailRoutineId(routine.id)}
                    onEdit={() => handleEditRoutine(routine)}
                    onDelete={() => handleDeleteRoutine(routine.id)}
                    deleteModal={{
                      title: t('deleteRoutine'),
                      itemName: routine.title,
                      confirmLabel: t('deleteRoutine'),
                      itemDetails: (
                        <div className="text-sm">
                          <div className="font-medium text-foreground mb-1">
                            {routine.title}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {t('activityCount', {
                              count: routine.activities.length,
                            })}
                            <div className="mt-1">
                              {t('deleteRoutineKeepsActivities')}
                            </div>
                          </div>
                        </div>
                      ),
                    }}
                  />
                );
              })}
            </div>
          )}

          <CreateRoutineModal
            open={showCreateModal}
            onOpenChange={setShowCreateModal}
            onRoutineCreated={handleRoutineCreated}
          />
          <EditRoutineModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            routine={editingRoutine}
            onRoutineUpdated={handleRoutineUpdated}
          />
          <RoutineDetailModal
            open={detailRoutineId !== null}
            onOpenChange={(open) => {
              if (!open) setDetailRoutineId(null);
            }}
            routineId={detailRoutineId}
          />
        </div>
      </div>
    </AuthGuard>
  );
}
