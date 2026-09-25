'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
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
import { reminderService } from '@shared/services/reminder-service';
import type { Reminder } from '@shared/types/reminder';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@shared/contexts/language-context';
import {
  buildDateTime,
  formatTimeInput,
} from './create-reminder-modal';
import { TimeInput } from '../components/time-input';

interface EditReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminder: Reminder | null;
  onReminderUpdated: (reminder: Reminder) => void;
}

export function EditReminderModal({
  open,
  onOpenChange,
  reminder,
  onReminderUpdated,
}: EditReminderModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [hasWindow, setHasWindow] = useState(false);
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('23:59');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const t = useTranslations('createReminder');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (!reminder || !open) return;

    setTitle(reminder.title);
    setDescription(reminder.description);

    const due = new Date(reminder.dueAt);
    setDueDate(new Date(due.getFullYear(), due.getMonth(), due.getDate()));
    setEndTime(formatTimeInput(due));

    if (reminder.activeFrom) {
      const active = new Date(reminder.activeFrom);
      setHasWindow(true);
      setStartTime(formatTimeInput(active));
    } else {
      setHasWindow(false);
    }
  }, [reminder, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!reminder || !dueDate) return;

    const dueAt = buildDateTime(dueDate, endTime);
    const activeFrom = hasWindow
      ? buildDateTime(dueDate, startTime)
      : new Date();

    if (activeFrom >= dueAt) {
      showToast({
        title: t('validationError'),
        description: t('windowBeforeDeadlineError'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const updated = await reminderService.updateReminder(reminder.id, {
        title,
        description,
        dueAt: dueAt.toISOString(),
        activeFrom: activeFrom.toISOString(),
      });

      onReminderUpdated(updated);
      showToast({
        title: t('reminderUpdated'),
        description: t('reminderUpdatedDescription'),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('updateReminder')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">{t('titleLabel')}</Label>
            <Input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">{t('descriptionLabel')}</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-input border-border resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('dueDate')}</Label>
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
                    : t('dueDatePlaceholder')}
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
                id="edit-hasWindow"
                checked={hasWindow}
                onCheckedChange={(checked) => setHasWindow(checked === true)}
                className="border-muted-foreground/70"
              />
              <Label htmlFor="edit-hasWindow" className="text-sm font-medium">
                {t('activeWindow')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('activeWindowHint')}
            </p>

            {hasWindow && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="edit-startTime" className="text-xs">
                    {t('windowStartTime')}
                  </Label>
                  <TimeInput
                    id="edit-startTime"
                    value={startTime}
                    onChange={setStartTime}
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-endTime" className="text-xs">
                    {t('windowEndTime')}
                  </Label>
                  <TimeInput
                    id="edit-endTime"
                    value={endTime}
                    onChange={setEndTime}
                    className="bg-input border-border"
                  />
                </div>
              </div>
            )}
          </div>

          {!hasWindow && (
            <div className="space-y-2">
              <Label htmlFor="edit-defaultEndTime" className="text-xs">
                {t('windowEndHint')}
              </Label>
              <TimeInput
                id="edit-defaultEndTime"
                value={endTime}
                onChange={setEndTime}
                className="bg-input border-border"
              />
            </div>
          )}

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
              {isLoading ? tCommon('save') : t('updateReminder')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
