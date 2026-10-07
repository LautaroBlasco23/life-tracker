'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Pencil } from 'lucide-react';
import {
  ACTIVITY_TEMPLATES,
  ACTIVITY_TEMPLATE_CATEGORIES,
  type ActivityTemplate,
  type ActivityTemplateCategory,
} from '@shared/lib/activity-templates';
import type { DayOfWeek } from '@shared/types/activity';
import { activityService } from '@shared/services/activity-service';
import { showToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useTranslations } from '@shared/contexts/language-context';

interface TemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after at least one activity was created, so the page reloads. */
  onCreated: () => void;
  /** Open the create modal prefilled with the template instead of cloning directly. */
  onCustomize: (template: ActivityTemplate) => void;
}

const DAY_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export function TemplatesModal({
  open,
  onOpenChange,
  onCreated,
  onCustomize,
}: TemplatesModalProps) {
  const t = useTranslations('activityTemplates');
  const tActivities = useTranslations('activities');
  const tCreate = useTranslations('createActivity');

  const [category, setCategory] = useState<ActivityTemplateCategory>('health');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory('health');
      setSelectedKeys(new Set());
      setIsCreating(false);
    }
  }, [open]);

  const templates = ACTIVITY_TEMPLATES.filter(
    (template) => template.category === category
  );

  const selectedCount = ACTIVITY_TEMPLATES.filter((template) =>
    selectedKeys.has(template.key)
  ).length;

  const toggleTemplate = (template: ActivityTemplate) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(template.key)) {
        next.delete(template.key);
      } else {
        next.add(template.key);
      }
      return next;
    });
  };

  const formatDays = (days: DayOfWeek[]): string =>
    DAY_ORDER.filter((day) => days.includes(day))
      .map((day) => tCreate(day))
      .join(', ');

  const buildTemplate = (template: ActivityTemplate) => ({
    title: t(`template_${template.key}`),
    description: '',
    completionAmount: template.completionAmount,
    frequency: template.frequency,
    dayFrequency:
      template.frequency === 'weekly'
        ? (template.dayFrequency ?? [])
        : undefined,
    dayTime: template.dayTime,
    privacyStatus: 'private' as const,
  });

  const handleCreateSelected = async () => {
    const selected = ACTIVITY_TEMPLATES.filter((template) =>
      selectedKeys.has(template.key)
    );
    if (selected.length === 0) return;

    setIsCreating(true);
    let created = 0;
    let failed = 0;
    for (const template of selected) {
      try {
        await activityService.createActivity(buildTemplate(template));
        created += 1;
      } catch (error) {
        console.error('Failed to create activity from template:', error);
        failed += 1;
      }
    }
    setIsCreating(false);

    if (created > 0) {
      showToast({
        title: t('created'),
        description: t('createdDescription', { count: created }),
      });
    }
    if (failed > 0) {
      showToast({
        title: t('partialFailure'),
        description: t('partialFailureDescription', { created, failed }),
        variant: 'destructive',
      });
    }
    if (created > 0) {
      setSelectedKeys(new Set());
      onOpenChange(false);
      onCreated();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isCreating) {
      setSelectedKeys(new Set());
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 flex-wrap px-6 py-3 border-b shrink-0">
          {ACTIVITY_TEMPLATE_CATEGORIES.map((value) => (
            <Button
              key={value}
              variant={category === value ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setCategory(value)}
            >
              {t(`category_${value}`)}
            </Button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-2">
          {templates.map((template) => {
            const isSelected = selectedKeys.has(template.key);
            return (
              <div
                key={template.key}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => toggleTemplate(template)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTemplate(template);
                  }
                }}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent/50',
                  isSelected && 'border-primary/50 bg-primary/5'
                )}
              >
                <span
                  className="mt-0.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox checked={isSelected} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground break-words">
                    {t(`template_${template.key}`)}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <Badge variant="outline" className="text-xs">
                      {tActivities(template.frequency)}
                    </Badge>
                    {template.frequency === 'weekly' &&
                      template.dayFrequency && (
                        <Badge variant="outline" className="text-xs">
                          {formatDays(template.dayFrequency)}
                        </Badge>
                      )}
                    <Badge variant="outline" className="text-xs">
                      {tActivities(template.dayTime)}
                    </Badge>
                    {template.completionAmount > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        {template.completionAmount}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('customize')}
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCustomize(template);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t shrink-0">
          <span className="text-sm text-muted-foreground">
            {t('selectedCount', { count: selectedCount })}
          </span>
          <Button
            onClick={handleCreateSelected}
            disabled={selectedCount === 0 || isCreating}
          >
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isCreating
              ? t('creating')
              : t('createSelected', { count: selectedCount })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
