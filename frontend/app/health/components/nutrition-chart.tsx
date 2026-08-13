'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from '@/contexts/language-context';
import type { DailyNutritionSummary } from '@/types';

interface NutritionChartProps {
  daily: DailyNutritionSummary[];
}

export function NutritionChart({ daily }: NutritionChartProps) {
  const t = useTranslations('health');

  const data = daily.map((day) => ({
    name: new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
    }),
    calories: Math.round(day.calories),
    protein: Math.round(day.protein),
    carbs: Math.round(day.carbs),
    fat: Math.round(day.fat),
  }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {t('noMealsForDay')}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={44}
          tickFormatter={(value: number) => `${value}`}
        />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.05)' }}
          formatter={(value, name) => [
            `${Number(value)} ${
              name === 'calories' ? 'kcal' : `g ${t(String(name))}`
            }`,
            t(String(name)),
          ]}
        />
        <Bar
          dataKey="calories"
          fill="#22c55e"
          radius={[4, 4, 0, 0]}
          name="calories"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
