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
  ROUTINE_TEMPLATES,
  TEMPLATE_CATEGORIES_BY_KIND,
  type ActivityTemplate,
  type RoutineTemplate,
  type TemplateCategory,
  type TemplateKind,
} from '@shared/lib/activity-templates';
import type { DayOfWeek } from '@shared/types/activity';
import { activityService } from '@shared/services/activity-service';
import { routineService } from '@shared/services/routine-service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

  const [kind, setKind] = useState<TemplateKind>('activity');
  const [category, setCategory] = useState<TemplateCategory>('health');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const kindCategories = TEMPLATE_CATEGORIES_BY_KIND[kind];

  useEffect(() => {
    if (open) {
      setKind('activity');
      setCategory('health');
      setSelectedKeys(new Set());
      setIsCreating(false);
    }
  }, [open]);

  const handleKindChange = (nextKind: string) => {
    setKind(nextKind as TemplateKind);
    // Reset the category to the first of the new kind's list.
    setCategory(TEMPLATE_CATEGORIES_BY_KIND[nextKind as TemplateKind][0]);
    setSelectedKeys(new Set());
  };

  const activityTemplates = ACTIVITY_TEMPLATES.filter(
    (template) => template.category === category
  );
  const routineTemplates = ROUTINE_TEMPLATES.filter(
    (template) => template.category === category
  );

  const selectedCount =
    ACTIVITY_TEMPLATES.filter((template) => selectedKeys.has(template.key))
      .length +
    ROUTINE_TEMPLATES.filter((template) => selectedKeys.has(template.key))
      .length;

  const toggleTemplate = (templateKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(templateKey)) {
        next.delete(templateKey);
      } else {
        next.add(templateKey);
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

  /** Creates the routine's child activities, then the routine bundling them. */
  const createRoutineFromTemplate = async (template: RoutineTemplate) => {
    const activityIds: number[] = [];
    for (const activityKey of template.activities) {
      const activityTemplate = ACTIVITY_TEMPLATES.find(
        (candidate) => candidate.key === activityKey
      );
      if (!activityTemplate) continue;
      const created = await activityService.createActivity(
        buildTemplate(activityTemplate)
      );
      activityIds.push(created.id);
    }
    await routineService.createRoutine({
      title: t(`template_${template.key}`),
      description: '',
      privacyStatus: 'private',
      status: 'active',
      activityIds: activityIds.map((activityId, position) => ({
        activityId,
        position,
      })),
    });
  };

  const handleCreateSelected = async () => {
    const selectedActivities = ACTIVITY_TEMPLATES.filter((template) =>
      selectedKeys.has(template.key)
    );
    const selectedRoutines = ROUTINE_TEMPLATES.filter((template) =>
      selectedKeys.has(template.key)
    );
    if (selectedActivities.length + selectedRoutines.length === 0) return;

    setIsCreating(true);
    let created = 0;
    let failed = 0;
    for (const template of selectedActivities) {
      try {
        await activityService.createActivity(buildTemplate(template));
        created += 1;
      } catch (error) {
        console.error('Failed to create activity from template:', error);
        failed += 1;
      }
    }
    for (const template of selectedRoutines) {
      try {
        await createRoutineFromTemplate(template);
        created += 1;
      } catch (error) {
        console.error('Failed to create routine from template:', error);
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

        <div className="flex items-center gap-2 px-6 py-3 border-b shrink-0">
          <Select value={kind} onValueChange={handleKindChange}>
            <SelectTrigger className="w-[170px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activity">{t('kind_activity')}</SelectItem>
              <SelectItem value="routine">{t('kind_routine')}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={category}
            onValueChange={(value) => setCategory(value as TemplateCategory)}
          >
            <SelectTrigger className="w-[170px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kindCategories.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`category_${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-2">
          {kind === 'activity'
            ? activityTemplates.map((template) => {
                const isSelected = selectedKeys.has(template.key);
                return (
                  <div
                    key={template.key}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => toggleTemplate(template.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleTemplate(template.key);
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
              })
            : routineTemplates.map((template) => {
                const isSelected = selectedKeys.has(template.key);
                return (
                  <div
                    key={template.key}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => toggleTemplate(template.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleTemplate(template.key);
                      }
                    }}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent/50',
                      isSelected && 'border-primary/50 bg-primary/5'
                    )}
                  >
                    <span className="mt-0.5 shrink-0">
                      <Checkbox checked={isSelected} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground break-words">
                        {t(`template_${template.key}`)}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        <Badge variant="outline" className="text-xs">
                          {t('activitiesCount', {
                            count: template.activities.length,
                          })}
                        </Badge>
                        {template.activities.map((activityKey) => (
                          <Badge
                            key={activityKey}
                            variant="secondary"
                            className="text-xs font-normal"
                          >
                            {t(`template_${activityKey}`)}
                          </Badge>
                        ))}
                      </div>
                    </div>
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
