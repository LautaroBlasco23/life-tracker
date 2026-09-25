'use client';

import type React from 'react';

import { useState } from 'react';
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
import { TimeInput } from '../components/time-input';

interface CreateReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReminderCreated: (reminder: Reminder) => void;
}

/** Combines a calendar date with an "HH:MM" time input value into a local Date. */
export function buildDateTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function formatTimeInput(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function CreateReminderModal({
  open,
  onOpenChange,
  onReminderCreated,
}: CreateReminderModalProps) {
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

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate(undefined);
    setHasWindow(false);
    setStartTime('07:00');
    setEndTime('23:59');
  };

  const buildPayload = () => {
    const dueAt = buildDateTime(dueDate!, endTime);
    const activeFrom = hasWindow
      ? buildDateTime(dueDate!, startTime)
      : new Date();
    return { dueAt, activeFrom };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!dueDate) {
      showToast({
        title: t('validationError'),
        description: t('pickDateError'),
        variant: 'destructive',
      });
      return;
    }

    const { dueAt, activeFrom } = buildPayload();
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
      const newReminder = await reminderService.createReminder({
        title,
        description,
        dueAt: dueAt.toISOString(),
        activeFrom: activeFrom.toISOString(),
      });

      onReminderCreated(newReminder);
      resetForm();
      showToast({
        title: t('reminderCreated'),
        description: t('reminderCreatedDescription'),
      });
    } catch (error) {
      console.error('Create reminder error:', error);
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

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
                id="hasWindow"
                checked={hasWindow}
                onCheckedChange={(checked) => setHasWindow(checked === true)}
                className="border-muted-foreground/70"
              />
              <Label htmlFor="hasWindow" className="text-sm font-medium">
                {t('activeWindow')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('activeWindowHint')}
            </p>

            {hasWindow && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="startTime" className="text-xs">
                    {t('windowStartTime')}
                  </Label>
                  <TimeInput
                    id="startTime"
                    value={startTime}
                    onChange={setStartTime}
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime" className="text-xs">
                    {t('windowEndTime')}
                  </Label>
                  <TimeInput
                    id="endTime"
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
              <Label htmlFor="defaultEndTime" className="text-xs">
                {t('windowEndHint')}
              </Label>
              <TimeInput
                id="defaultEndTime"
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
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('creating') : t('createReminder')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
