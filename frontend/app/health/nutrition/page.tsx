'use client';

import { useTranslations } from '@shared/contexts/language-context';
import { NutritionTab } from '../components/nutrition-tab';

export default function NutritionPage() {
  const t = useTranslations('health');

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        {t('description')}
      </p>

      <NutritionTab />
    </>
  );
}
