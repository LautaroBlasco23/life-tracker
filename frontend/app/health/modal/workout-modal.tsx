'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import type {
  Exercise,
  WorkoutSession,
  SessionExercise,
  WorkoutSet,
} from '@shared/types';
import { healthService } from '@shared/services/health-service';
import { showToast } from '@/lib/toast';
import { dateInputToISO, isoToDateInput, todayInput } from '@shared/utils/format';
import { useTranslations } from '@shared/contexts/language-context';

interface WorkoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editingWorkout?: WorkoutSession | null;
  exercises: Exercise[];
}

interface DraftExercise {
  exerciseId: string;
  sets: WorkoutSet[];
}

export function WorkoutModal({
  open,
  onOpenChange,
  onSaved,
  editingWorkout,
  exercises,
}: WorkoutModalProps) {
  const t = useTranslations('health');
  const tCommon = useTranslations('common');

  const [date, setDate] = useState(todayInput());
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const emptyDraft = (): DraftExercise => ({
    exerciseId: exercises[0]?.id ?? '',
    sets: [{ reps: 10, weightKg: 0 }],
  });

  const resetForm = () => {
    setDate(todayInput());
    setDuration('');
    setNotes('');
    setDraftExercises(exercises.length > 0 ? [emptyDraft()] : []);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (!isLoading) resetForm();
      onOpenChange(false);
      return;
    }
    if (editingWorkout) {
      setDate(isoToDateInput(editingWorkout.date));
      setDuration(
        editingWorkout.durationMinutes
          ? String(editingWorkout.durationMinutes)
          : ''
      );
      setNotes(editingWorkout.notes ?? '');
      setDraftExercises(
        editingWorkout.exercises.map((se) => ({
          exerciseId: se.exerciseId,
          sets: se.sets.map((set) => ({ ...set })),
        }))
      );
    } else {
      resetForm();
    }
    onOpenChange(true);
  };

  const updateExercise = (index: number, exerciseId: string) => {
    setDraftExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, exerciseId } : ex))
    );
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof WorkoutSet,
    value: string
  ) => {
    setDraftExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exerciseIndex) return ex;
        const sets = ex.sets.map((set, j) =>
          j === setIndex
            ? {
                ...set,
                [field]:
                  field === 'reps'
                    ? parseInt(value) || 0
                    : parseFloat(value) || 0,
              }
            : set
        );
        return { ...ex, sets };
      })
    );
  };

  const addSet = (exerciseIndex: number) => {
    setDraftExercises((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex
          ? { ...ex, sets: [...ex.sets, { reps: 10, weightKg: 0 }] }
          : ex
      )
    );
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setDraftExercises((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex
          ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIndex) }
          : ex
      )
    );
  };

  const addExercise = () => {
    setDraftExercises((prev) => [...prev, emptyDraft()]);
  };

  const removeExercise = (index: number) => {
    setDraftExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validExercises: SessionExercise[] = draftExercises
      .filter(
        (ex) =>
          ex.exerciseId && ex.sets.length > 0 && ex.sets.some((s) => s.reps > 0)
      )
      .map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets.filter((s) => s.reps > 0),
      }));

    if (validExercises.length === 0) {
      showToast({
        title: tCommon('error'),
        description: t('addExerciseRow'),
        variant: 'destructive',
      });
      return;
    }

    const parsedDuration =
      duration && !isNaN(parseInt(duration)) ? parseInt(duration) : undefined;

    setIsLoading(true);
    try {
      const payload = {
        date: dateInputToISO(date),
        durationMinutes: parsedDuration,
        notes: notes.trim(),
        exercises: validExercises,
      };

      if (editingWorkout) {
        await healthService.updateWorkout(editingWorkout.id, payload);
        showToast({
          title: t('workoutUpdated'),
          description: t('workoutUpdatedDescription'),
        });
      } else {
        await healthService.createWorkout(payload);
        showToast({
          title: t('workoutCreated'),
          description: t('workoutCreatedDescription'),
        });
      }
      onSaved();
    } catch (error) {
      console.error('Save workout error:', error);
      showToast({
        title: t('workoutSaveFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingWorkout ? t('editWorkoutTitle') : t('newWorkoutTitle')}
          </DialogTitle>
          <DialogDescription>{t('editWorkout')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workoutDate">{t('workoutDate')}</Label>
              <Input
                id="workoutDate"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">{t('durationMinutes')}</Label>
              <Input
                id="duration"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="60"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="bg-input border-border"
              />
            </div>
          </div>

          <div className="space-y-4">
            {draftExercises.map((draft, exerciseIndex) => (
              <div
                key={exerciseIndex}
                className="rounded-lg border border-border bg-muted/30 p-3 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Label>{t('exercise')}</Label>
                    <Select
                      value={draft.exerciseId}
                      onValueChange={(value) =>
                        updateExercise(exerciseIndex, value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectExercise')} />
                      </SelectTrigger>
                      <SelectContent>
                        {exercises.map((ex) => (
                          <SelectItem key={ex.id} value={ex.id}>
                            {ex.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExercise(exerciseIndex)}
                    aria-label={t('removeExercise')}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium leading-none">
                    {t('sets')}
                  </span>
                  {draft.sets.map((set, setIndex) => (
                    <div key={setIndex} className="flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        placeholder={t('reps')}
                        value={set.reps || ''}
                        onChange={(e) =>
                          updateSet(
                            exerciseIndex,
                            setIndex,
                            'reps',
                            e.target.value
                          )
                        }
                        className="bg-input border-border w-24"
                        aria-label={t('reps')}
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.5"
                        placeholder={t('weightKg')}
                        value={set.weightKg || ''}
                        onChange={(e) =>
                          updateSet(
                            exerciseIndex,
                            setIndex,
                            'weightKg',
                            e.target.value
                          )
                        }
                        className="bg-input border-border w-28"
                        aria-label={t('weightKg')}
                      />
                      {draft.sets.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSet(exerciseIndex, setIndex)}
                          aria-label={t('removeSet')}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addSet(exerciseIndex)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t('addSet')}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={addExercise}
            disabled={exercises.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('addExerciseRow')}
          </Button>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('notes')}</Label>
            <Textarea
              id="notes"
              placeholder={t('notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-input border-border resize-none"
              rows={2}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  {tCommon('saving')}
                </>
              ) : editingWorkout ? (
                tCommon('save')
              ) : (
                t('addWorkout')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
