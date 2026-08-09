'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import type { Transaction } from '@/types';
import { useTranslations } from '@/contexts/language-context';

interface DeleteTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onConfirmDelete: () => Promise<void>;
}

export function DeleteTransactionModal({
  open,
  onOpenChange,
  transaction,
  onConfirmDelete,
}: DeleteTransactionModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations('finance');
  const tCommon = useTranslations('common');

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete();
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>{t('deleteTransaction')}</DialogTitle>
              <DialogDescription>{tCommon('cannotBeUndone')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            {tCommon('areYouSure', { name: transaction.category })}
          </p>
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <div className="text-sm">
              <div className="font-medium text-foreground mb-1">
                {transaction.category}
              </div>
              <div className="text-muted-foreground text-xs">
                {transaction.description && (
                  <div className="mb-1">{transaction.description}</div>
                )}
                <div>
                  {t(transaction.type)} • {t(transaction.frequency)} • $
                  {transaction.amount.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? tCommon('deleting') : t('deleteTransaction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
