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
import { useTranslations } from '@/contexts/language-context';

interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemName: string;
  itemDetails: React.ReactNode;
  onConfirm: () => Promise<void>;
  confirmLabel?: string;
}

export function DeleteModal({
  open,
  onOpenChange,
  title,
  itemName,
  itemDetails,
  onConfirm,
  confirmLabel,
}: DeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations('deleteModal');
  const tCommon = useTranslations('common');

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{t('cannotBeUndone')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            {t('areYouSure', { name: itemName })}
          </p>
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            {itemDetails}
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
            {isDeleting ? t('deleting') : (confirmLabel ?? tCommon('delete'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
