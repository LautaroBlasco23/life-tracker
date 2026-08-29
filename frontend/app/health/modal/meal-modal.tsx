'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { MealLog, MealType } from '@shared/types';
import { MEAL_TYPES } from '@shared/types';
import { healthService } from '@shared/services/health-service';
import { showToast } from '@/lib/toast';
import { dateInputToISO, isoToDateInput } from '@/utils/dateLabels';
import { useTranslations } from '@shared/contexts/language-context';

interface MealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editingMeal?: MealLog | null;
  defaultDate: string;
}

export function MealModal({
  open,
  onOpenChange,
  onSaved,
  editingMeal,
  defaultDate,
}: MealModalProps) {
  const t = useTranslations('health');
  const tCommon = useTranslations('common');

  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setMealType('breakfast');
    setName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setDate(defaultDate);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (!isLoading) resetForm();
      onOpenChange(false);
      return;
    }
    if (editingMeal) {
      setMealType(editingMeal.mealType);
      setName(editingMeal.name);
      setCalories(editingMeal.calories ? String(editingMeal.calories) : '');
      setProtein(editingMeal.protein ? String(editingMeal.protein) : '');
      setCarbs(editingMeal.carbs ? String(editingMeal.carbs) : '');
      setFat(editingMeal.fat ? String(editingMeal.fat) : '');
      setDate(isoToDateInput(editingMeal.date));
    } else {
      resetForm();
    }
    onOpenChange(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast({
        title: tCommon('error'),
        description: t('enterMealNameError'),
        variant: 'destructive',
      });
      return;
    }

    const parseFloatField = (value: string) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    };

    setIsLoading(true);
    try {
      const payload = {
        mealType,
        name: name.trim(),
        calories: parseFloatField(calories),
        protein: parseFloatField(protein),
        carbs: parseFloatField(carbs),
        fat: parseFloatField(fat),
      };

      if (editingMeal) {
        await healthService.updateMealLog(editingMeal.id, {
          ...payload,
          date: dateInputToISO(date),
        });
        showToast({
          title: t('mealUpdated'),
          description: t('mealUpdatedDescription'),
        });
      } else {
        await healthService.createMealLog({
          ...payload,
          date: dateInputToISO(date),
        });
        showToast({
          title: t('mealCreated'),
          description: t('mealCreatedDescription'),
        });
      }
      onSaved();
    } catch (error) {
      console.error('Save meal error:', error);
      showToast({
        title: t('mealSaveFailed'),
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingMeal ? t('editMealTitle') : t('newMealTitle')}
          </DialogTitle>
          <DialogDescription>{t('editMeal')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mealType">{t('mealType')}</Label>
              <Select
                value={mealType}
                onValueChange={(value: MealType) => setMealType(value)}
              >
                <SelectTrigger id="mealType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">{t('date')}</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="bg-input border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mealName">{t('mealName')}</Label>
            <Input
              id="mealName"
              placeholder={t('mealNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-input border-border"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="calories">{t('calories')}</Label>
              <Input
                id="calories"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protein">{t('protein')}</Label>
              <Input
                id="protein"
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carbs">{t('carbs')}</Label>
              <Input
                id="carbs"
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fat">{t('fat')}</Label>
              <Input
                id="fat"
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="bg-input border-border"
              />
            </div>
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
              {isLoading
                ? tCommon('saving')
                : editingMeal
                  ? tCommon('save')
                  : t('addMeal')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
