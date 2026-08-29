'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Movement } from '@shared/types';
import { formatCurrency } from '@/utils/formatNumbers';
import { formatTime } from '@/utils/dateLabels';
import { AlertCircle, Edit, Trash2 } from 'lucide-react';
import {
  EntityDropdown,
  DropdownMenuItem,
} from '@/components/ui/card/entityDropdown';
import { useTranslations } from '@shared/contexts/language-context';

interface MovementCardProps {
  movement: Movement;
  icon?: string;
  onClickPending?: (movement: Movement) => void;
  onEdit?: (movement: Movement) => void;
  onDelete?: (movement: Movement) => void;
}

export function MovementCard({
  movement,
  icon,
  onClickPending,
  onEdit,
  onDelete,
}: MovementCardProps) {
  const t = useTranslations('finance');
  const tCategories = useTranslations('financeCategories');
  const tCommon = useTranslations('common');

  const isIncome = movement.type === 'income';
  const isPending = !movement.paid;
  const isEditable = movement.sourceType === 'transaction';

  const handleCardClick = () => {
    if (isPending && onClickPending) {
      onClickPending(movement);
    }
  };

  return (
    <Card
      className={`bg-surface border-border/60 ${
        isPending
          ? 'opacity-60 hover:opacity-85 cursor-pointer transition-opacity'
          : ''
      }`}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
            {icon || '💸'}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="truncate font-medium text-foreground">
                {tCategories(movement.category)}
              </p>
              {isPending && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-500/40 text-amber-600 dark:text-amber-400"
                >
                  <AlertCircle className="mr-1 h-3 w-3" />
                  {t('paymentRequired')}
                </Badge>
              )}
            </div>
            {movement.description && (
              <p className="truncate text-sm text-muted-foreground">
                {movement.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatTime(new Date(movement.date))}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p
                className={`font-semibold ${
                  isIncome
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {isIncome ? '+' : '-'}$
                {formatCurrency(movement.amount)}
              </p>
            </div>
            {isEditable && (onEdit || onDelete) && (
              <EntityDropdown align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(movement)}>
                    <Edit className="h-4 w-4 mr-2" />
                    {tCommon('edit')}
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(movement)}
                    variant="destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {tCommon('delete')}
                  </DropdownMenuItem>
                )}
              </EntityDropdown>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
