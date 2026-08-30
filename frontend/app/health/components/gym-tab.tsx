'use client';

import { useState, useEffect, useCallback } from 'react';
import { subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import type {
  Exercise,
  WorkoutSession,
  GymStats,
  MuscleVolume,
  WeeklyVolume,
} from '@shared/types';
import { healthService } from '@shared/services/health-service';
import { showToast } from '@/lib/toast';
import { getDayKey, formatShortDate } from '@shared/utils/format';
import { useTranslations } from '@shared/contexts/language-context';
import { DeleteModal } from '@/components/ui/card/delete-modal';
import { WorkoutModal } from '../modal/workout-modal';
import { ExerciseManager } from './exercise-manager';
import { MuscleVolumeChart } from './muscle-volume-chart';
import { VolumeTrendChart } from './volume-trend-chart';

function lastFourWeeks(): { start: string; end: string } {
  const end = new Date();
  const start = subDays(end, 27);
  return { start: getDayKey(start), end: getDayKey(end) };
}

export function GymTab() {
  const t = useTranslations('health');

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [stats, setStats] = useState<GymStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(
    null
  );
  const [deletingWorkout, setDeletingWorkout] = useState<WorkoutSession | null>(
    null
  );

  const loadData = useCallback(async () => {
    try {
      const range = lastFourWeeks();
      const [exerciseList, workoutList, gymStats] = await Promise.all([
        healthService.getExercises(),
        healthService.getWorkouts(),
        healthService.getGymStats(range.start, range.end),
      ]);
      setExercises(exerciseList);
      setWorkouts(workoutList);
      setStats(gymStats);
    } catch (error) {
      console.error('Failed to load gym data:', error);
      showToast({
        title: t('workoutSaveFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const exerciseById = useCallback(
    (id: string): Exercise | undefined => exercises.find((ex) => ex.id === id),
    [exercises]
  );

  const handleWorkoutSaved = () => {
    setShowWorkoutModal(false);
    setEditingWorkout(null);
    loadData();
  };

  const handleConfirmDeleteWorkout = async () => {
    if (!deletingWorkout) return;
    try {
      await healthService.deleteWorkout(deletingWorkout.id);
      showToast({
        title: t('workoutDeleted'),
        description: t('workoutDeletedDescription'),
      });
      setDeletingWorkout(null);
      loadData();
    } catch (error) {
      showToast({
        title: t('workoutDeleteFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats + charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('muscleVolumeTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {t('muscleVolumeDescription')}
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MuscleVolumeChart
                muscleVolume={(stats?.muscleVolume as MuscleVolume[]) ?? []}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('weeklyVolumeTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {t('weeklyVolumeDescription')}
            </p>
            <Badge variant="secondary" className="mt-1">
              {t('periodLabel')}
            </Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <VolumeTrendChart
                weeklyVolume={(stats?.weeklyVolume as WeeklyVolume[]) ?? []}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Workouts */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('workouts')}</CardTitle>
          <Button
            size="sm"
            onClick={() => setShowWorkoutModal(true)}
            disabled={exercises.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('addWorkout')}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : workouts.length === 0 ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('noWorkouts')}</p>
              {exercises.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('addExerciseHint')}
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {workouts.map((workout) => {
                const totalSets = workout.exercises.reduce(
                  (acc, ex) => acc + ex.sets.length,
                  0
                );
                return (
                  <li
                    key={workout.id}
                    className="rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {formatShortDate(new Date(workout.date))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {workout.exercises.length} {t('exercise')} ·{' '}
                          {totalSets} {t('sets')}
                          {workout.durationMinutes
                            ? ` · ${workout.durationMinutes} ${t(
                                'durationMinutes'
                              )}`
                            : ''}
                        </div>
                        {workout.notes && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {workout.notes}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {workout.exercises.map((se) => {
                            const ex = exerciseById(se.exerciseId);
                            return (
                              <Badge
                                key={se.exerciseId}
                                variant="outline"
                                className="text-xs"
                              >
                                {ex ? ex.name : t('unknownExercise')}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingWorkout(workout);
                            setShowWorkoutModal(true);
                          }}
                          aria-label={t('editWorkout')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingWorkout(workout)}
                          aria-label={t('deleteWorkoutTitle')}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Exercise catalog */}
      <ExerciseManager exercises={exercises} onExercisesChanged={loadData} />

      <WorkoutModal
        open={showWorkoutModal}
        onOpenChange={(open) => {
          setShowWorkoutModal(open);
          if (!open) setEditingWorkout(null);
        }}
        onSaved={handleWorkoutSaved}
        editingWorkout={editingWorkout}
        exercises={exercises}
      />

      <DeleteModal
        open={deletingWorkout !== null}
        onOpenChange={(open) => !open && setDeletingWorkout(null)}
        title={t('deleteWorkoutTitle')}
        itemName={formatShortDate(
          deletingWorkout ? new Date(deletingWorkout.date) : new Date()
        )}
        itemDetails={
          <span className="text-sm text-muted-foreground">
            {deletingWorkout?.exercises.length ?? 0} {t('exercise')}
          </span>
        }
        onConfirm={handleConfirmDeleteWorkout}
      />
    </div>
  );
}
