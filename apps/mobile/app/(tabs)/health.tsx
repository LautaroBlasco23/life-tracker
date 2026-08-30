import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Plus, Settings, Trash2 } from 'lucide-react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useFocusEffect } from 'expo-router';
import type { Exercise, GymStats, MealLog, NutritionSummary, WorkoutSession } from '@shared/types/health';
import { healthService, useTranslations } from '@shared';
import { formatShortDate, getDayKey } from '@shared/utils/format';
import { SegmentedTabs } from '../../components/ui/segmented-tabs';
import { Card, ProgressBar } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { MealModal } from '../../components/health/meal-modal';
import { WorkoutModal } from '../../components/health/workout-modal';
import { ExerciseManager } from '../../components/health/exercise-manager';
import { useTheme } from '../../lib/theme-provider';

type HealthView = 'nutrition' | 'gym';

function last4WeeksRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 28 * 86_400_000);
  const fmt = (d: Date) => getDayKey(d);
  return { start: fmt(start), end: fmt(end) };
}

export default function HealthScreen() {
  const t = useTranslations('health');
  const tCommon = useTranslations('common');
  const { theme } = useTheme();

  const [view, setView] = useState<HealthView>('nutrition');

  // Nutrition
  const [selectedDate, setSelectedDate] = useState(getDayKey(new Date()));
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummary | null>(null);

  // Gym
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [gymStats, setGymStats] = useState<GymStats | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [showMealModal, setShowMealModal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealLog | null>(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null);
  const [showExerciseManager, setShowExerciseManager] = useState(false);

  const spinnerColor = theme === 'dark' ? '#61dafb' : '#0583f2';

  const loadNutrition = useCallback(async () => {
    try {
      const [mealList, summary] = await Promise.all([
        healthService.getMealLogs({ startDate: selectedDate, endDate: selectedDate }),
        healthService.getNutritionSummary(last4WeeksRange().start, last4WeeksRange().end),
      ]);
      setMeals(mealList);
      setNutritionSummary(summary);
    } catch {
      Alert.alert(tCommon('error'));
    }
  }, [selectedDate]);

  const loadGym = useCallback(async () => {
    try {
      const range = last4WeeksRange();
      const [exerciseList, workoutList, stats] = await Promise.all([
        healthService.getExercises(),
        healthService.getWorkouts({ startDate: range.start, endDate: range.end }),
        healthService.getGymStats(range.start, range.end),
      ]);
      setExercises(exerciseList);
      setWorkouts(workoutList);
      setGymStats(stats);
    } catch {
      Alert.alert(tCommon('error'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      Promise.all([loadNutrition(), loadGym()]).finally(() => setIsLoading(false));
    }, [loadNutrition, loadGym])
  );

  const handleDeleteMeal = (meal: MealLog) => {
    Alert.alert(t('deleteMealTitle'), meal.name, [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: tCommon('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await healthService.deleteMealLog(meal.id);
            loadNutrition();
          } catch {
            Alert.alert(t('mealDeleteFailed'));
          }
        },
      },
    ]);
  };

  const handleDeleteWorkout = (workout: WorkoutSession) => {
    Alert.alert(t('deleteWorkoutTitle'), undefined, [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: tCommon('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await healthService.deleteWorkout(workout.id);
            loadGym();
          } catch {
            Alert.alert(t('workoutDeleteFailed'));
          }
        },
      },
    ]);
  };

  const exerciseById = (id: string) => exercises.find((e) => e.id === id);

  const totals = nutritionSummary?.totals;

  const renderMeal = ({ item }: { item: MealLog }) => (
    <Pressable
      onPress={() => {
        setEditingMeal(item);
        setShowMealModal(true);
      }}
      onLongPress={() => handleDeleteMeal(item)}
      className="mx-4 mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
            {item.name}
          </Text>
          <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
            {t(item.mealType)} · {t('calories')}: {item.calories} · P {item.protein}g · C {item.carbs}g · F{' '}
            {item.fat}g
          </Text>
        </View>
        <Pressable onPress={() => handleDeleteMeal(item)} className="p-2">
          <Trash2 size={16} color="#cf222e" />
        </Pressable>
      </View>
    </Pressable>
  );

  const renderWorkout = ({ item }: { item: WorkoutSession }) => {
    const totalSets = item.exercises.reduce((sum, se) => sum + se.sets.length, 0);
    return (
      <Pressable
        onPress={() => {
          setEditingWorkout(item);
          setShowWorkoutModal(true);
        }}
        onLongPress={() => handleDeleteWorkout(item)}
        className="mx-4 mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
              {formatShortDate(new Date(item.date))}
              {item.durationMinutes ? ` · ${item.durationMinutes} min` : ''}
            </Text>
            <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
              {item.exercises.length} {t('exercise')} · {totalSets} {t('sets')}
            </Text>
          </View>
          <Pressable onPress={() => handleDeleteWorkout(item)} className="p-2">
            <Trash2 size={16} color="#cf222e" />
          </Pressable>
        </View>
        {item.exercises.map((se) => {
          const exercise = exerciseById(se.exerciseId);
          return (
            <Text key={se.exerciseId} className="text-xs text-muted dark:text-dark-muted mt-1">
              • {exercise?.name ?? t('unknownExercise')}: {se.sets.map((s) => `${s.reps}×${s.weightKg}kg`).join(', ')}
            </Text>
          );
        })}
      </Pressable>
    );
  };

  const renderCharts = () => {
    if (view === 'nutrition') {
      const daily = nutritionSummary?.daily ?? [];
      const chartData = daily.slice(-14).map((d) => ({
        label: d.date.slice(5),
        value: d.calories,
        frontColor: spinnerColor,
      }));
      return (
        <Card title={t('weeklySummary')} className="mx-4 mb-4">
          {totals ? (
            <Text className="text-sm text-muted dark:text-dark-muted mb-3">
              {t('dailyTotals')}: {totals.calories} kcal · P {totals.protein}g · C {totals.carbs}g · F{' '}
              {totals.fat}g
            </Text>
          ) : null}
          {chartData.length === 0 ? (
            <Text className="text-sm text-muted dark:text-dark-muted py-4 text-center">{t('noStats')}</Text>
          ) : (
            <SimpleBarChart data={chartData} theme={theme} />
          )}
        </Card>
      );
    }

    const muscleData = (gymStats?.muscleVolume ?? [])
      .sort((a, b) => b.volumeKg - a.volumeKg)
      .slice(0, 8)
      .map((m) => ({
        label: m.muscleGroup.slice(0, 4),
        value: Math.round(m.volumeKg),
        frontColor: spinnerColor,
      }));
    const weeklyData = (gymStats?.weeklyVolume ?? []).slice(-6).map((w) => ({
      label: w.weekStart.slice(5),
      value: Math.round(w.volumeKg),
      frontColor: '#22c55e',
    }));

    return (
      <>
        <Card title={t('muscleVolumeTitle')} className="mx-4 mb-4">
          {muscleData.length === 0 ? (
            <Text className="text-sm text-muted dark:text-dark-muted py-4 text-center">{t('noStats')}</Text>
          ) : (
            <SimpleBarChart data={muscleData} theme={theme} />
          )}
        </Card>
        <Card title={t('weeklyVolumeTitle')} className="mx-4 mb-4">
          {weeklyData.length === 0 ? (
            <Text className="text-sm text-muted dark:text-dark-muted py-4 text-center">{t('noStats')}</Text>
          ) : (
            <SimpleBarChart data={weeklyData} theme={theme} />
          )}
        </Card>
      </>
    );
  };

  return (
    <View className="flex-1 bg-background dark:bg-dark-background">
      <FlatList<MealLog | WorkoutSession>
        data={view === 'nutrition' ? meals : workouts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => ('exercises' in item ? renderWorkout({ item }) : renderMeal({ item }))}
        ListHeaderComponent={
          <View className="p-4 pb-0">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
                  {t('title')}
                </Text>
                <Text className="text-sm text-muted dark:text-dark-muted mt-1 mb-4">
                  {t('description')}
                </Text>
              </View>
              {view === 'gym' ? (
                <Pressable onPress={() => setShowExerciseManager(true)} className="p-2">
                  <Settings size={22} color={spinnerColor} />
                </Pressable>
              ) : null}
            </View>
            <SegmentedTabs<HealthView>
              value={view}
              onChange={setView}
              options={[
                { value: 'nutrition', label: t('nutritionTab') },
                { value: 'gym', label: t('gymTab') },
              ]}
            />
            {view === 'gym' && gymStats ? (
              <Text className="text-xs text-muted dark:text-dark-muted mb-3">
                {t('workoutCount', { count: gymStats.workoutCount })} · {t('periodLabel')}
              </Text>
            ) : null}
            {renderCharts()}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={spinnerColor} className="mt-10" />
          ) : (
            <View className="items-center mt-6 px-6">
              <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
                {view === 'nutrition' ? t('noMealsForDay') : t('noStats')}
              </Text>
              <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                {view === 'nutrition' ? t('addFirstMeal') : t('addExerciseHint')}
              </Text>
            </View>
          )
        }
        contentContainerClassName="pb-24"
      />

      {/* FAB */}
      <Pressable
        onPress={() => {
          if (view === 'nutrition') {
            setEditingMeal(null);
            setShowMealModal(true);
          } else {
            setEditingWorkout(null);
            setShowWorkoutModal(true);
          }
        }}
        className="absolute bottom-6 right-5 h-14 w-14 rounded-full bg-primary dark:bg-dark-primary items-center justify-center shadow-lg"
      >
        <Plus size={26} color="#0d1117" />
      </Pressable>

      <MealModal
        visible={showMealModal}
        onClose={() => {
          setShowMealModal(false);
          setEditingMeal(null);
        }}
        onSaved={loadNutrition}
        meal={editingMeal}
      />

      <WorkoutModal
        visible={showWorkoutModal}
        onClose={() => {
          setShowWorkoutModal(false);
          setEditingWorkout(null);
        }}
        onSaved={loadGym}
        workout={editingWorkout}
        exercises={exercises}
      />

      <ExerciseManager
        visible={showExerciseManager}
        onClose={() => setShowExerciseManager(false)}
        exercises={exercises}
        onChanged={loadGym}
      />
    </View>
  );
}

/** Minimal bar chart wrapper so both views share styling. */
function SimpleBarChart({
  data,
  theme,
}: {
  data: { label: string; value: number; frontColor: string }[];
  theme: string;
}) {
  const gridColor = theme === 'dark' ? '#30363d' : '#d0d7de';
  const axisColor = theme === 'dark' ? '#c9d1d9' : '#57606a';
  return (
    <BarChart
      data={data}
      barWidth={10}
      spacing={4}
      barBorderRadius={3}
      height={160}
      noOfSections={4}
      rulesColor={gridColor}
      xAxisColor={gridColor}
      yAxisColor={gridColor}
      yAxisTextStyle={{ color: axisColor, fontSize: 9 }}
      xAxisLabelTextStyle={{ color: axisColor, fontSize: 9 }}
      yAxisThickness={0}
      xAxisThickness={0}
      isAnimated={false}
    />
  );
}
