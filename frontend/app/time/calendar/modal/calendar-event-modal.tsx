'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TimeInput } from '@/components/ui/time-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2 } from 'lucide-react';
import { calendarService } from '@shared/services/calendar-service';
import type {
  CalendarEvent,
  CalendarEventScope,
  CreateCalendarEventInput,
} from '@shared/types/calendar';
import { TIME_CATEGORIES } from '@shared/types/time';
import { useTranslations } from '@shared/contexts/language-context';
import { showToast } from '@/lib/toast';
import {
  addDaysToDateValue,
  combineDateAndTime,
  isNextDayEnd,
  timeInputValueAt,
  toDateInputValue,
  toEndOfDayInstant,
  toTimeInputValue,
} from '../lib/week';

const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
/** Default length of a new weekly series, in weeks. */
const DEFAULT_SERIES_WEEKS = 4;

type RecurrenceChoice = 'none' | 'weekly';

export interface EventDefaults {
  date: Date;
  startMinutes: number;
  endMinutes: number;
}

interface CalendarEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Event being edited; null for creation. */
  event: CalendarEvent | null;
  /** Prefill for creation (slot click or "New event"). */
  defaults: EventDefaults | null;
  onSaved: (mode: 'created' | 'updated') => void;
  onRequestDelete: (event: CalendarEvent) => void;
}

export function CalendarEventModal({
  open,
  onOpenChange,
  event,
  defaults,
  onSaved,
  onRequestDelete,
}: CalendarEventModalProps) {
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Other');
  const [description, setDescription] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [recurrence, setRecurrence] = useState<RecurrenceChoice>('none');
  const [untilDate, setUntilDate] = useState('');
  const [scope, setScope] = useState<CalendarEventScope>('occurrence');
  /** Overnight events end on the calendar day after the start date. */
  const [endsNextDay, setEndsNextDay] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The repeat rule is fixed once the event exists: a series is materialized
  // at creation time, so it cannot be turned into one (or back) later.
  const isEditing = event !== null;
  const isSeriesEvent = Boolean(event?.seriesId);

  useEffect(() => {
    if (!open) return;

    if (event) {
      const start = new Date(event.startAt);
      const end = new Date(event.endAt);
      setTitle(event.title);
      setCategory(event.category);
      setDescription(event.description);
      setDateValue(toDateInputValue(start));
      setStartTime(toTimeInputValue(start));
      setEndTime(toTimeInputValue(end));
      setRecurrence(event.recurrenceRule === 'weekly' ? 'weekly' : 'none');
      setUntilDate(
        event.recurrenceUntil
          ? toDateInputValue(new Date(event.recurrenceUntil))
          : ''
      );
      setScope('occurrence');
      setEndsNextDay(isNextDayEnd(event.startAt, event.endAt));
      return;
    }

    if (defaults) {
      setTitle('');
      setCategory('Other');
      setDescription('');
      setDateValue(toDateInputValue(defaults.date));
      setStartTime(timeInputValueAt(defaults.date, defaults.startMinutes));
      setEndTime(timeInputValueAt(defaults.date, defaults.endMinutes));
      setRecurrence('none');
      setUntilDate('');
      setScope('occurrence');
      setEndsNextDay(false);
    }
  }, [open, event, defaults]);

  const handleRecurrenceChange = (value: string) => {
    const choice = value as RecurrenceChoice;
    setRecurrence(choice);
    if (choice === 'weekly' && !untilDate) {
      setUntilDate(addDaysToDateValue(dateValue, DEFAULT_SERIES_WEEKS * 7));
    }
  };

  const save = async (action: () => Promise<unknown>) => {
    setIsSubmitting(true);
    try {
      await action();
      showToast({
        title: event ? t('eventUpdated') : t('eventCreated'),
        description: t(
          event ? 'eventUpdatedDescription' : 'eventCreatedDescription',
          { title: title.trim() }
        ),
      });
      onSaved(event ? 'updated' : 'created');
    } catch (error) {
      showToast({
        title: t('failedToSave'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showToast({
        title: t('titleRequired'),
        description: t('titleRequiredDescription'),
        variant: 'destructive',
      });
      return;
    }

    const start = combineDateAndTime(dateValue, startTime);
    const end = combineDateAndTime(
      endsNextDay ? addDaysToDateValue(dateValue, 1) : dateValue,
      endTime
    );

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      showToast({
        title: t('invalidRange'),
        variant: 'destructive',
      });
      return;
    }

    if (end.getTime() - start.getTime() > MAX_DURATION_MS) {
      showToast({ title: t('tooLong'), variant: 'destructive' });
      return;
    }

    const payload = {
      title: trimmedTitle,
      description,
      category,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    };

    if (event) {
      await save(() => calendarService.updateEvent(event.id, payload, scope));
      return;
    }

    const input: CreateCalendarEventInput = { ...payload };
    if (recurrence === 'weekly') {
      if (!untilDate) {
        showToast({ title: t('repeatUntilRequired'), variant: 'destructive' });
        return;
      }
      if (untilDate < dateValue) {
        showToast({
          title: t('repeatUntilBeforeStart'),
          variant: 'destructive',
        });
        return;
      }
      input.recurrence = {
        rule: 'weekly',
        interval: 1,
        until: toEndOfDayInstant(untilDate),
      };
    }

    await save(() => calendarService.createEvent(input));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? t('editEvent') : t('newEvent')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">{t('eventTitle')}</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              maxLength={255}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-category">{t('category')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="event-category">
                <SelectValue placeholder={t('category')} />
              </SelectTrigger>
              <SelectContent>
                {TIME_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-date">{t('date')}</Label>
            <Input
              id="event-date"
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event-start">{t('startTime')}</Label>
              <TimeInput
                id="event-start"
                value={startTime}
                onChange={setStartTime}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end">{t('endTime')}</Label>
              <TimeInput id="event-end" value={endTime} onChange={setEndTime} />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="event-overnight"
              checked={endsNextDay}
              onCheckedChange={(checked) => setEndsNextDay(checked === true)}
            />
            <Label
              htmlFor="event-overnight"
              className="text-sm font-normal cursor-pointer"
            >
              {t('endsNextDay')}
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-repeat">{t('repeat')}</Label>
            <Select
              value={recurrence}
              onValueChange={handleRecurrenceChange}
              disabled={isEditing}
            >
              <SelectTrigger id="event-repeat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('repeatNone')}</SelectItem>
                <SelectItem value="weekly">{t('repeatWeekly')}</SelectItem>
              </SelectContent>
            </Select>
            {isEditing ? (
              <p className="text-xs text-muted-foreground">
                {t('repeatLocked')}
              </p>
            ) : null}
          </div>

          {recurrence === 'weekly' ? (
            <div className="space-y-2">
              <Label htmlFor="event-repeat-until">{t('repeatUntil')}</Label>
              <Input
                id="event-repeat-until"
                type="date"
                value={untilDate}
                onChange={(e) => setUntilDate(e.target.value)}
                disabled={isEditing}
                className="text-foreground"
              />
            </div>
          ) : null}

          {isSeriesEvent ? (
            <div className="space-y-2">
              <Label htmlFor="event-scope">{t('applyTo')}</Label>
              <Select
                value={scope}
                onValueChange={(value) => setScope(value as CalendarEventScope)}
              >
                <SelectTrigger id="event-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="occurrence">
                    {t('applyToOccurrence')}
                  </SelectItem>
                  <SelectItem value="series">{t('applyToSeries')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('seriesEvent')}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="event-description">{t('description')}</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={2}
              maxLength={1000}
            />
          </div>

          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            {event ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => onRequestDelete(event)}
                disabled={isSubmitting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {tCommon('delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                {isSubmitting
                  ? event
                    ? tCommon('updating')
                    : tCommon('saving')
                  : tCommon('save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
