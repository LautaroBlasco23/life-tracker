'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Navigation } from '@/components/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from '@/contexts/language-context';
import { NutritionTab } from './components/nutrition-tab';
import { GymTab } from './components/gym-tab';

type HealthView = 'nutrition' | 'gym';

export default function HealthPage() {
  const t = useTranslations('health');
  const [view, setView] = useState<HealthView>('nutrition');

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
        <Navigation />
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {t('description')}
          </p>

          <Tabs
            value={view}
            onValueChange={(value) => setView(value as HealthView)}
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="nutrition">{t('nutritionTab')}</TabsTrigger>
              <TabsTrigger value="gym">{t('gymTab')}</TabsTrigger>
            </TabsList>
          </Tabs>

          {view === 'nutrition' && <NutritionTab />}
          {view === 'gym' && <GymTab />}
        </div>
      </div>
    </AuthGuard>
  );
}
