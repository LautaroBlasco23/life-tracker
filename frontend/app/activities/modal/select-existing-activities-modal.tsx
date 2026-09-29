'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { activityService } from '@shared/services/activity-service';
import type { Activity } from '@shared/types/activity';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@shared/contexts/language-context';

export interface SelectedActivityRef {
  id: number;
  title: string;
}

interface SelectExistingActivitiesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ids currently selected in the routine, pre-checked in the list. */
  selectedIds: number[];
  /** Full checked set on confirm, with titles. */
  onConfirm: (activities: SelectedActivityRef[]) => void;
}

export function SelectExistingActivitiesModal({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: SelectExistingActivitiesModalProps) {
  const t = useTranslations('routines');
  const tActivities = useTranslations('activities');
  const tCommon = useTranslations('common');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setCheckedIds(selectedIds);
    (async () => {
      try {
        const userActivities = await activityService.getActivities();
        if (mounted) setActivities(userActivities);
      } catch (error) {
        showToast({
          title: t('failedToLoadActivities'),
          description:
            error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleToggle = (activityId: number, checked: boolean) => {
    setCheckedIds(
      checked
        ? [...checkedIds, activityId]
        : checkedIds.filter((id) => id !== activityId)
    );
  };

  const handleConfirm = () => {
    onConfirm(
      activities
        .filter((a) => checkedIds.includes(a.id))
        .map((a) => ({ id: a.id, title: a.title }))
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('selectExistingTitle')}</DialogTitle>
          <DialogDescription>
            {t('selectExistingDescription')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {tCommon('loading')}
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('noExistingToSelect')}
          </p>
        ) : (
          <div className="border rounded-md p-3 bg-muted/20 space-y-2 max-h-64 overflow-y-auto">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`select-existing-${activity.id}`}
                  checked={checkedIds.includes(activity.id)}
                  onCheckedChange={(checked) =>
                    handleToggle(activity.id, checked as boolean)
                  }
                />
                <Label
                  htmlFor={`select-existing-${activity.id}`}
                  className="text-sm font-normal flex-1 min-w-0"
                >
                  <span className="block truncate">{activity.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {tActivities(activity.frequency)} •{' '}
                    {tActivities(activity.dayTime)}
                  </span>
                </Label>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tCommon('cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm}>
            {t('selectExistingConfirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
