'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { routineService } from '@shared/services/routine-service';
import type { Routine, RoutineActivityItem } from '@shared/types';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@shared/contexts/language-context';

interface RoutineDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routineId: number | null;
}

function formatDayFrequency(dayFrequency?: string): string | null {
  if (!dayFrequency) return null;
  try {
    const days: string[] = JSON.parse(dayFrequency);
    return days
      .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
      .join(', ');
  } catch {
    return null;
  }
}

function ActivityCard({
  item,
  position,
}: {
  item: RoutineActivityItem;
  position: number;
}) {
  const tActivities = useTranslations('activities');
  const tPrivacy = useTranslations('privacy');

  const badges: Array<{
    label: string;
    variant: 'default' | 'outline' | 'secondary';
  }> = [{ label: tActivities(item.frequency), variant: 'outline' }];
  if (item.frequency === 'weekly') {
    const days = formatDayFrequency(item.dayFrequency);
    if (days) badges.push({ label: days, variant: 'outline' });
  }
  if (item.dayTime && item.dayTime !== 'notSpecified') {
    badges.push({ label: tActivities(item.dayTime), variant: 'outline' });
  }
  badges.push({
    label: tPrivacy(item.privacyStatus),
    variant: 'secondary',
  });

  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0 mt-0.5">
            {position}
          </span>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="font-medium text-foreground break-words">
              {item.activityTitle}
            </div>
            {item.description && (
              <p className="text-sm text-muted-foreground break-words">
                {item.description}
              </p>
            )}
            {badges.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {badges.map((badge, index) => (
                  <Badge
                    key={index}
                    variant={badge.variant}
                    className="text-xs"
                  >
                    {badge.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RoutineDetailModal({
  open,
  onOpenChange,
  routineId,
}: RoutineDetailModalProps) {
  const t = useTranslations('routines');
  const tPrivacy = useTranslations('privacy');
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || routineId === null) return;

    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const fetched = await routineService.getRoutine(routineId);
        if (mounted) setRoutine(fetched);
      } catch (error) {
        showToast({
          title: t('failedToLoad'),
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
  }, [open, routineId]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) setRoutine(null);
    onOpenChange(newOpen);
  };

  const sortedActivities = routine
    ? [...routine.activities].sort((a, b) => a.position - b.position)
    : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{routine?.title ?? t('loadingRoutine')}</DialogTitle>
          {routine && (
            <DialogDescription>
              {routine.description || t('noDescription')}
              {routine.privacyStatus && (
                <Badge
                  variant="secondary"
                  className="ml-2 align-middle text-xs"
                >
                  {tPrivacy(routine.privacyStatus)}
                </Badge>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {t('loadingRoutine')}
          </div>
        )}

        {!isLoading && routine && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {t('activityCount', { count: sortedActivities.length })}
            </div>
            {sortedActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('noActivitiesInRoutine')}
              </p>
            ) : (
              sortedActivities.map((item) => (
                <ActivityCard
                  key={item.activityId}
                  item={item}
                  position={item.position + 1}
                />
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
