'use client';

import type React from 'react';

import { useEffect, useState } from 'react';
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
import { activityService } from '@shared/services/activity-service';
import type {
  Activity,
  Frequency,
  DayOfWeek,
  DayTime,
  PrivacyStatus,
} from '@shared/types/activity';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@shared/contexts/language-context';

export interface CreateActivityInitialValues {
  title?: string;
  description?: string;
  completionAmount?: number;
  frequency?: Frequency;
  dayFrequency?: DayOfWeek[];
  dayTime?: DayTime;
  privacyStatus?: PrivacyStatus;
}

interface CreateActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivityCreated: (activity: Activity) => void;
  /** Prefill the form (e.g. from an activity template). */
  initialValues?: CreateActivityInitialValues | null;
}

export function CreateActivityModal({
  open,
  onOpenChange,
  onActivityCreated,
  initialValues = null,
}: CreateActivityModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [completionAmount, setCompletionAmount] = useState(1);
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [dayTime, setDayTime] = useState<DayTime>('notSpecified');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>('private');
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('createActivity');
  const tCommon = useTranslations('common');
  const tPrivacy = useTranslations('privacy');

  const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
    { value: 'monday', label: t('monday') },
    { value: 'tuesday', label: t('tuesday') },
    { value: 'wednesday', label: t('wednesday') },
    { value: 'thursday', label: t('thursday') },
    { value: 'friday', label: t('friday') },
    { value: 'saturday', label: t('saturday') },
    { value: 'sunday', label: t('sunday') },
  ];

  const DAY_TIMES: { value: DayTime; label: string }[] = [
    { value: 'notSpecified', label: t('anyMoment') },
    { value: 'morning', label: t('morning') },
    { value: 'afternoon', label: t('afternoon') },
    { value: 'evening', label: t('evening') },
  ];

  const FREQUENCIES: { value: Frequency; label: string }[] = [
    { value: 'daily', label: t('daily') },
    { value: 'weekly', label: t('weekly') },
    { value: 'monthly', label: t('monthly') },
    { value: 'oneTime', label: t('oneTime') },
  ];

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCompletionAmount(1);
    setFrequency('daily');
    setDayTime('morning');
    setSelectedDays([]);
    setPrivacyStatus('private');
  };

  // Seed the form each time the modal opens: from initialValues when provided
  // (e.g. cloned from a template), otherwise from defaults.
  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      setTitle(initialValues.title ?? '');
      setDescription(initialValues.description ?? '');
      setCompletionAmount(initialValues.completionAmount ?? 1);
      setFrequency(initialValues.frequency ?? 'daily');
      setDayTime(initialValues.dayTime ?? 'notSpecified');
      setSelectedDays(initialValues.dayFrequency ?? []);
      setPrivacyStatus(initialValues.privacyStatus ?? 'private');
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Stop the submit from bubbling up the React tree into a parent form
    // (e.g. the routine form when this modal is nested in the activity picker).
    e.stopPropagation();

    if (frequency === 'weekly' && selectedDays.length === 0) {
      showToast({
        title: t('validationError'),
        description: t('selectDayError'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const newActivity = await activityService.createActivity({
        title,
        description,
        completionAmount,
        frequency,
        dayTime,
        dayFrequency: frequency === 'weekly' ? selectedDays : undefined,
        privacyStatus,
      });

      onActivityCreated(newActivity);
      resetForm();
      showToast({
        title: t('activityCreated'),
        description: t('activityCreatedDescription'),
      });
    } catch (error) {
      console.error('Create activity error:', error);
      showToast({
        title: t('creationFailed'),
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('titleLabel')}</Label>
            <Input
              id="title"
              type="text"
              placeholder={t('titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('descriptionLabel')}</Label>
            <Textarea
              id="description"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-input border-border resize-none"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="completionAmount">{t('targetAmount')}</Label>
              <Input
                id="completionAmount"
                type="number"
                min="1"
                value={completionAmount}
                onChange={(e) => setCompletionAmount(Number(e.target.value))}
                required
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dayTime">{t('timeOfDay')}</Label>
              <Select
                value={dayTime}
                onValueChange={(value: DayTime) => setDayTime(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_TIMES.map((time) => (
                    <SelectItem key={time.value} value={time.value}>
                      {time.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">{t('frequency')}</Label>
            <Select
              value={frequency}
              onValueChange={(value: Frequency) => setFrequency(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {frequency === 'weekly' && (
            <div className="space-y-2">
              <Label>{t('daysOfWeek')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={day.value}
                      checked={selectedDays.includes(day.value)}
                      onCheckedChange={(checked) =>
                        handleDayToggle(day.value, checked as boolean)
                      }
                    />
                    <Label htmlFor={day.value} className="text-sm font-normal">
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="privacyStatus">{tPrivacy('privacyStatus')}</Label>
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
              {isLoading ? t('creating') : t('createActivity')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
