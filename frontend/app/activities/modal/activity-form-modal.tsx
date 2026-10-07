'use client';

import type React from 'react';

import { useEffect, useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { activityService } from '@shared/services/activity-service';
import { reminderService } from '@shared/services/reminder-service';
import type {
  Activity,
  Frequency,
  DayOfWeek,
  DayTime,
  PrivacyStatus,
} from '@shared/types/activity';
import type { Reminder } from '@shared/types/reminder';
import { buildDateTime, formatTimeInput } from '@shared/lib/datetime';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@shared/contexts/language-context';
import { TimeInput } from '@/components/ui/time-input';

type FormMode = 'activity' | 'reminder';

export interface ActivityFormInitialValues {
  title?: string;
  description?: string;
  completionAmount?: number;
  frequency?: Frequency;
  dayFrequency?: DayOfWeek[];
  dayTime?: DayTime;
  privacyStatus?: PrivacyStatus;
}

interface ActivityFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present → edit an existing activity (mode locked to activity). */
  activity?: Activity | null;
  /** Present → edit an existing reminder (mode locked to reminder). */
  reminder?: Reminder | null;
  /** Prefill the create form (e.g. from an activity template). */
  initialValues?: ActivityFormInitialValues | null;
  /** Lock the create mode (e.g. the routine picker only accepts recurring activities). */
  mode?: FormMode;
  onActivityCreated?: (activity: Activity) => void;
  onActivityUpdated?: (activity: Activity) => void;
  onReminderCreated?: (reminder: Reminder) => void;
  onReminderUpdated?: (reminder: Reminder) => void;
}

/**
 * Unified create/edit form for recurring activities and reminders. A checkbox
 * switches the form between the two field sets when creating; edit mode is
 * locked to the entity being edited (activities and reminders are separate
 * resources and cannot be converted in place).
 */
export function ActivityFormModal({
  open,
  onOpenChange,
  activity = null,
  reminder = null,
  initialValues = null,
  mode: lockedMode,
  onActivityCreated,
  onActivityUpdated,
  onReminderCreated,
  onReminderUpdated,
}: ActivityFormModalProps) {
  const [mode, setMode] = useState<FormMode>('activity');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [completionAmount, setCompletionAmount] = useState(1);
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [dayTime, setDayTime] = useState<DayTime>('notSpecified');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>('private');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [hasWindow, setHasWindow] = useState(false);
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('23:59');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const tAct = useTranslations('activities');
  const tCreate = useTranslations('createActivity');
  const tReminder = useTranslations('createReminder');
  const tCommon = useTranslations('common');
  const tPrivacy = useTranslations('privacy');

  const isEdit = Boolean(activity || reminder);
  const effectiveMode: FormMode = activity
    ? 'activity'
    : reminder
      ? 'reminder'
      : (lockedMode ?? mode);

  const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
    { value: 'monday', label: tCreate('monday') },
    { value: 'tuesday', label: tCreate('tuesday') },
    { value: 'wednesday', label: tCreate('wednesday') },
    { value: 'thursday', label: tCreate('thursday') },
    { value: 'friday', label: tCreate('friday') },
    { value: 'saturday', label: tCreate('saturday') },
    { value: 'sunday', label: tCreate('sunday') },
  ];

  const DAY_TIMES: { value: DayTime; label: string }[] = [
    { value: 'notSpecified', label: tCreate('anyMoment') },
    { value: 'morning', label: tCreate('morning') },
    { value: 'afternoon', label: tCreate('afternoon') },
    { value: 'evening', label: tCreate('evening') },
  ];

  const FREQUENCIES: { value: Frequency; label: string }[] = [
    { value: 'daily', label: tCreate('daily') },
    { value: 'weekly', label: tCreate('weekly') },
    { value: 'monthly', label: tCreate('monthly') },
  ];

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCompletionAmount(1);
    setFrequency('daily');
    setDayTime('notSpecified');
    setSelectedDays([]);
    setPrivacyStatus('private');
    setDueDate(undefined);
    setHasWindow(false);
    setStartTime('07:00');
    setEndTime('23:59');
  };

  // Seed the form each time the modal opens: from the edited entity, from
  // initialValues (e.g. cloned from a template), otherwise from defaults.
  useEffect(() => {
    if (!open) return;

    if (activity) {
      setMode('activity');
      setTitle(activity.title);
      setDescription(activity.description);
      setCompletionAmount(activity.completionAmount);
      setFrequency(activity.frequency);
      setDayTime(activity.dayTime);
      setPrivacyStatus(activity.privacyStatus || 'private');
      if (activity.dayFrequency) {
        try {
          setSelectedDays(JSON.parse(activity.dayFrequency) as DayOfWeek[]);
        } catch {
          setSelectedDays([]);
        }
      } else {
        setSelectedDays([]);
      }
      return;
    }

    if (reminder) {
      setMode('reminder');
      setTitle(reminder.title);
      setDescription(reminder.description);
      const due = new Date(reminder.dueAt);
      setDueDate(new Date(due.getFullYear(), due.getMonth(), due.getDate()));
      setEndTime(formatTimeInput(due));
      if (reminder.activeFrom) {
        setHasWindow(true);
        setStartTime(formatTimeInput(new Date(reminder.activeFrom)));
      } else {
        setHasWindow(false);
      }
      return;
    }

    // Create mode: normal activity by default; the Reminder checkbox opts into
    // reminder mode.
    setMode(lockedMode ?? 'activity');
    if (initialValues) {
      setTitle(initialValues.title ?? '');
      setDescription(initialValues.description ?? '');
      setCompletionAmount(initialValues.completionAmount ?? 1);
      setFrequency(initialValues.frequency ?? 'daily');
      setDayTime(initialValues.dayTime ?? 'notSpecified');
      setSelectedDays(initialValues.dayFrequency ?? []);
      setPrivacyStatus(initialValues.privacyStatus ?? 'private');
      setDueDate(undefined);
      setHasWindow(false);
      setStartTime('07:00');
      setEndTime('23:59');
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity, reminder, initialValues, lockedMode]);

  const handleDayToggle = (day: DayOfWeek, checked: boolean) => {
    if (checked) {
      setSelectedDays([...selectedDays, day]);
    } else {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    }
  };

  const submitActivity = async () => {
    if (frequency === 'weekly' && selectedDays.length === 0) {
      showToast({
        title: tCreate('validationError'),
        description: tCreate('selectDayError'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        title,
        description,
        completionAmount,
        frequency,
        dayTime,
        dayFrequency: frequency === 'weekly' ? selectedDays : undefined,
        privacyStatus,
      };

      if (activity) {
        const updated = await activityService.updateActivity(
          activity.id,
          payload
        );
        onActivityUpdated?.(updated);
        showToast({
          title: tAct('activityUpdated'),
          description: tAct('activityUpdatedDescription'),
        });
      } else {
        const created = await activityService.createActivity(payload);
        onActivityCreated?.(created);
        showToast({
          title: tCreate('activityCreated'),
          description: tCreate('activityCreatedDescription'),
        });
      }
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Save activity error:', error);
      showToast({
        title: tCreate('creationFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const submitReminder = async () => {
    if (!dueDate) {
      showToast({
        title: tReminder('validationError'),
        description: tReminder('pickDateError'),
        variant: 'destructive',
      });
      return;
    }

    // No active window: completable for the entire selected day.
    const dueAt = buildDateTime(dueDate, hasWindow ? endTime : '23:59');
    const activeFrom = hasWindow
      ? buildDateTime(dueDate, startTime)
      : buildDateTime(dueDate, '00:00');
    if (activeFrom >= dueAt) {
      showToast({
        title: tReminder('validationError'),
        description: tReminder('windowBeforeDeadlineError'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        title,
        description,
        dueAt: dueAt.toISOString(),
        activeFrom: activeFrom.toISOString(),
      };

      if (reminder) {
        const updated = await reminderService.updateReminder(
          reminder.id,
          payload
        );
        onReminderUpdated?.(updated);
        showToast({
          title: tReminder('reminderUpdated'),
          description: tReminder('reminderUpdatedDescription'),
        });
      } else {
        const created = await reminderService.createReminder(payload);
        onReminderCreated?.(created);
        showToast({
          title: tReminder('reminderCreated'),
          description: tReminder('reminderCreatedDescription'),
        });
      }
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Save reminder error:', error);
      showToast({
        title: reminder
          ? tReminder('updateFailed')
          : tReminder('creationFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Stop the submit from bubbling up the React tree into a parent form
    // (e.g. the routine form when this modal is nested in the activity picker).
    e.stopPropagation();

    if (effectiveMode === 'activity') {
      await submitActivity();
    } else {
      await submitReminder();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const dialogTitle = isEdit
    ? activity
      ? tAct('editActivity')
      : tReminder('updateReminder')
    : effectiveMode === 'activity'
      ? tCreate('title')
      : tReminder('title');
  const dialogDescription = isEdit
    ? activity
      ? tCreate('description')
      : undefined
    : effectiveMode === 'activity'
      ? tCreate('description')
      : tReminder('description');
  const submitLabel = isEdit
    ? activity
      ? tAct('updateActivity')
      : tReminder('updateReminder')
    : effectiveMode === 'activity'
      ? tCreate('createActivity')
      : tReminder('createReminder');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {dialogDescription && (
            <DialogDescription>{dialogDescription}</DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entity-title">
              {effectiveMode === 'activity'
                ? tCreate('titleLabel')
                : tReminder('titleLabel')}
            </Label>
            <Input
              id="entity-title"
              type="text"
              placeholder={
                effectiveMode === 'activity'
                  ? tCreate('titlePlaceholder')
                  : tReminder('titlePlaceholder')
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entity-description">
              {effectiveMode === 'activity'
                ? tCreate('descriptionLabel')
                : tReminder('descriptionLabel')}
            </Label>
            <Textarea
              id="entity-description"
              placeholder={
                effectiveMode === 'activity'
                  ? tCreate('descriptionPlaceholder')
                  : tReminder('descriptionPlaceholder')
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-input border-border resize-none"
              rows={3}
            />
          </div>

          {!isEdit && !lockedMode && (
            <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="entity-mode"
                  checked={mode === 'reminder'}
                  onCheckedChange={(checked) =>
                    setMode(checked === true ? 'reminder' : 'activity')
                  }
                  className="border-muted-foreground/70"
                />
                <Label htmlFor="entity-mode" className="text-sm font-medium">
                  {tAct('modeReminder')}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {tAct('modeHint')}
              </p>
            </div>
          )}

          {effectiveMode === 'activity' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entity-completionAmount">
                    {tCreate('targetAmount')}
                  </Label>
                  <Input
                    id="entity-completionAmount"
                    type="number"
                    min="1"
                    value={completionAmount}
                    onChange={(e) =>
                      setCompletionAmount(Number(e.target.value))
                    }
                    required
                    className="bg-input border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entity-dayTime">{tAct('timeOfDay')}</Label>
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
                <Label htmlFor="entity-frequency">{tAct('frequency')}</Label>
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
                  <Label>{tCreate('daysOfWeek')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div
                        key={day.value}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`entity-${day.value}`}
                          checked={selectedDays.includes(day.value)}
                          onCheckedChange={(checked) =>
                            handleDayToggle(day.value, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={`entity-${day.value}`}
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
                <Label htmlFor="entity-privacyStatus">
                  {tPrivacy('privacyStatus')}
                </Label>
                <Select
                  value={privacyStatus}
                  onValueChange={(value: PrivacyStatus) =>
                    setPrivacyStatus(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      {tPrivacy('private')}
                    </SelectItem>
                    <SelectItem value="public">{tPrivacy('public')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {tPrivacy('activityPrivacyDescription')}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{tReminder('dueDate')}</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal"
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {dueDate
                        ? dueDate.toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : tReminder('dueDatePlaceholder')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(date) => {
                        setDueDate(date ?? undefined);
                        setCalendarOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="entity-hasWindow"
                    checked={hasWindow}
                    onCheckedChange={(checked) =>
                      setHasWindow(checked === true)
                    }
                    className="border-muted-foreground/70"
                  />
                  <Label
                    htmlFor="entity-hasWindow"
                    className="text-sm font-medium"
                  >
                    {tReminder('activeWindow')}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tReminder('activeWindowHint')}
                </p>

                {hasWindow && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-2">
                      <Label htmlFor="entity-startTime" className="text-xs">
                        {tReminder('windowStartTime')}
                      </Label>
                      <TimeInput
                        id="entity-startTime"
                        value={startTime}
                        onChange={setStartTime}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entity-endTime" className="text-xs">
                        {tReminder('windowEndTime')}
                      </Label>
                      <TimeInput
                        id="entity-endTime"
                        value={endTime}
                        onChange={setEndTime}
                        className="bg-input border-border"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

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
                ? isEdit
                  ? tCommon('updating')
                  : tCreate('creating')
                : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
