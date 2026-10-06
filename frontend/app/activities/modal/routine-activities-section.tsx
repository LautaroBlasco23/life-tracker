'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, ChevronUp, ChevronDown, X, ClipboardList } from 'lucide-react';
import type { Activity } from '@shared/types/activity';
import type { SelectedActivityRef } from './select-existing-activities-modal';
import { ActivityFormModal } from '@/app/activities/modal/activity-form-modal';
import { SelectExistingActivitiesModal } from './select-existing-activities-modal';
import { useTranslations } from '@shared/contexts/language-context';

interface RoutineActivitiesSectionProps {
  selectedActivities: SelectedActivityRef[];
  onSelectedChange: (activities: SelectedActivityRef[]) => void;
}

/**
 * Activities section shared by the create and edit routine modals.
 * Normal flow: create activities inline. Secondary flow: pick
 * already-created activities via SelectExistingActivitiesModal.
 */
export function RoutineActivitiesSection({
  selectedActivities,
  onSelectedChange,
}: RoutineActivitiesSectionProps) {
  const t = useTranslations('routines');
  const tCommon = useTranslations('common');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSelectModal, setShowSelectModal] = useState(false);

  const handleActivityCreated = (activity: Activity) => {
    if (selectedActivities.some((a) => a.id === activity.id)) {
      setShowCreateModal(false);
      return;
    }
    onSelectedChange([
      ...selectedActivities,
      { id: activity.id, title: activity.title },
    ]);
    setShowCreateModal(false);
  };

  const handleSelectionConfirmed = (activities: SelectedActivityRef[]) => {
    const kept = selectedActivities.filter((a) =>
      activities.some((x) => x.id === a.id)
    );
    const added = activities.filter((x) =>
      selectedActivities.every((a) => a.id !== x.id)
    );
    onSelectedChange([...kept, ...added]);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selectedActivities.length) return;
    const next = [...selectedActivities];
    [next[index], next[target]] = [next[target], next[index]];
    onSelectedChange(next);
  };

  const remove = (id: number) => {
    onSelectedChange(selectedActivities.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-4">
      <Label>{t('selectedActivities')}</Label>

      {selectedActivities.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed py-5 text-center text-muted-foreground">
          <ClipboardList className="h-5 w-5" />
          <p className="text-sm px-4">{t('noActivitiesSelectedYet')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>{t('orderHint')}</Label>
          <ol className="space-y-2">
            {selectedActivities.map((activity, index) => (
              <li
                key={activity.id}
                className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/20"
              >
                <span className="text-xs text-muted-foreground w-4">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm truncate">
                  {activity.title}
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
                  disabled={index === selectedActivities.length - 1}
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
                  onClick={() => remove(activity.id)}
                  aria-label={tCommon('delete')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex items-center gap-2">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowSelectModal(true)}
          className="flex items-center gap-1"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          {t('useExistingActivities')}
        </Button>
      </div>

      {/* Routines can only contain recurring activities — lock the mode. */}
      <ActivityFormModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onActivityCreated={handleActivityCreated}
        mode="activity"
      />
      <SelectExistingActivitiesModal
        open={showSelectModal}
        onOpenChange={setShowSelectModal}
        selectedIds={selectedActivities.map((a) => a.id)}
        onConfirm={handleSelectionConfirmed}
      />
    </div>
  );
}
