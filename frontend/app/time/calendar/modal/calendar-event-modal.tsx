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
import { Trash2 } from 'lucide-react';
import { calendarService } from '@shared/services/calendar-service';
import type { CalendarEvent } from '@shared/types/calendar';
import { TIME_CATEGORIES } from '@shared/types/time';
import { useTranslations } from '@shared/contexts/language-context';
import { showToast } from '@/lib/toast';
import {
  combineDateAndTime,
  timeInputValueAt,
  toDateInputValue,
  toTimeInputValue,
} from '../lib/week';

const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      return;
    }

    if (defaults) {
      setTitle('');
      setCategory('Other');
      setDescription('');
      setDateValue(toDateInputValue(defaults.date));
      setStartTime(timeInputValueAt(defaults.date, defaults.startMinutes));
      setEndTime(timeInputValueAt(defaults.date, defaults.endMinutes));
    }
  }, [open, event, defaults]);

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
    const end = combineDateAndTime(dateValue, endTime);

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

    setIsSubmitting(true);
    try {
      const payload = {
        title: trimmedTitle,
        description,
        category,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      };

      if (event) {
        await calendarService.updateEvent(event.id, payload);
        showToast({
          title: t('eventUpdated'),
          description: t('eventUpdatedDescription', { title: trimmedTitle }),
        });
        onSaved('updated');
      } else {
        await calendarService.createEvent(payload);
        showToast({
          title: t('eventCreated'),
          description: t('eventCreatedDescription', { title: trimmedTitle }),
        });
        onSaved('created');
      }
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
