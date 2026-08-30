import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import type { MealLog, MealType } from '@shared/types/health';
import { healthService, useTranslations } from '@shared';
import { dateInputToISO, isoToDateInput, todayInput } from '@shared/utils/format';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { OptionSelect } from '../ui/option-select';

interface MealModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  meal?: MealLog | null;
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function MealModal({ visible, onClose, onSaved, meal }: MealModalProps) {
  const t = useTranslations('health');
  const tCommon = useTranslations('common');

  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [date, setDate] = useState(todayInput());
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = meal != null;

  useEffect(() => {
    if (!visible) return;
    if (meal) {
      setMealType(meal.mealType);
      setName(meal.name);
      setCalories(String(meal.calories || ''));
      setProtein(String(meal.protein || ''));
      setCarbs(String(meal.carbs || ''));
      setFat(String(meal.fat || ''));
      setDate(isoToDateInput(meal.date));
    } else {
      setMealType('breakfast');
      setName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setDate(todayInput());
    }
  }, [visible, meal]);

  const parse = (value: string) => {
    const n = parseFloat(value);
    return isNaN(n) ? undefined : n;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert(t('enterMealNameError'));
      return;
    }
    setIsSaving(true);
    try {
      if (isEditing) {
        await healthService.updateMealLog(meal.id, {
          mealType,
          name: name.trim(),
          calories: parse(calories),
          protein: parse(protein),
          carbs: parse(carbs),
          fat: parse(fat),
        });
      } else {
        await healthService.createMealLog({
          mealType,
          name: name.trim(),
          calories: parse(calories),
          protein: parse(protein),
          carbs: parse(carbs),
          fat: parse(fat),
          date: dateInputToISO(date),
        });
      }
      onSaved();
      onClose();
    } catch {
      Alert.alert(t('mealSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
            {isEditing ? t('editMealTitle') : t('newMealTitle')}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <OptionSelect
              label={t('mealType')}
              value={mealType}
              options={MEAL_TYPES.map((m) => ({ value: m, label: t(m) }))}
              onSelect={setMealType}
            />
            <View className="h-4" />
            <FormField
              label={t('mealName')}
              placeholder={t('mealNamePlaceholder')}
              value={name}
              onChangeText={setName}
            />
            <View className="h-4" />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label={t('calories')} placeholder="0" value={calories} onChangeText={setCalories} keyboardType="number-pad" />
              </View>
              <View className="flex-1">
                <FormField label={t('protein')} placeholder="0" value={protein} onChangeText={setProtein} keyboardType="number-pad" />
              </View>
            </View>
            <View className="flex-row gap-3 mt-4">
              <View className="flex-1">
                <FormField label={t('carbs')} placeholder="0" value={carbs} onChangeText={setCarbs} keyboardType="number-pad" />
              </View>
              <View className="flex-1">
                <FormField label={t('fat')} placeholder="0" value={fat} onChangeText={setFat} keyboardType="number-pad" />
              </View>
            </View>
            <View className="h-4" />
            {!isEditing ? (
              <FormField label={t('date')} placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
            ) : null}
            <View className="flex-row gap-3 mt-6 mb-2">
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
