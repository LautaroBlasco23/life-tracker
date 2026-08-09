'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { timeService } from '@/services/time-service';
import { showToast } from '@/lib/toast';
import { TIME_CATEGORIES, TimeRecord } from '@/types/time';
import { useTranslations } from '@/contexts/language-context';

interface EditTimeRecordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: TimeRecord | null;
  onRecordUpdated: (record: TimeRecord) => void;
}

export function EditTimeRecordModal({
  open,
  onOpenChange,
  record,
  onRecordUpdated,
}: EditTimeRecordModalProps) {
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = useTranslations('time');
  const tCommon = useTranslations('common');
  const tTimeCategories = useTranslations('timeCategories');

  const translateCategory = (cat: string) => {
    const keyMap: Record<string, string> = {
      reading: 'reading',
      gaming: 'gaming',
      exercise: 'exercise',
      work: 'work',
      study: 'study',
      meditation: 'meditation',
      hobbies: 'hobbies',
      social: 'social',
      entertainment: 'entertainment',
      other: 'other',
    };
    return tTimeCategories(keyMap[cat.toLowerCase()] || 'other');
  };

  useEffect(() => {
    if (record) {
      setCategory(record.category);
      setDescription(record.description);
      setHours(String(Math.floor(record.durationMinutes / 60)));
      setMinutes(String(record.durationMinutes % 60));
    }
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;

    const totalMinutes =
      (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);

    if (totalMinutes <= 0) {
      showToast({
        title: t('invalidDuration') || 'Invalid duration',
        description:
          t('enterValidDuration') || 'Please enter a valid duration.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedRecord = await timeService.updateRecord(record.id, {
        category,
        description,
        durationMinutes: totalMinutes,
      });
      onRecordUpdated(updatedRecord);
      showToast({
        title: t('timeUpdated') || 'Time updated',
        description:
          t('timeUpdatedDescription') || 'Your time entry has been updated.',
      });
    } catch (error) {
      showToast({
        title: tCommon('error'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
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
          <DialogTitle>{t('editEntry') || 'Edit Time Entry'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-category">{t('category')}</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger>
                <SelectValue placeholder={t('selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {TIME_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {translateCategory(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">{t('description')}</Label>
            <Textarea
              id="edit-description"
              placeholder={t('whatAreYouWorkingOn')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('duration') || 'Duration'}</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  placeholder="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
                <span className="text-xs text-muted-foreground mt-1 block">
                  {t('hours') || 'Hours'}
                </span>
              </div>
              <span className="text-muted-foreground">:</span>
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
                <span className="text-xs text-muted-foreground mt-1 block">
                  {t('minutes') || 'Minutes'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || !category}>
              {isSubmitting ? tCommon('updating') : tCommon('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
