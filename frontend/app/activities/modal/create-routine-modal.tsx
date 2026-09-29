'use client';

import type React from 'react';

import { useState } from 'react';
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

interface CreateRoutineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoutineCreated: (routine: Routine) => void;
}

export function CreateRoutineModal({
  open,
  onOpenChange,
  onRoutineCreated,
}: CreateRoutineModalProps) {
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

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPrivacyStatus('private');
    setStatus('active');
    setSelectedActivities([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const routine = await routineService.createRoutine({
        title,
        description,
        privacyStatus,
        status,
        activityIds: selectedActivities.map((activity, position) => ({
          activityId: activity.id,
          position,
        })),
      });

      onRoutineCreated(routine);
      resetForm();
      showToast({
        title: t('routineCreated'),
        description: t('routineCreatedDescription'),
      });
    } catch (error) {
      showToast({
        title: t('createFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>{t('createDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="routine-title">{t('titleLabel')}</Label>
            <Input
              id="routine-title"
              type="text"
              placeholder={t('titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="routine-description">{t('descriptionLabel')}</Label>
            <Textarea
              id="routine-description"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-input border-border resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="routine-status">{t('statusLabel')}</Label>
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
            <Label htmlFor="routine-privacy">{tPrivacy('privacyStatus')}</Label>
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
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? tCommon('creating') : t('createRoutine')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
