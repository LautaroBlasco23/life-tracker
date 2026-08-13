'use client';

import { useState, useEffect, useCallback } from 'react';
import { addDays, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { MealLog, MealType, NutritionSummary } from '@/types';
import { healthService } from '@/services/health-service';
import { showToast } from '@/lib/toast';
import { getDayKey } from '@/utils/dateLabels';
import { useTranslations } from '@/contexts/language-context';
import { DeleteModal } from '@/components/ui/card/delete-modal';
import { MealModal } from '../modal/meal-modal';
import { NutritionChart } from './nutrition-chart';

const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function NutritionTab() {
  const t = useTranslations('health');
  const tCommon = useTranslations('common');

  const [selectedDate, setSelectedDate] = useState(getDayKey(new Date()));
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [summary, setSummary] = useState<NutritionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMealModal, setShowMealModal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealLog | null>(null);
  const [deletingMeal, setDeletingMeal] = useState<MealLog | null>(null);

  const loadMeals = useCallback(async () => {
    try {
      const [mealLogs, weekSummary] = await Promise.all([
        healthService.getMealLogs({
          startDate: selectedDate,
          endDate: selectedDate,
        }),
        (() => {
          const end = new Date(`${selectedDate}T00:00:00`);
          const start = subDays(end, 6);
          return healthService.getNutritionSummary(
            getDayKey(start),
            getDayKey(end)
          );
        })(),
      ]);
      setMeals(mealLogs);
      setSummary(weekSummary);
    } catch (error) {
      console.error('Failed to load nutrition data:', error);
      showToast({
        title: t('mealSaveFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, t]);

  useEffect(() => {
    setIsLoading(true);
    loadMeals();
  }, [loadMeals]);

  const shiftDay = (offset: number) => {
    const current = new Date(`${selectedDate}T00:00:00`);
    setSelectedDate(getDayKey(addDays(current, offset)));
  };

  const totals = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const handleMealSaved = () => {
    setShowMealModal(false);
    setEditingMeal(null);
    loadMeals();
  };

  const handleConfirmDelete = async () => {
    if (!deletingMeal) return;
    try {
      await healthService.deleteMealLog(deletingMeal.id);
      showToast({
        title: t('mealDeleted'),
        description: t('mealDeletedDescription'),
      });
      setDeletingMeal(null);
      loadMeals();
    } catch (error) {
      showToast({
        title: t('mealDeleteFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Date navigation + totals */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('dailyTotals')}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftDay(-1)}>
              ←
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) =>
                e.target.value && setSelectedDate(e.target.value)
              }
              className="w-40 bg-input border-border"
              aria-label={t('date')}
            />
            <Button variant="outline" size="sm" onClick={() => shiftDay(1)}>
              →
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">
                  {t('calories')}
                </div>
                <div className="text-xl font-bold">
                  {Math.round(totals.calories)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">
                  {t('protein')}
                </div>
                <div className="text-xl font-bold">
                  {Math.round(totals.protein)}g
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">
                  {t('carbs')}
                </div>
                <div className="text-xl font-bold">
                  {Math.round(totals.carbs)}g
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">{t('fat')}</div>
                <div className="text-xl font-bold">
                  {Math.round(totals.fat)}g
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('weeklySummary')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <NutritionChart daily={summary?.daily ?? []} />
          )}
        </CardContent>
      </Card>

      {/* Meals of the day */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('meals')}</CardTitle>
          <Button size="sm" onClick={() => setShowMealModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('addMeal')}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : meals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('noMealsForDay')}
            </p>
          ) : (
            <ul className="space-y-3">
              {MEAL_TYPE_ORDER.filter((type) =>
                meals.some((meal) => meal.mealType === type)
              ).map((type) => (
                <li key={type} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t(type)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {t('mealCount', {
                        count: meals.filter((m) => m.mealType === type).length,
                      })}
                    </span>
                  </div>
                  {meals
                    .filter((meal) => meal.mealType === type)
                    .map((meal) => (
                      <div
                        key={meal.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {meal.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Math.round(meal.calories)} kcal · P{' '}
                            {Math.round(meal.protein)}g · C{' '}
                            {Math.round(meal.carbs)}g · F {Math.round(meal.fat)}
                            g
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingMeal(meal);
                              setShowMealModal(true);
                            }}
                            aria-label={t('editMeal')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingMeal(meal)}
                            aria-label={t('deleteMealTitle')}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <MealModal
        open={showMealModal}
        onOpenChange={(open) => {
          setShowMealModal(open);
          if (!open) setEditingMeal(null);
        }}
        onSaved={handleMealSaved}
        editingMeal={editingMeal}
        defaultDate={selectedDate}
      />

      <DeleteModal
        open={deletingMeal !== null}
        onOpenChange={(open) => !open && setDeletingMeal(null)}
        title={t('deleteMealTitle')}
        itemName={deletingMeal?.name ?? ''}
        itemDetails={
          <span className="text-sm text-muted-foreground">
            {deletingMeal
              ? `${Math.round(deletingMeal.calories)} kcal · ${t(
                  deletingMeal.mealType
                )}`
              : ''}
          </span>
        }
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
