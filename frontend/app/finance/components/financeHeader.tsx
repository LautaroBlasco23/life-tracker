'use client';

import type React from 'react';
import { useTranslations } from '@shared/contexts/language-context';

interface FinanceHeaderProps {
  children?: React.ReactNode;
}

export function FinanceHeader({ children }: FinanceHeaderProps) {
  const t = useTranslations('finance');

  return (
    <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-1">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
