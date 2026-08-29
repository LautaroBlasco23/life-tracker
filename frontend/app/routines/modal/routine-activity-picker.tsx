'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Plus, ChevronUp, ChevronDown, X, Pencil, Loader2 } from 'lucide-react';
import { activityService } from '@shared/services/activity-service';
import type { Activity } from '@shared/types/activity';
import { CreateActivityModal } from '@/app/activities/modal/create-activity-modal';
import { EditActivityModal } from '@/app/activities/modal/edit-activity-modal';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@shared/contexts/language-context';

interface RoutineActivityPickerProps {
  selectedIds: number[];
  onSelectedChange: (ids: number[]) => void;
}

export function RoutineActivityPicker({
  selectedIds,
  onSelectedChange,
}: RoutineActivityPickerProps) {
  const t = useTranslations('routines');
  const tActivities = useTranslations('activities');
  const tCommon = useTranslations('common');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    let mounted = true;
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
  }, []);

  const handleToggle = (activityId: number, checked: boolean) => {
    if (checked) {
      onSelectedChange([...selectedIds, activityId]);
    } else {
      onSelectedChange(selectedIds.filter((id) => id !== activityId));
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    onSelectedChange(next);
  };

  const handleActivityCreated = (activity: Activity) => {
    setActivities((prev) => [...prev, activity]);
    onSelectedChange([...selectedIds, activity.id]);
    setShowCreateModal(false);
  };

  const handleActivityUpdated = (updated: Activity) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    );
    setShowEditModal(false);
    setEditingActivity(null);
  };

  const selected = selectedIds
    .map((id, index) => ({
      activity: activities.find((a) => a.id === id),
      index,
    }))
    .filter((entry) => entry.activity !== undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t('selectedActivities')}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('newActivity')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {tCommon('loading')}
        </div>
      ) : (
        <>
          <div className="border rounded-md p-3 bg-muted/20 space-y-2 max-h-56 overflow-y-auto">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('noActivitiesToPick')}
              </p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`routine-pick-${activity.id}`}
                    checked={selectedIds.includes(activity.id)}
                    onCheckedChange={(checked) =>
                      handleToggle(activity.id, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={`routine-pick-${activity.id}`}
                    className="text-sm font-normal flex-1 min-w-0"
                  >
                    <span className="block truncate">{activity.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {tActivities(activity.frequency)} •{' '}
                      {tActivities(activity.dayTime)}
                    </span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditingActivity(activity);
                      setShowEditModal(true);
                    }}
                    aria-label={t('editActivity')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {selected.length > 0 && (
            <div className="space-y-2">
              <Label>{t('orderHint')}</Label>
              <ol className="space-y-2">
                {selected.map(({ activity, index }, displayIndex) => (
                  <li
                    key={activity!.id}
                    className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/20"
                  >
                    <span className="text-xs text-muted-foreground w-4">
                      {displayIndex + 1}
                    </span>
                    <span className="flex-1 text-sm truncate">
                      {activity!.title}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={index === selectedIds.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleToggle(activity!.id, false)}
                      aria-label={tCommon('delete')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      <CreateActivityModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onActivityCreated={handleActivityCreated}
      />
      <EditActivityModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        activity={editingActivity}
        onActivityUpdated={handleActivityUpdated}
      />
    </div>
  );
}
