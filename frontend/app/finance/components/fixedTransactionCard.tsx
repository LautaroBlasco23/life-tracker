'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FixedTransaction, Transaction } from '@/types';
import { formatCurrency } from '@/utils/formatNumbers';
import { Calendar, CreditCard, Check, Edit, Trash2 } from 'lucide-react';
import { DeleteModal } from '@/components/ui/card/delete-modal';
import {
  EntityDropdown,
  DropdownMenuItem,
} from '@/components/ui/card/entityDropdown';
import { useTranslations } from '@/contexts/language-context';

interface FixedTransactionCardProps {
  transaction: FixedTransaction;
  onAddPayment: (transaction: FixedTransaction) => void;
  onEdit: (transaction: FixedTransaction) => void;
  onDelete: (transactionId: string) => Promise<void>;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function FixedTransactionCard({
  transaction,
  onAddPayment,
  onEdit,
  onDelete,
}: FixedTransactionCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const t = useTranslations('finance');
  const tCreate = useTranslations('createTransaction');
  const tCommon = useTranslations('common');

  const isIncome = transaction.type === 'income';
  const isPaidThisPeriod = !!transaction.currentPeriodPayment;

  const handleConfirmDelete = async () => {
    await onDelete(transaction.id);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isPaidThisPeriod) return;

    const target = e.target as HTMLElement;
    const isDropdownElement =
      target.closest('[data-dropdown]') ||
      target.closest('button') ||
      target.tagName === 'BUTTON';

    if (isDropdownElement) {
      return;
    }

    onAddPayment(transaction);
  };

  const cardClasses = isPaidThisPeriod
    ? `bg-muted/30 border-2 ${
        isIncome
          ? 'border-green-500/50 bg-green-500/10'
          : 'border-red-500/50 bg-red-500/10'
      }`
    : 'bg-muted/30 hover:shadow-md cursor-pointer hover:scale-[1.02] hover:bg-muted/50 transition-all duration-200';

  return (
    <>
      <Card className={cardClasses} onClick={handleCardClick}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3
                  className={`font-medium text-base ${
                    isPaidThisPeriod && isIncome
                      ? 'text-green-600 dark:text-green-400'
                      : isPaidThisPeriod
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-foreground'
                  }`}
                >
                  {transaction.category}
                </h3>
                <Badge
                  variant={isIncome ? 'default' : 'destructive'}
                  className="shrink-0"
                >
                  {t(transaction.type)}
                </Badge>
                <Badge variant="outline" className="shrink-0">
                  {tCreate(transaction.paymentFrequency || 'monthly')}
                </Badge>
                {isPaidThisPeriod && (
                  <Badge
                    variant="default"
                    className={`shrink-0 ${
                      isIncome
                        ? 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/50'
                        : 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/50'
                    }`}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    {isIncome ? t('income') : t('outcome')}
                  </Badge>
                )}
              </div>

              {transaction.description && (
                <p className="text-sm text-muted-foreground break-words mb-2">
                  {transaction.description}
                </p>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {t('created')} {formatDate(transaction.createdAt)}
                  </span>
                </div>

                {isPaidThisPeriod && transaction.currentPeriodPayment && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {t('thisPeriod')}:
                    </span>
                    <span
                      className={`font-semibold text-base sm:text-sm ${
                        isIncome
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isIncome ? '+' : '-'}$
                      {formatCurrency(transaction.currentPeriodPayment.amount)}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t('total')}:</span>
                  <span className="font-semibold text-muted-foreground">
                    ${formatCurrency(transaction.totalPaid)}
                  </span>
                </div>
              </div>
            </div>

            <EntityDropdown align="end">
              {!isPaidThisPeriod && (
                <DropdownMenuItem onClick={() => onAddPayment(transaction)}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  {tCreate('recordPayment')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onEdit(transaction)}>
                <Edit className="h-4 w-4 mr-2" />
                {tCommon('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteModal(true)}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {tCommon('delete')}
              </DropdownMenuItem>
            </EntityDropdown>
          </div>
        </CardContent>
      </Card>

      <DeleteModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete Transaction"
        itemName={transaction.category}
        itemDetails={
          <div className="text-sm">
            <div className="font-medium text-foreground mb-1">
              {transaction.category}
            </div>
            <div className="text-muted-foreground text-xs">
              {transaction.description && (
                <div className="mb-1">{transaction.description}</div>
              )}
              <div>
                {transaction.type} • ${formatCurrency(transaction.totalPaid)}{' '}
                total
              </div>
            </div>
          </div>
        }
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete Transaction"
      />
    </>
  );
}
