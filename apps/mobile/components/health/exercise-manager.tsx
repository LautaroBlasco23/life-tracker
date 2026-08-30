import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import type { Exercise } from '@shared/types/health';
import { MUSCLE_GROUPS, healthService, useTranslations } from '@shared';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { cn } from '../../lib/cn';

interface ExerciseManagerProps {
  visible: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onChanged: () => void;
}

export function ExerciseManager({ visible, onClose, exercises, onChanged }: ExerciseManagerProps) {
  const t = useTranslations('health');
  const tCommon = useTranslations('common');

  const [name, setName] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const toggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const handleAdd = async () => {
    if (!name.trim() || selectedGroups.length === 0) {
      Alert.alert(t('exerciseSaveFailed'));
      return;
    }
    setIsSaving(true);
    try {
      await healthService.createExercise({ name: name.trim(), muscleGroups: selectedGroups });
      setName('');
      setSelectedGroups([]);
      onChanged();
    } catch {
      Alert.alert(t('exerciseSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (exercise: Exercise) => {
    Alert.alert(t('deleteExerciseTitle'), exercise.name, [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: tCommon('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await healthService.deleteExercise(exercise.id);
            onChanged();
          } catch {
            Alert.alert(t('exerciseDeleteFailed'));
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
            {t('exercisesTitle')}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <FormField
              label={t('exerciseName')}
              placeholder={t('exerciseNamePlaceholder')}
              value={name}
              onChangeText={setName}
            />
            <View className="h-4" />
            <Text className="text-sm text-foreground dark:text-dark-foreground mb-2">
              {t('muscleGroups')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {MUSCLE_GROUPS.map((group) => (
                <Pressable
                  key={group}
                  onPress={() => toggleGroup(group)}
                  className={cn(
                    'px-3 py-1.5 rounded-full border border-border dark:border-dark-border',
                    selectedGroups.includes(group) && 'bg-primary dark:bg-dark-primary'
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs',
                      selectedGroups.includes(group)
                        ? 'text-secondaryForeground dark:text-dark-secondaryForeground'
                        : 'text-foreground dark:text-dark-foreground'
                    )}
                  >
                    {group}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button onPress={handleAdd} loading={isSaving}>
              <View className="flex-row items-center gap-1.5">
                <Plus size={16} color="#1f2328" />
                <Text className="text-secondaryForeground dark:text-dark-secondaryForeground font-medium">
                  {t('addExercise')}
                </Text>
              </View>
            </Button>

            <Text className="text-sm font-medium text-foreground dark:text-dark-foreground mt-6 mb-2">
              {t('exercisesTitle')} ({exercises.length})
            </Text>
            {exercises.length === 0 ? (
              <Text className="text-sm text-muted dark:text-dark-muted">{t('noExercises')}</Text>
            ) : (
              exercises.map((exercise) => (
                <View
                  key={exercise.id}
                  className="flex-row items-center justify-between py-2.5 border-b border-border dark:border-dark-border"
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-foreground dark:text-dark-foreground">{exercise.name}</Text>
                    <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                      {exercise.muscleGroups.join(', ')}
                    </Text>
                  </View>
                  <Pressable onPress={() => handleDelete(exercise)} className="p-2">
                    <Trash2 size={16} color="#cf222e" />
                  </Pressable>
                </View>
              ))
            )}

            <Button variant="outline" className="mt-6 mb-2" onPress={onClose}>
              {tCommon('close')}
            </Button>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
