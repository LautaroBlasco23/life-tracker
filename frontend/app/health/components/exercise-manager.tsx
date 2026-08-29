'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Loader2, Dumbbell } from 'lucide-react';
import type { Exercise } from '@shared/types';
import { MUSCLE_GROUPS } from '@shared/types';
import { healthService } from '@shared/services/health-service';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@shared/contexts/language-context';
import { DeleteModal } from '@/components/ui/card/delete-modal';

interface ExerciseManagerProps {
  exercises: Exercise[];
  onExercisesChanged: () => void;
}

export function ExerciseManager({
  exercises,
  onExercisesChanged,
}: ExerciseManagerProps) {
  const t = useTranslations('health');

  const [name, setName] = useState('');
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingExercise, setDeletingExercise] = useState<Exercise | null>(
    null
  );

  const toggleMuscle = (group: string) => {
    setMuscleGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || muscleGroups.length === 0) return;

    setIsSaving(true);
    try {
      await healthService.createExercise({
        name: name.trim(),
        muscleGroups,
      });
      setName('');
      setMuscleGroups([]);
      showToast({ title: t('exerciseCreated') });
      onExercisesChanged();
    } catch (error) {
      showToast({
        title: t('exerciseSaveFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingExercise) return;
    try {
      await healthService.deleteExercise(deletingExercise.id);
      showToast({
        title: t('exerciseDeleted'),
        description: t('exerciseDeletedDescription'),
      });
      setDeletingExercise(null);
      onExercisesChanged();
    } catch (error) {
      showToast({
        title: t('exerciseDeleteFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-muted-foreground" />
          {t('exercisesTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddExercise} className="space-y-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="exerciseName">{t('exerciseName')}</Label>
            <Input
              id="exerciseName"
              placeholder={t('exerciseNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-input border-border"
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium leading-none">
              {t('muscleGroups')}
            </span>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => toggleMuscle(group)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    muscleGroups.includes(group)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={isSaving || !name.trim() || muscleGroups.length === 0}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            {t('addExercise')}
          </Button>
        </form>

        {exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('addExerciseHint')}
          </p>
        ) : (
          <ul className="space-y-2">
            {exercises.map((exercise) => (
              <li
                key={exercise.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{exercise.name}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {exercise.muscleGroups.map((group) => (
                      <Badge key={group} variant="outline" className="text-xs">
                        {group}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeletingExercise(exercise)}
                  aria-label={t('deleteExerciseTitle')}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <DeleteModal
        open={deletingExercise !== null}
        onOpenChange={(open) => !open && setDeletingExercise(null)}
        title={t('deleteExerciseTitle')}
        itemName={deletingExercise?.name ?? ''}
        itemDetails={
          <span className="text-sm text-muted-foreground">
            {deletingExercise?.muscleGroups.join(', ')}
          </span>
        }
        onConfirm={handleConfirmDelete}
      />
    </Card>
  );
}
