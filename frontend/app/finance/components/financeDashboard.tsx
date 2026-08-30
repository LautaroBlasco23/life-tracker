'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { FinanceSummary, FixedTransaction, MonthlyStats } from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { formatCurrency } from '@shared/utils/format';
import { translatePaymentFrequency } from '@shared/utils/translateEnums';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from '@shared/contexts/language-context';

interface DolarRate {
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

interface FinanceDashboardProps {
  fixedTransactions: FixedTransaction[];
  onRecordPayment: (transaction: FixedTransaction) => void;
}

function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return {
    start: `${now.getFullYear()}-${month}-01`,
    end: `${now.getFullYear()}-${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function FinanceDashboard({
  fixedTransactions,
  onRecordPayment,
}: FinanceDashboardProps) {
  const t = useTranslations('finance');
  const tCategories = useTranslations('financeCategories');
  const tCreate = useTranslations('createTransaction');

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [dolarRates, setDolarRates] = useState<{
    oficial: DolarRate | null;
    blue: DolarRate | null;
  }>({ oficial: null, blue: null });
  const [isLoadingDolar, setIsLoadingDolar] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const { start, end } = currentMonthRange();
        const [summaryData, statsData] = await Promise.all([
          financeService.getFinanceSummary(start, end),
          financeService.getMonthlyStats(new Date().getFullYear()),
        ]);
        if (cancelled) return;
        setSummary(summaryData);
        setMonthlyStats(statsData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    const loadDolarRates = async () => {
      setIsLoadingDolar(true);
      try {
        const res = await fetch('https://dolarapi.com/v1/dolares');
        const data = await res.json();
        const oficial =
          data.find(
            (r: DolarRate & { casa: string }) => r.casa === 'oficial'
          ) ?? null;
        const blue =
          data.find((r: DolarRate & { casa: string }) => r.casa === 'blue') ??
          null;
        if (!cancelled) setDolarRates({ oficial, blue });
      } catch (error) {
        console.error('Failed to load dolar rates:', error);
      } finally {
        if (!cancelled) setIsLoadingDolar(false);
      }
    };
    loadDolarRates();

    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingBills = fixedTransactions.filter(
    (transaction) => !transaction.currentPeriodPayment
  );

  const chartData = monthlyStats
    .map((stats, index) => ({
      name: stats.month.slice(0, 3),
      income: stats.totalIncome,
      outcome: stats.totalOutcome,
      monthIndex: index,
    }))
    .filter((data) => data.monthIndex <= new Date().getMonth())
    .slice(-6);

  const renderCategoryBreakdown = (
    items: FinanceSummary['incomeByCategory'],
    isIncome: boolean
  ) => {
    if (items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {isIncome ? t('noIncomeCategories') : t('noOutcomeCategories')}
        </p>
      );
    }
    return (
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.categoryName}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="truncate text-foreground">
                {tCategories(item.categoryName)}
              </span>
              <span
                className={`shrink-0 font-medium ${
                  isIncome
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                ${formatCurrency(item.total)}
              </span>
            </div>
            <Progress value={item.percentage} className="h-2" />
          </div>
        ))}
      </div>
    );
  };

  // Leave the background empty while loading; show the cards once loaded.
  if (isLoading) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-surface border-secondary/30 shadow-[inset_0_0_20px_rgba(97,218,251,0.05)]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('totalIncome')}
                </p>
                <p className="text-2xl font-bold text-muted-foreground">
                  ${formatCurrency(summary?.totalIncome ?? 0)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-secondary/10">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-secondary/30 shadow-[inset_0_0_20px_rgba(97,218,251,0.05)]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('totalOutcome')}
                </p>
                <p className="text-2xl font-bold text-muted-foreground">
                  ${formatCurrency(summary?.totalOutcome ?? 0)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-secondary/10">
                <TrendingDown className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-secondary/30 shadow-[inset_0_0_20px_rgba(97,218,251,0.05)]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('balance')}
                </p>
                <p
                  className={`text-2xl font-bold ${
                    (summary?.balance ?? 0) >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  ${formatCurrency(summary?.balance ?? 0)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-secondary/10">
                <Wallet className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(['oficial', 'blue'] as const).map((key) => {
          const rate = dolarRates[key];
          const label = key === 'oficial' ? t('usdOficial') : t('usdBlue');
          const updatedAt = rate
            ? new Date(rate.fechaActualizacion).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : null;

          return (
            <Card key={key} className="bg-surface border-secondary/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-full bg-secondary/10">
                    <DollarSign className="h-4 w-4 text-secondary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {label}
                  </span>
                </div>
                {isLoadingDolar ? null : rate ? (
                  <>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{t('buy')}</span>
                      <span className="font-semibold text-foreground">
                        ${formatCurrency(rate.compra)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-muted-foreground">{t('sell')}</span>
                      <span className="font-semibold text-foreground">
                        ${formatCurrency(rate.venta)}
                      </span>
                    </div>
                    {updatedAt && (
                      <p className="text-xs text-muted-foreground">
                        {t('updated', { date: updatedAt })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('unavailable')}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-surface border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            {t('monthlyTrend')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t('noChartData')}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={60}
                  tickFormatter={(value: number) => formatCurrency(value)}
                />
                <Tooltip
                  formatter={(value: number | string) =>
                    `$${formatCurrency(Number(value))}`
                  }
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                />
                <Bar
                  dataKey="income"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  name={t('income')}
                />
                <Bar
                  dataKey="outcome"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  name={t('outcome')}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-surface border-border/60">
          <CardHeader>
            <CardTitle className="text-base">{t('incomeByCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {renderCategoryBreakdown(summary?.incomeByCategory ?? [], true)}
          </CardContent>
        </Card>

        <Card className="bg-surface border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              {t('outcomeByCategory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderCategoryBreakdown(summary?.outcomeByCategory ?? [], false)}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-surface border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            {t('upcomingBills')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('noUpcomingBills')}
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingBills.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {tCategories(transaction.category)}
                    </p>
                    {transaction.description && (
                      <p className="truncate text-sm text-muted-foreground">
                        {transaction.description}
                      </p>
                    )}
                    <Badge variant="outline" className="mt-1">
                      {translatePaymentFrequency(
                        transaction.paymentFrequency,
                        tCreate
                      )}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onRecordPayment(transaction)}
                    className="shrink-0"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t('recordPayment')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
