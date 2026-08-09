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
import type { Activity } from '@/types/activity';
import { useTranslations } from '@/contexts/language-context';

interface DeleteActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | null;
  onConfirmDelete: () => Promise<void>;
}

export function DeleteActivityModal({
  open,
  onOpenChange,
  activity,
  onConfirmDelete,
}: DeleteActivityModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations('activities');
  const tCommon = useTranslations('common');

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setIsDeleting(false);
    }
  };

  if (!activity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>{t('deleteActivity')}</DialogTitle>
              <DialogDescription>{tCommon('cannotBeUndone')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            {tCommon('areYouSure', { name: activity.title })}
          </p>

          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <div className="text-sm">
              <div className="font-medium text-foreground mb-1">
                {activity.title}
              </div>
              <div className="text-muted-foreground text-xs">
                {activity.description && (
                  <div className="mb-1">{activity.description}</div>
                )}
                <div>
                  {t(activity.frequency)} • {t(activity.dayTime)} •{' '}
                  {t('target')} {activity.completionAmount}
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
            {isDeleting ? tCommon('deleting') : t('deleteActivity')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
