import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import type { Exercise, SessionExercise, WorkoutSession } from '@shared/types/health';
import { healthService, useTranslations } from '@shared';
import { dateInputToISO, isoToDateInput, todayInput } from '@shared/utils/format';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { OptionSelect } from '../ui/option-select';

interface WorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  workout?: WorkoutSession | null;
  exercises: Exercise[];
}

interface DraftExercise extends SessionExercise {
  exerciseName: string;
}

export function WorkoutModal({ visible, onClose, onSaved, workout, exercises }: WorkoutModalProps) {
  const t = useTranslations('health');
  const tCommon = useTranslations('common');

  const [date, setDate] = useState(todayInput());
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [drafts, setDrafts] = useState<DraftExercise[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = workout != null;

  useEffect(() => {
    if (!visible) return;
    if (workout) {
      setDate(isoToDateInput(workout.date));
      setDuration(workout.durationMinutes ? String(workout.durationMinutes) : '');
      setNotes(workout.notes ?? '');
      setDrafts(
        workout.exercises.map((se) => ({
          ...se,
          exerciseName: exercises.find((e) => e.id === se.exerciseId)?.name ?? t('unknownExercise'),
        }))
      );
    } else {
      setDate(todayInput());
      setDuration('');
      setNotes('');
      setDrafts(
        exercises.length > 0
          ? [{ exerciseId: exercises[0].id, exerciseName: exercises[0].name, sets: [{ reps: 0, weightKg: 0 }] }]
          : []
      );
    }
  }, [visible, workout, exercises]);

  const addDraft = () => {
    if (exercises.length === 0) return;
    const available = exercises.find((e) => !drafts.some((d) => d.exerciseId === e.id));
    const chosen = available ?? exercises[0];
    setDrafts((prev) => [...prev, { exerciseId: chosen.id, exerciseName: chosen.name, sets: [{ reps: 0, weightKg: 0 }] }]);
  };

  const updateDraft = (index: number, update: Partial<DraftExercise>) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...update } : d)));
  };

  const updateSet = (draftIndex: number, setIndex: number, update: Partial<{ reps: number; weightKg: number }>) => {
    setDrafts((prev) =>
      prev.map((d, i) =>
        i === draftIndex
          ? { ...d, sets: d.sets.map((s, si) => (si === setIndex ? { ...s, ...update } : s)) }
          : d
      )
    );
  };

  const handleSubmit = async () => {
    if (drafts.length === 0) {
      Alert.alert(t('workoutSaveFailed'));
      return;
    }
    setIsSaving(true);
    const payload = {
      date: dateInputToISO(date),
      durationMinutes: duration ? parseInt(duration, 10) : undefined,
      notes: notes.trim() || undefined,
      exercises: drafts.map((d) => ({
        exerciseId: d.exerciseId,
        sets: d.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg })),
      })),
    };
    try {
      if (isEditing) {
        await healthService.updateWorkout(workout.id, payload);
      } else {
        await healthService.createWorkout(payload);
      }
      onSaved();
      onClose();
    } catch {
      Alert.alert(t('workoutSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
        <View className="max-h-[92%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
            {isEditing ? t('editWorkoutTitle') : t('newWorkoutTitle')}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label={t('date')} placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
              </View>
              <View className="flex-1">
                <FormField
                  label={t('durationMinutes')}
                  placeholder="60"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="number-pad"
                />
              </View>
            </View>
            <View className="h-4" />
            <FormField label={t('notes')} placeholder={t('notes')} value={notes} onChangeText={setNotes} />

            <Text className="text-sm font-medium text-foreground dark:text-dark-foreground mt-5 mb-2">
              {t('exercisesTitle')}
            </Text>
            {drafts.map((draft, draftIndex) => (
              <View
                key={`${draft.exerciseId}-${draftIndex}`}
                className="rounded-xl border border-border dark:border-dark-border p-3 mb-3"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-1 mr-2">
                    <OptionSelect
                      label=""
                      value={draft.exerciseId}
                      options={exercises.map((e) => ({ value: e.id, label: e.name }))}
                      onSelect={(v) =>
                        updateDraft(draftIndex, {
                          exerciseId: v,
                          exerciseName: exercises.find((e) => e.id === v)?.name ?? '',
                        })
                      }
                      placeholder={draft.exerciseName}
                    />
                  </View>
                  <Pressable
                    onPress={() => setDrafts((prev) => prev.filter((_, i) => i !== draftIndex))}
                    className="p-2"
                  >
                    <Trash2 size={18} color="#cf222e" />
                  </Pressable>
                </View>

                {draft.sets.map((set, setIndex) => (
                  <View key={setIndex} className="flex-row items-center gap-2 mb-2">
                    <Text className="text-xs text-muted dark:text-dark-muted w-10">
                      #{setIndex + 1}
                    </Text>
                    <TextInput
                      className="h-9 flex-1 rounded-lg border border-border dark:border-dark-border px-2 text-foreground dark:text-dark-foreground"
                      value={set.reps ? String(set.reps) : ''}
                      onChangeText={(v) => updateSet(draftIndex, setIndex, { reps: parseInt(v, 10) || 0 })}
                      placeholder={t('reps')}
                      placeholderTextColor="#57606a"
                      keyboardType="number-pad"
                    />
                    <TextInput
                      className="h-9 flex-1 rounded-lg border border-border dark:border-dark-border px-2 text-foreground dark:text-dark-foreground"
                      value={set.weightKg ? String(set.weightKg) : ''}
                      onChangeText={(v) => updateSet(draftIndex, setIndex, { weightKg: parseFloat(v) || 0 })}
                      placeholder={t('weightKg')}
                      placeholderTextColor="#57606a"
                      keyboardType="decimal-pad"
                    />
                    <Pressable
                      onPress={() =>
                        updateDraft(draftIndex, {
                          sets: draft.sets.filter((_, si) => si !== setIndex),
                        })
                      }
                      className="p-1.5"
                    >
                      <Text className="text-danger dark:text-dark-danger">✕</Text>
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  onPress={() => updateDraft(draftIndex, { sets: [...draft.sets, { reps: 0, weightKg: 0 }] })}
                  className="flex-row items-center mt-1"
                >
                  <Plus size={14} color="#61dafb" />
                  <Text className="text-sm text-primary dark:text-dark-primary ml-1">{t('addSet')}</Text>
                </Pressable>
              </View>
            ))}

            {exercises.length === 0 ? (
              <Text className="text-sm text-muted dark:text-dark-muted mb-2">{t('noExercises')}</Text>
            ) : (
              <Button variant="outline" className="mb-4" onPress={addDraft}>
                <View className="flex-row items-center gap-1.5">
                  <Plus size={16} color="#61dafb" />
                  <Text className="text-foreground dark:text-dark-foreground">{t('addExerciseRow')}</Text>
                </View>
              </Button>
            )}

            <View className="flex-row gap-3 mb-2">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                {tCommon('cancel')}
              </Button>
              <Button className="flex-1" onPress={handleSubmit} loading={isSaving}>
                {tCommon('save')}
              </Button>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
