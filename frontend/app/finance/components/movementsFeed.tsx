'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Movement } from '@shared/types';
import { getDayKey, getDayLabel } from '@/utils/dateLabels';
import { Plus, ChevronDown, Loader2 } from 'lucide-react';
import { MovementCard } from './movementCard';
import { useTranslations } from '@shared/contexts/language-context';

interface MovementsFeedProps {
  movements: Movement[];
  categoryIcons: Record<string, string>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  filterCount: number;
  onShowMore: () => void;
  onClearFilters: () => void;
  onAddMovement: () => void;
  onClickPending: (movement: Movement) => void;
  onEditMovement: (movement: Movement) => void;
  onDeleteMovement: (movement: Movement) => void;
}

export function MovementsFeed({
  movements,
  categoryIcons,
  isLoading,
  isLoadingMore,
  hasMore,
  filterCount,
  onShowMore,
  onClearFilters,
  onAddMovement,
  onClickPending,
  onEditMovement,
  onDeleteMovement,
}: MovementsFeedProps) {
  const t = useTranslations('finance');
  const tCommon = useTranslations('common');

  const groups = useMemo(() => {
    const map = new Map<string, Movement[]>();
    for (const movement of movements) {
      const key = getDayKey(new Date(movement.date));
      const list = map.get(key) ?? [];
      list.push(movement);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [movements]);

  const labelForDayKey = (dayKey: string): string => {
    const [year, month, day] = dayKey.split('-').map(Number);
    return getDayLabel(new Date(year, month - 1, day, 12), t);
  };

  // Leave the background empty while loading; show content only when ready.
  // When data already exists (e.g. refetch after a mutation or filter change)
  // keep the current list visible instead of blanking it out.
  if (isLoading && movements.length === 0) {
    return null;
  }

  if (movements.length === 0) {
    return (
      <Card className="text-center py-12 bg-muted/30">
        <CardContent>
          <div className="text-muted-foreground mb-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Plus className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {filterCount > 0 ? t('noMovementsMatch') : t('noMovementsYet')}
            </h3>
            <p>
              {filterCount > 0 ? t('tryAdjusting') : t('movementsGetStarted')}
            </p>
          </div>
          {filterCount > 0 ? (
            <Button variant="outline" onClick={onClearFilters}>
              {tCommon('clearFilters')}
            </Button>
          ) : (
            <Button onClick={onAddMovement}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addMovement')}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {groups.map(([dayKey, dayMovements]) => (
        <div key={dayKey} className="mb-6">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {labelForDayKey(dayKey)}
            </h2>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="space-y-2">
            {dayMovements.map((movement) => (
              <MovementCard
                key={`${movement.sourceType}-${movement.id}`}
                movement={movement}
                icon={categoryIcons[movement.category]}
                onClickPending={onClickPending}
                onEdit={onEditMovement}
                onDelete={onDeleteMovement}
              />
            ))}
          </div>
        </div>
      ))}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={onShowMore}
            disabled={isLoadingMore}
            className="gap-2"
          >
            {isLoadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {t('showMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
