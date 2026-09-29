'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { routineService } from '@shared/services/routine-service';
import type { Routine, PrivacyStatus, RoutineStatus } from '@shared/types';
import { RoutineActivitiesSection } from './routine-activities-section';
import { type SelectedActivityRef } from './select-existing-activities-modal';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@shared/contexts/language-context';

interface EditRoutineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: Routine | null;
  onRoutineUpdated: (routine: Routine) => void;
}

export function EditRoutineModal({
  open,
  onOpenChange,
  routine,
  onRoutineUpdated,
}: EditRoutineModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>('private');
  const [status, setStatus] = useState<RoutineStatus>('active');
  const [selectedActivities, setSelectedActivities] = useState<
    SelectedActivityRef[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('routines');
  const tCommon = useTranslations('common');
  const tPrivacy = useTranslations('privacy');

  useEffect(() => {
    if (routine && open) {
      setTitle(routine.title);
      setDescription(routine.description);
      setPrivacyStatus(routine.privacyStatus || 'private');
      setStatus(routine.status ?? 'active');
      setSelectedActivities(
        [...routine.activities]
          .sort((a, b) => a.position - b.position)
          .map((activity) => ({
            id: activity.activityId,
            title: activity.activityTitle,
          }))
      );
    }
  }, [routine, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routine) return;

    if (selectedActivities.length === 0) {
      showToast({
        title: t('validationError'),
        description: t('selectAtLeastOne'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const updated = await routineService.updateRoutine(routine.id, {
        title,
        description,
        privacyStatus,
        status,
        activityIds: selectedActivities.map((activity, position) => ({
          activityId: activity.id,
          position,
        })),
      });

      onRoutineUpdated(updated);
      showToast({
        title: t('routineUpdated'),
        description: t('routineUpdatedDescription'),
      });
      onOpenChange(false);
    } catch (error) {
      showToast({
        title: t('updateFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!routine) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
          <DialogDescription>{t('editDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-routine-title">{t('titleLabel')}</Label>
            <Input
              id="edit-routine-title"
              type="text"
              placeholder={t('titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-routine-description">
              {t('descriptionLabel')}
            </Label>
            <Textarea
              id="edit-routine-description"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-input border-border resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-routine-status">{t('statusLabel')}</Label>
            <Select
              value={status}
              onValueChange={(value: RoutineStatus) => setStatus(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t('status_draft')}</SelectItem>
                <SelectItem value="active">{t('status_active')}</SelectItem>
                <SelectItem value="stopped">{t('status_stopped')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <RoutineActivitiesSection
            selectedActivities={selectedActivities}
            onSelectedChange={setSelectedActivities}
          />

          <div className="space-y-2">
            <Label htmlFor="edit-routine-privacy">
              {tPrivacy('privacyStatus')}
            </Label>
            <Select
              value={privacyStatus}
              onValueChange={(value: PrivacyStatus) => setPrivacyStatus(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">{tPrivacy('private')}</SelectItem>
                <SelectItem value="public">{tPrivacy('public')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('routinePrivacyDescription')}
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? tCommon('updating') : t('updateRoutine')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
