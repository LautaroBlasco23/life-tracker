import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import type { FinanceSummary, FixedTransaction, MonthlyStats } from '@shared/types/finance';
import { financeService, translatePaymentFrequency, useTranslations } from '@shared';
import { formatCurrency } from '@shared/utils/format';
import { Card, ProgressBar } from '../ui/card';
import { Button } from '../ui/button';
import { useTheme } from '../../lib/theme-provider';
import { useColors } from '../../lib/use-colors';
import { fetchDolarRates, type DolarRate } from '../../lib/dolarapi';

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

export function FinanceDashboard({ fixedTransactions, onRecordPayment }: FinanceDashboardProps) {
  const t = useTranslations('finance');
  const tCategories = useTranslations('financeCategories');
  const tCreate = useTranslations('createTransaction');
  const colors = useColors();

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [dolarRates, setDolarRates] = useState<{ oficial: DolarRate | null; blue: DolarRate | null }>({
    oficial: null,
    blue: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { start, end } = currentMonthRange();
        const [summaryData, statsData] = await Promise.all([
          financeService.getFinanceSummary(start, end),
          financeService.getMonthlyStats(new Date().getFullYear()),
        ]);
        if (!cancelled) {
          setSummary(summaryData);
          setMonthlyStats(statsData);
        }
      } catch {
        // Dashboard degrades to empty cards.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();

    fetchDolarRates()
      .then(setDolarRates)
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingBills = fixedTransactions.filter((tx) => !tx.currentPeriodPayment);

  const chartData = monthlyStats
    .map((stats, index) => ({
      label: stats.month.slice(0, 3),
      income: stats.totalIncome,
      outcome: -stats.totalOutcome,
      monthIndex: index,
    }))
    .filter((d) => d.monthIndex <= new Date().getMonth())
    .slice(-6)
    .flatMap((d) => [
      { label: d.label, value: d.income, frontColor: colors.success },
      { label: '', value: d.outcome, frontColor: colors.danger },
    ]);

  const renderCategoryBreakdown = (
    items: FinanceSummary['incomeByCategory'],
    isIncome: boolean
  ) => {
    if (items.length === 0) {
      return (
        <Text className="text-sm text-muted dark:text-dark-muted">
          {isIncome ? t('noIncomeCategories') : t('noOutcomeCategories')}
        </Text>
      );
    }
    return (
      <View className="gap-3">
        {items.map((item) => (
          <View key={item.categoryName}>
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="flex-1 text-sm text-foreground dark:text-dark-foreground" numberOfLines={1}>
                {tCategories(item.categoryName)}
              </Text>
              <Text
                className={`shrink-0 ml-2 text-sm font-medium ${
                  isIncome
                    ? 'text-success dark:text-dark-success'
                    : 'text-danger dark:text-dark-danger'
                }`}
              >
                ${formatCurrency(item.total)}
              </Text>
            </View>
            <ProgressBar value={item.percentage} />
          </View>
        ))}
      </View>
    );
  };

  if (isLoading) return null;

  const gridColor = colors.border;
  const axisColor = colors.textMuted;

  return (
    <View className="gap-4">
      <View className="flex-row gap-3">
        <Card className="flex-1">
          <Text className="text-xs text-muted dark:text-dark-muted">{t('totalIncome')}</Text>
          <Text className="text-lg font-bold text-success dark:text-dark-success mt-1">
            ${formatCurrency(summary?.totalIncome ?? 0)}
          </Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-xs text-muted dark:text-dark-muted">{t('totalOutcome')}</Text>
          <Text className="text-lg font-bold text-danger dark:text-dark-danger mt-1">
            ${formatCurrency(summary?.totalOutcome ?? 0)}
          </Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-xs text-muted dark:text-dark-muted">{t('balance')}</Text>
          <Text
            className={`text-lg font-bold mt-1 ${
              (summary?.balance ?? 0) >= 0
                ? 'text-success dark:text-dark-success'
                : 'text-danger dark:text-dark-danger'
            }`}
          >
            ${formatCurrency(summary?.balance ?? 0)}
          </Text>
        </Card>
      </View>

      <View className="flex-row gap-3">
        {(['oficial', 'blue'] as const).map((key) => {
          const rate = dolarRates[key];
          const label = key === 'oficial' ? t('usdOficial') : t('usdBlue');
          return (
            <Card key={key} className="flex-1">
              <Text className="text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                {label}
              </Text>
              {rate ? (
                <>
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted dark:text-dark-muted">{t('buy')}</Text>
                    <Text className="text-xs font-semibold text-foreground dark:text-dark-foreground">
                      ${formatCurrency(rate.compra)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mt-1">
                    <Text className="text-xs text-muted dark:text-dark-muted">{t('sell')}</Text>
                    <Text className="text-xs font-semibold text-foreground dark:text-dark-foreground">
                      ${formatCurrency(rate.venta)}
                    </Text>
                  </View>
                </>
              ) : (
                <Text className="text-xs text-muted dark:text-dark-muted">{t('unavailable')}</Text>
              )}
            </Card>
          );
        })}
      </View>

      <Card title={t('monthlyTrend')}>
        {chartData.length === 0 ? (
          <Text className="text-sm text-muted dark:text-dark-muted py-6 text-center">
            {t('noChartData')}
          </Text>
        ) : (
          <BarChart
            data={chartData}
            barWidth={12}
            spacing={6}
            barBorderRadius={4}
            height={200}
            noOfSections={4}
            rulesColor={gridColor}
            verticalLinesColor={gridColor}
            xAxisColor={gridColor}
            yAxisColor={gridColor}
            yAxisTextStyle={{ color: axisColor, fontSize: 10 }}
            yAxisThickness={0}
            xAxisThickness={0}
            isAnimated={false}
          />
        )}
      </Card>

      <View className="flex-row gap-3">
        <Card title={t('incomeByCategory')} className="flex-1">
          {renderCategoryBreakdown(summary?.incomeByCategory ?? [], true)}
        </Card>
        <Card title={t('outcomeByCategory')} className="flex-1">
          {renderCategoryBreakdown(summary?.outcomeByCategory ?? [], false)}
        </Card>
      </View>

      <Card title={t('upcomingBills')}>
        {upcomingBills.length === 0 ? (
          <Text className="text-sm text-muted dark:text-dark-muted">{t('noUpcomingBills')}</Text>
        ) : (
          <View className="gap-3">
            {upcomingBills.map((tx) => (
              <View
                key={tx.id}
                className="flex-row items-center justify-between gap-3 rounded-lg bg-background dark:bg-dark-background p-3"
              >
                <View className="flex-1 min-w-0">
                  <Text className="font-medium text-foreground dark:text-dark-foreground" numberOfLines={1}>
                    {tCategories(tx.category)}
                  </Text>
                  {tx.description ? (
                    <Text className="text-sm text-muted dark:text-dark-muted" numberOfLines={1}>
                      {tx.description}
                    </Text>
                  ) : null}
                  <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                    {translatePaymentFrequency(tx.paymentFrequency, tCreate)}
                  </Text>
                </View>
                <Button className="shrink-0" onPress={() => onRecordPayment(tx)}>
                  {t('recordPayment')}
                </Button>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}
