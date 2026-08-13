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
import type { MuscleVolume } from '@/types';

interface MuscleVolumeChartProps {
  muscleVolume: MuscleVolume[];
}

export function MuscleVolumeChart({ muscleVolume }: MuscleVolumeChartProps) {
  const t = useTranslations('health');

  const data = muscleVolume.map((mv) => ({
    name: mv.muscleGroup,
    volumeKg: Math.round(mv.volumeKg),
    sessions: mv.sessions,
  }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {t('noStats')}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.05)' }}
          formatter={(value, name) => {
            if (name === 'volumeKg')
              return [`${Number(value)} kg`, t('weightKg')];
            return [String(value), t('sessions')];
          }}
        />
        <Bar dataKey="volumeKg" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
