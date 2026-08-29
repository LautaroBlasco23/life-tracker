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
import { useTranslations } from '@shared/contexts/language-context';
import type { WeeklyVolume } from '@shared/types';

interface VolumeTrendChartProps {
  weeklyVolume: WeeklyVolume[];
}

export function VolumeTrendChart({ weeklyVolume }: VolumeTrendChartProps) {
  const t = useTranslations('health');

  const data = weeklyVolume.map((week) => ({
    name: new Date(`${week.weekStart}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    volumeKg: Math.round(week.volumeKg),
  }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {t('noStats')}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.05)' }}
          formatter={(value) => [`${Number(value)} kg`, t('weightKg')]}
        />
        <Bar dataKey="volumeKg" fill="#a855f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
