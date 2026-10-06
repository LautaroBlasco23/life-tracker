import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, Pencil, X } from 'lucide-react-native';
import {
  ACTIVITY_TEMPLATES,
  ACTIVITY_TEMPLATE_CATEGORIES,
  type ActivityTemplate,
  type ActivityTemplateCategory,
} from '@shared';
import type { DayOfWeek } from '@shared/types/activity';
import { activityService, useTranslations } from '@shared';
import { showToast } from '../ui/toast';
import { Button } from '../ui/button';
import { useColors } from '../../lib/use-colors';
import { cn } from '../../lib/cn';

const DAY_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

interface TemplatesModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called after at least one activity was created, so the page reloads. */
  onCreated: () => void;
  /** Open the create modal prefilled with the template instead of cloning directly. */
  onCustomize: (template: ActivityTemplate) => void;
}

/** Mobile port of web's templates-modal.tsx (multi-select + customize). */
export function TemplatesModal({
  visible,
  onClose,
  onCreated,
  onCustomize,
}: TemplatesModalProps) {
  const t = useTranslations('activityTemplates');
  const tActivities = useTranslations('activities');
  const tCreate = useTranslations('createActivity');
  const colors = useColors();

  const [category, setCategory] = useState<ActivityTemplateCategory>('health');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      setCategory('health');
      setSelectedKeys(new Set());
      setIsCreating(false);
    }
  }, [visible]);

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
      template.frequency === 'weekly' ? (template.dayFrequency ?? []) : undefined,
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
      } catch {
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
      onClose();
      onCreated();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <View className="flex-row items-start justify-between mb-1">
            <View className="flex-1 mr-2">
              <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground">
                {t('title')}
              </Text>
              <Text className="text-sm text-muted dark:text-dark-muted mt-0.5">
                {t('description')}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} className="p-1">
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

        {/* Category chips */}
          <View className="flex-row flex-wrap gap-2 mt-4 mb-3">
            {ACTIVITY_TEMPLATE_CATEGORIES.map((value) => (
              <Pressable
                key={value}
                onPress={() => setCategory(value)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg border',
                  category === value
                    ? 'bg-primary dark:bg-dark-primary border-primary dark:border-dark-primary'
                    : 'border-border dark:border-dark-border'
                )}
              >
                <Text
                  className={cn(
                    'text-xs',
                    category === value
                      ? 'text-primary-foreground dark:text-dark-primary-foreground'
                      : 'text-muted dark:text-dark-muted'
                  )}
                >
                  {t(`category_${value}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" className="flex-1">
            {templates.map((template) => {
              const isSelected = selectedKeys.has(template.key);
              return (
                <Pressable
                  key={template.key}
                  onPress={() => toggleTemplate(template)}
                  className={cn(
                    'flex-row items-start gap-3 rounded-lg border p-3 mb-2',
                    isSelected
                      ? 'border-primary/50 dark:border-dark-primary/50 bg-primary/5 dark:bg-dark-primary/5'
                      : 'border-border dark:border-dark-border'
                  )}
                >
                  <View
                    className={cn(
                      'h-5 w-5 rounded border items-center justify-center mt-0.5',
                      isSelected
                        ? 'bg-primary dark:bg-dark-primary border-primary dark:border-dark-primary'
                        : 'border-border dark:border-dark-border'
                    )}
                  >
                    {isSelected ? <Check size={13} color={colors.primaryForeground} /> : null}
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                      {t(`template_${template.key}`)}
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5 mt-1.5">
                      <View className="rounded-md border border-border dark:border-dark-border px-2 py-0.5">
                        <Text className="text-xs text-muted dark:text-dark-muted">
                          {tActivities(template.frequency)}
                        </Text>
                      </View>
                      {template.frequency === 'weekly' && template.dayFrequency ? (
                        <View className="rounded-md border border-border dark:border-dark-border px-2 py-0.5">
                          <Text className="text-xs text-muted dark:text-dark-muted">
                            {formatDays(template.dayFrequency)}
                          </Text>
                        </View>
                      ) : null}
                      <View className="rounded-md border border-border dark:border-dark-border px-2 py-0.5">
                        <Text className="text-xs text-muted dark:text-dark-muted">
                          {tActivities(template.dayTime)}
                        </Text>
                      </View>
                      {template.completionAmount > 1 ? (
                        <View className="rounded-md border border-border dark:border-dark-border px-2 py-0.5">
                          <Text className="text-xs text-muted dark:text-dark-muted">
                            {template.completionAmount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      onCustomize(template);
                    }}
                    hitSlop={8}
                    accessibilityLabel={t('customize')}
                    className="p-1"
                  >
                    <Pencil size={16} color={colors.primary} />
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>

          <View className="flex-row items-center justify-between gap-2 pt-4">
            <Text className="text-sm text-muted dark:text-dark-muted flex-1">
              {t('selectedCount', { count: selectedCount })}
            </Text>
            <Button
              onPress={handleCreateSelected}
              loading={isCreating}
              disabled={selectedCount === 0 || isCreating}
            >
              {isCreating
                ? t('creating')
                : t('createSelected', { count: selectedCount })}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
