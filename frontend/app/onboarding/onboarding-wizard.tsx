'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { AuthGuard } from '@/components/auth-guard';
import { Loader2 } from 'lucide-react';
import {
  ACTIVITY_TEMPLATES,
  ACTIVITY_TEMPLATE_CATEGORIES,
  type ActivityTemplate,
  type ActivityTemplateCategory,
} from '@shared/lib/activity-templates';
import { FINANCE_TEMPLATES } from '@shared/lib/finance-templates';
import type { DayOfWeek } from '@shared/types/activity';
import { activityService } from '@shared/services/activity-service';
import { financeService } from '@shared/services/finance-service';
import { userService } from '@shared/services/user-service';
import { authService } from '@shared/services/auth-service';
import { useTranslations } from '@shared/contexts/language-context';
import { cn } from '@/lib/utils';

type PersonaKey = 'fit' | 'organized' | 'productive';

interface Persona {
  key: PersonaKey;
  categories: ActivityTemplateCategory[];
}

const PERSONAS: Persona[] = [
  { key: 'fit', categories: ['health', 'homeTraining'] },
  { key: 'organized', categories: ['home', 'goodHabits'] },
  { key: 'productive', categories: ['productivity'] },
];

const DAY_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

type WizardStep = 'welcome' | 'activities' | 'finance' | 'done';

interface CreateSummary {
  activities: number;
  bills: number;
  failed: number;
}

export function OnboardingWizard() {
  const t = useTranslations('onboarding');
  const tTemplates = useTranslations('activityTemplates');
  const tActivities = useTranslations('activities');
  const tFinanceTemplates = useTranslations('financeTemplates');

  const router = useRouter();

  const firstName = authService.getCurrentUser()?.firstName ?? '';

  const [step, setStep] = useState<WizardStep>('welcome');
  const [persona, setPersona] = useState<PersonaKey | null>(null);
  const [category, setCategory] = useState<ActivityTemplateCategory>('health');
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(
    new Set()
  );
  const [billAmounts, setBillAmounts] = useState<Record<string, string>>({});
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [summary, setSummary] = useState<CreateSummary | null>(null);

  const templates = useMemo(
    () =>
      ACTIVITY_TEMPLATES.filter((template) => template.category === category),
    [category]
  );

  const applyPersona = (key: PersonaKey) => {
    const fKey = persona === key ? null : key;
    setPersona(fKey);
    if (!fKey) return;

    const personaDefinition = PERSONAS.find((p) => p.key === fKey);
    if (!personaDefinition) return;
    setCategory(personaDefinition.categories[0]);
    setSelectedActivities((prev) => {
      const next = new Set(prev);
      for (const template of ACTIVITY_TEMPLATES) {
        if (personaDefinition.categories.includes(template.category)) {
          next.add(template.key);
        }
      }
      return next;
    });
  };

  const toggleActivity = (template: ActivityTemplate) => {
    setSelectedActivities((prev) => {
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
      .map((day) => tActivities(day))
      .join(', ');

  const buildActivity = (template: ActivityTemplate) => ({
    title: tTemplates(`template_${template.key}`),
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

  const goNext = async (from: WizardStep) => {
    if (from === 'welcome') {
      setStep('activities');
      return;
    }
    if (from === 'activities') {
      setStep('finance');
      return;
    }
    if (from === 'finance') {
      await handleFinish();
    }
  };

  const handleFinish = async () => {
    setIsCreating(true);
    const created: CreateSummary = { activities: 0, bills: 0, failed: 0 };

    for (const template of ACTIVITY_TEMPLATES) {
      if (!selectedActivities.has(template.key)) continue;
      try {
        await activityService.createActivity(buildActivity(template));
        created.activities += 1;
      } catch (error) {
        console.error('Failed to create activity from template:', error);
        created.failed += 1;
      }
    }

    for (const template of FINANCE_TEMPLATES) {
      if (!selectedBills.has(template.key)) continue;
      const amount = parseFloat(billAmounts[template.key] ?? '');
      try {
        await financeService.createTransaction({
          type: template.type,
          frequency: 'fixed',
          paymentFrequency: template.paymentFrequency,
          category: template.category,
          description: tFinanceTemplates(`template_${template.key}`),
          amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
        });
        created.bills += 1;
      } catch (error) {
        console.error('Failed to create transaction from template:', error);
        created.failed += 1;
      }
    }

    try {
      await userService.completeOnboarding();
    } catch (error) {
      // Non-blocking: the guide can still be closed, completion is retried
      // next time the user logs in.
      console.error('Failed to mark onboarding as completed:', error);
    }

    setSummary(created);
    setIsCreating(false);
    setStep('done');
  };

  const handleSkip = () => {
    // Best effort: legacy users never marked, keep them flowing to the app.
    userService.completeOnboarding().catch(() => {});
    router.push('/activities');
  };

  const stepIndex = step === 'welcome' ? 1 : step === 'activities' ? 2 : 3;
  const stepLabel = t('step', { current: stepIndex, total: 3 });
  const nextLabel = step === 'finance' ? t('finish') : t('next');

  const content =
    step === 'welcome' ? (
      <div className="space-y-4 text-center py-8">
        <h1 className="text-2xl font-semibold text-foreground">
          {firstName
            ? t('welcome_title', { name: firstName })
            : t('welcome_title_generic')}
        </h1>
        <p className="text-muted-foreground">{t('welcome_description')}</p>
        <p className="text-xs text-muted-foreground">{t('welcome_hint')}</p>
      </div>
    ) : step === 'activities' ? (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t('activities_title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('activities_description')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PERSONAS.map((personaDefinition) => {
            const isActive = persona === personaDefinition.key;
            return (
              <button
                key={personaDefinition.key}
                type="button"
                onClick={() => applyPersona(personaDefinition.key)}
                aria-pressed={isActive}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-lg border p-3 text-left cursor-pointer transition-colors hover:bg-accent/50',
                  isActive && 'border-primary/50 bg-primary/5'
                )}
              >
                <span className="text-sm font-medium text-foreground">
                  {t(`persona_${personaDefinition.key}`)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`persona_${personaDefinition.key}_description`)}
                </span>
              </button>
            );
          })}
        </div>
        {persona && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPersona(null);
              setSelectedActivities(new Set());
            }}
          >
            {t('persona_clear')}
          </Button>
        )}
        <div className="flex items-center gap-1 flex-wrap">
          {ACTIVITY_TEMPLATE_CATEGORIES.map((value) => (
            <Button
              key={value}
              variant={category === value ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setCategory(value)}
            >
              {tTemplates(`category_${value}`)}
            </Button>
          ))}
        </div>
        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {templates.map((template) => {
            const isSelected = selectedActivities.has(template.key);
            return (
              <div
                key={template.key}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => toggleActivity(template)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleActivity(template);
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
                    {tTemplates(`template_${template.key}`)}
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
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{t('activities_hint')}</p>
      </div>
    ) : step === 'finance' ? (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t('finance_title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('finance_description')}
          </p>
        </div>
        <div className="space-y-2">
          {FINANCE_TEMPLATES.map((template) => {
            const isSelected = selectedBills.has(template.key);
            const amount = billAmounts[template.key] ?? '';
            return (
              <div
                key={template.key}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                  isSelected && 'border-primary/50 bg-primary/5'
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => {
                    setSelectedBills((prev) => {
                      const next = new Set(prev);
                      if (next.has(template.key)) {
                        next.delete(template.key);
                      } else {
                        next.add(template.key);
                      }
                      return next;
                    });
                  }}
                />
                <span className="text-sm font-medium text-foreground flex-1 min-w-0">
                  {tFinanceTemplates(`template_${template.key}`)}
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  disabled={!isSelected}
                  value={amount}
                  placeholder={
                    template.suggestedAmount != null
                      ? t('finance_amountHint', {
                          amount: template.suggestedAmount,
                        })
                      : ''
                  }
                  onChange={(e) =>
                    setBillAmounts((prev) => ({
                      ...prev,
                      [template.key]: e.target.value,
                    }))
                  }
                  className="w-32 bg-input"
                  aria-label={`${t('finance_amount')} — ${tFinanceTemplates(`template_${template.key}`)}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    ) : (
      <div className="space-y-4 text-center py-8">
        <h2 className="text-2xl font-semibold text-foreground">
          {summary && summary.failed > 0
            ? t('creating_partial')
            : t('creating_done')}
        </h2>
        <p className="text-muted-foreground">
          {summary && summary.failed > 0
            ? t('creating_partial_description', {
                created: summary.activities + summary.bills,
                failed: summary.failed,
              })
            : t('creating_done_description', {
                activities: summary?.activities ?? 0,
                bills: summary?.bills ?? 0,
              })}
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-xl bg-surface">
        <CardContent className="p-6 space-y-6">
          {step !== 'done' && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{stepLabel}</span>
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                {t('skip')}
              </Button>
            </div>
          )}
          {content}
          {step !== 'done' ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                disabled={step === 'welcome' || isCreating}
                onClick={() => {
                  if (step === 'finance') {
                    setStep('activities');
                  } else if (step === 'activities') {
                    setStep('welcome');
                  }
                }}
              >
                {t('back')}
              </Button>
              <Button onClick={() => goNext(step)} disabled={isCreating}>
                {isCreating && step === 'finance' && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {nextLabel}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button onClick={() => router.push('/activities')}>
                {t('finish')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
