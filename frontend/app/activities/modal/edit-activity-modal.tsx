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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { activityService } from '@/services/activity-service';
import type {
  Activity,
  Frequency,
  DayOfWeek,
  DayTime,
  PrivacyStatus,
} from '@/types/activity';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@/contexts/language-context';

interface EditActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | null;
  onActivityUpdated: (activity: Activity) => void;
}

export function EditActivityModal({
  open,
  onOpenChange,
  activity,
  onActivityUpdated,
}: EditActivityModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [completionAmount, setCompletionAmount] = useState(1);
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [dayTime, setDayTime] = useState<DayTime>('morning');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>('private');
  const [isLoading, setIsLoading] = useState(false);

  const t = useTranslations('activities');
  const tCreate = useTranslations('createActivity');
  const tCommon = useTranslations('common');
  const tPrivacy = useTranslations('privacy');

  useEffect(() => {
    if (activity && open) {
      setTitle(activity.title);
      setDescription(activity.description);
      setCompletionAmount(activity.completionAmount);
      setFrequency(activity.frequency);
      setDayTime(activity.dayTime);
      setPrivacyStatus(activity.privacyStatus || 'private');

      if (activity.dayFrequency) {
        try {
          const days: DayOfWeek[] = JSON.parse(activity.dayFrequency);
          setSelectedDays(days);
        } catch {
          setSelectedDays([]);
        }
      } else {
        setSelectedDays([]);
      }
    }
  }, [activity, open]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCompletionAmount(1);
    setFrequency('daily');
    setDayTime('notSpecified');
    setSelectedDays([]);
    setPrivacyStatus('private');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity) return;

    if (frequency === 'weekly' && selectedDays.length === 0) {
      showToast({
        title: t('validationError') || tCreate('validationError'),
        description: tCreate('selectDayError'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const updatedActivity = await activityService.updateActivity(
        activity.id,
        {
          title,
          description,
          completionAmount,
          frequency,
          dayTime,
          dayFrequency: frequency === 'weekly' ? selectedDays : undefined,
          privacyStatus,
        }
      );

      onActivityUpdated(updatedActivity);
      showToast({
        title: t('activityUpdated') || 'Activity updated',
        description:
          t('activityUpdatedDescription') ||
          'Your activity has been successfully updated.',
      });
      onOpenChange(false);
    } catch (error) {
      showToast({
        title: tCommon('error'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDayToggle = (day: DayOfWeek, checked: boolean) => {
    if (checked) {
      setSelectedDays([...selectedDays, day]);
    } else {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  if (!activity) return null;

  const DAYS_OF_WEEK = [
    { value: 'monday' as DayOfWeek, label: tCreate('monday') },
    { value: 'tuesday' as DayOfWeek, label: tCreate('tuesday') },
    { value: 'wednesday' as DayOfWeek, label: tCreate('wednesday') },
    { value: 'thursday' as DayOfWeek, label: tCreate('thursday') },
    { value: 'friday' as DayOfWeek, label: tCreate('friday') },
    { value: 'saturday' as DayOfWeek, label: tCreate('saturday') },
    { value: 'sunday' as DayOfWeek, label: tCreate('sunday') },
  ];

  const DAY_TIME_CATEGORIES = [
    { value: 'notSpecified' as DayTime, label: t('anyMoment') },
    { value: 'morning' as DayTime, label: t('morning') },
    { value: 'afternoon' as DayTime, label: t('afternoon') },
    { value: 'evening' as DayTime, label: t('evening') },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editActivity') || 'Edit Activity'}</DialogTitle>
          <DialogDescription>{tCreate('description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">{tCreate('titleLabel')}</Label>
            <Input
              id="edit-title"
              type="text"
              placeholder={tCreate('titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">
              {tCreate('descriptionLabel')}
            </Label>
            <Textarea
              id="edit-description"
              placeholder={tCreate('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-input border-border resize-none"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-completionAmount">
                {tCreate('targetAmount')}
              </Label>
              <Input
                id="edit-completionAmount"
                type="number"
                min="1"
                value={completionAmount}
                onChange={(e) => setCompletionAmount(Number(e.target.value))}
                required
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">{t('timeOfDay')}</Label>
              <Select
                value={dayTime}
                onValueChange={(value: DayTime) => setDayTime(value)}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_TIME_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-frequency">{t('frequency')}</Label>
            <Select
              value={frequency}
              onValueChange={(value: Frequency) => setFrequency(value)}
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t('daily')}</SelectItem>
                <SelectItem value="weekly">{t('weekly')}</SelectItem>
                <SelectItem value="monthly">{t('monthly')}</SelectItem>
                <SelectItem value="oneTime">{t('oneTime')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {frequency === 'weekly' && (
            <div className="space-y-2">
              <Label>{tCreate('daysOfWeek')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${day.value}`}
                      checked={selectedDays.includes(day.value)}
                      onCheckedChange={(checked) =>
                        handleDayToggle(day.value, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`edit-${day.value}`}
                      className="text-sm font-normal"
                    >
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-privacyStatus">
              {tPrivacy('privacyStatus')}
            </Label>
            <Select
              value={privacyStatus}
              onValueChange={(value: PrivacyStatus) => setPrivacyStatus(value)}
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">{tPrivacy('private')}</SelectItem>
                <SelectItem value="public">{tPrivacy('public')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {tPrivacy('activityPrivacyDescription')}
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
              {isLoading
                ? tCommon('updating')
                : t('updateActivity') || 'Update Activity'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
