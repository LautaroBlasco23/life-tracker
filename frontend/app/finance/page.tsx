'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthGuard } from '@/components/auth-guard';
import { Navigation } from '@/components/navigation';
import type {
  Transaction,
  TransactionType,
  TransactionFrequency,
  Category,
  FixedTransaction,
} from '@/types';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  Filter,
  X,
  DollarSign,
} from 'lucide-react';
import { financeService } from '@/services/finance-service';
import { showToast } from '@/lib/toast';
import { CategoryHeader } from '@/components/ui/category/categoryHeader';
import { EntityCard } from '@/components/ui/card/entityCard';
import { formatCurrency } from '@/utils/formatNumbers';
import { Badge } from '@/components/ui/badge';
import { CreateTransactionModal } from './modal/createTransactionModal';
import { EditTransactionModal } from './modal/editTransactionModal';
import { PaymentModal } from './modal/paymentModal';
import { FixedTransactionCard } from './components/fixedTransactionCard';
import {
  createCategoryOptions,
  GenericFilterModal,
  MONTHS,
  YEARS,
} from '@/components/ui/filterModal/filterModal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from '@/contexts/language-context';

export interface TransactionFilter
  extends Record<string, string | number | undefined> {
  month?: number;
  year?: number;
  category?: string;
}

const TYPE_CONFIG = {
  income: {
    label: 'Income',
    icon: TrendingUp,
    description: 'Money coming in',
    accentColor: 'border-green-400',
    iconColor: 'text-green-500',
  },
  outcome: {
    label: 'Expenses',
    icon: TrendingDown,
    description: 'Money going out',
    accentColor: 'border-red-400',
    iconColor: 'text-red-500',
  },
} as const;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface SummaryTotals {
  income: number;
  outcome: number;
}

interface DolarRate {
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

export default function FinancePage() {
  const t = useTranslations('finance');
  const tCommon = useTranslations('common');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fixedTransactions, setFixedTransactions] = useState<
    FixedTransaction[]
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summaryTotals, setSummaryTotals] = useState<SummaryTotals>({
    income: 0,
    outcome: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [selectedFixedTransaction, setSelectedFixedTransaction] =
    useState<FixedTransaction | null>(null);
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>({});
  const [activeFrequency, setActiveFrequency] =
    useState<TransactionFrequency>('variable');
  const [dolarRates, setDolarRates] = useState<{
    oficial: DolarRate | null;
    blue: DolarRate | null;
  }>({ oficial: null, blue: null });
  const [isLoadingDolar, setIsLoadingDolar] = useState(true);

  const loadSummaryTotals = useCallback(async () => {
    try {
      const [variableTransactions, fixed] = await Promise.all([
        financeService.getTransactions({
          frequency: 'variable',
          month: activeFilter.month,
          year: activeFilter.year,
          category: activeFilter.category,
        }),
        financeService.getFixedTransactions({
          month: activeFilter.month,
          year: activeFilter.year,
        }),
      ]);

      const variableTotals = variableTransactions.reduce<SummaryTotals>(
        (acc, t) => {
          if (t.type === 'income') {
            acc.income += t.amount;
          } else {
            acc.outcome += t.amount;
          }
          return acc;
        },
        { income: 0, outcome: 0 }
      );

      const fixedTotals = fixed.reduce<SummaryTotals>(
        (acc, t) => {
          if (t.currentPeriodPayment) {
            if (t.type === 'income') {
              acc.income += t.currentPeriodPayment.amount;
            } else {
              acc.outcome += t.currentPeriodPayment.amount;
            }
          }
          return acc;
        },
        { income: 0, outcome: 0 }
      );

      setSummaryTotals({
        income: variableTotals.income + fixedTotals.income,
        outcome: variableTotals.outcome + fixedTotals.outcome,
      });
    } catch (error) {
      console.error('Failed to load summary totals:', error);
    }
  }, [activeFilter.month, activeFilter.year, activeFilter.categoryId]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [allCategories] = await Promise.all([
        financeService.getCategories(),
      ]);

      setCategories(allCategories);

      if (activeFrequency === 'fixed') {
        const fixed = await financeService.getFixedTransactions({
          month: activeFilter.month,
          year: activeFilter.year,
        });
        setFixedTransactions(fixed);
        setTransactions([]);
      } else {
        const userTransactions = await financeService.getTransactions({
          frequency: 'variable',
          month: activeFilter.month,
          year: activeFilter.year,
          category: activeFilter.category,
        });
        setTransactions(userTransactions);
        setFixedTransactions([]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast({
        title: 'Failed to load data',
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, activeFrequency]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadSummaryTotals();
  }, [loadSummaryTotals]);

  useEffect(() => {
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
        setDolarRates({ oficial, blue });
      } catch (error) {
        console.error('Failed to load dolar rates:', error);
      } finally {
        setIsLoadingDolar(false);
      }
    };
    loadDolarRates();
  }, []);

  const handleApplyFilter = (filter: TransactionFilter) => {
    setActiveFilter(filter);
  };

  const handleClearFilters = () => {
    setActiveFilter({});
  };

  const getActiveFilterCount = (): number => {
    let count = 0;
    if (activeFilter.month !== undefined || activeFilter.year !== undefined)
      count++;
    if (activeFilter.categoryId !== undefined) count++;
    return count;
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      await financeService.deleteTransaction(transactionId);
      setTransactions(
        transactions.filter((transaction) => transaction.id !== transactionId)
      );
      setFixedTransactions(
        fixedTransactions.filter(
          (transaction) => transaction.id !== transactionId
        )
      );
      loadSummaryTotals();
      showToast({
        title: t('transactionDeleted'),
        description: t('transactionDeletedDescription'),
      });
    } catch (error) {
      showToast({
        title: t('deleteFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleTransactionCreated = (_newTransaction: Transaction) => {
    loadData();
    loadSummaryTotals();
    setShowCreateModal(false);
  };

  const handleTransactionUpdated = (_updatedTransaction: Transaction) => {
    loadData();
    loadSummaryTotals();
    setShowEditModal(false);
    setEditingTransaction(null);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowEditModal(true);
  };

  const handleEditFixedTransaction = (fixedTransaction: FixedTransaction) => {
    const transactionForEdit: Transaction = {
      id: fixedTransaction.id,
      userId: 0,
      type: fixedTransaction.type,
      frequency: 'fixed',
      paymentFrequency: fixedTransaction.paymentFrequency,
      amount: 0,
      category: fixedTransaction.category,
      description: fixedTransaction.description,
      date: fixedTransaction.createdAt,
      createdAt: fixedTransaction.createdAt,
      updatedAt: fixedTransaction.updatedAt,
    };
    setEditingTransaction(transactionForEdit);
    setShowEditModal(true);
  };

  const handleAddPayment = (transaction: FixedTransaction) => {
    setSelectedFixedTransaction(transaction);
    setShowPaymentModal(true);
  };

  const handlePaymentCreated = () => {
    loadData();
    loadSummaryTotals();
  };

  const transactionsByType = transactions.reduce(
    (acc, transaction) => {
      const type = transaction.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(transaction);
      return acc;
    },
    {} as Record<TransactionType, Transaction[]>
  );

  const fixedTransactionsByType = fixedTransactions.reduce(
    (acc, transaction) => {
      const type = transaction.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(transaction);
      return acc;
    },
    {} as Record<TransactionType, FixedTransaction[]>
  );

  const balance = summaryTotals.income - summaryTotals.outcome;
  const filterCount = getActiveFilterCount();

  const getFilterBadgeText = (): string | null => {
    if (activeFilter.month !== undefined && activeFilter.year !== undefined) {
      return `${MONTH_NAMES[activeFilter.month - 1]} ${activeFilter.year}`;
    }
    if (activeFilter.month !== undefined) {
      return MONTH_NAMES[activeFilter.month - 1];
    }
    if (activeFilter.year !== undefined) {
      return activeFilter.year.toString();
    }
    return null;
  };

  const isFixedView = activeFrequency === 'fixed';
  const hasData = isFixedView
    ? fixedTransactions.length > 0
    : transactions.length > 0;

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
          <Navigation />
          <div className="flex items-center justify-center h-[calc(100vh-4rem)] lg:h-screen">
            <div className="text-muted-foreground">Loading transactions...</div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
        <Navigation />
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="flex flex-col gap-4 mb-8 md:hidden">
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-1">
                {t('title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('description')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilterModal(true)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                {tCommon('filters')}
                {filterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 w-5 p-0 flex items-center justify-center"
                  >
                    {filterCount}
                  </Badge>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('new')}
              </Button>
            </div>
          </div>

          <div className="hidden md:flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-2">
                {t('title')}
              </h1>
              <p className="text-muted-foreground">{t('description')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowFilterModal(true)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                {tCommon('filters')}
                {filterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 w-5 p-0 flex items-center justify-center"
                  >
                    {filterCount}
                  </Badge>
                )}
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('newTransaction')}
              </Button>
            </div>
          </div>

          <Tabs
            value={activeFrequency}
            onValueChange={(value) =>
              setActiveFrequency(value as TransactionFrequency)
            }
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fixed">{t('fixed')}</TabsTrigger>
              <TabsTrigger value="variable">{t('variable')}</TabsTrigger>
            </TabsList>
          </Tabs>

          {filterCount > 0 && (
            <div className="mb-6 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {tCommon('activeFilters')}
              </span>
              <div className="flex flex-wrap gap-2">
                {getFilterBadgeText() && (
                  <Badge variant="secondary">{getFilterBadgeText()}</Badge>
                )}
                {activeFilter.category !== undefined && (
                  <Badge variant="secondary">{activeFilter.category}</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-6 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  {tCommon('clearAll')}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-surface border-secondary/30 shadow-[inset_0_0_20px_rgba(97,218,251,0.05)]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {t('income')}
                    </p>
                    <p className="text-2xl font-bold text-muted-foreground">
                      ${formatCurrency(summaryTotals.income)}
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
                      {t('expenses')}
                    </p>
                    <p className="text-2xl font-bold text-muted-foreground">
                      ${formatCurrency(summaryTotals.outcome)}
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
                    <p className="text-2xl font-bold text-muted-foreground">
                      ${formatCurrency(balance)}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-secondary/10">
                    <Wallet className="h-6 w-6 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
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
                    {isLoadingDolar ? (
                      <div className="space-y-2">
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-24" />
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-20" />
                      </div>
                    ) : rate ? (
                      <>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">
                            {t('buy')}
                          </span>
                          <span className="font-semibold text-foreground">
                            ${formatCurrency(rate.compra)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mb-3">
                          <span className="text-muted-foreground">
                            {t('sell')}
                          </span>
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

          {!hasData ? (
            <Card className="text-center py-12 bg-muted/30">
              <CardContent>
                <div className="text-muted-foreground mb-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {filterCount > 0
                      ? t('noTransactionsMatch')
                      : t('noTransactionsYet', {
                          type: isFixedView ? t('fixed') : t('variable'),
                        })}
                  </h3>
                  <p>
                    {filterCount > 0
                      ? t('tryAdjusting')
                      : t('getStarted', {
                          type: isFixedView ? t('fixed') : t('variable'),
                        })}
                  </p>
                </div>
                {filterCount > 0 ? (
                  <Button variant="outline" onClick={handleClearFilters}>
                    {tCommon('clearFilters')}
                  </Button>
                ) : (
                  <Button onClick={() => setShowCreateModal(true)}>
                    {t('createFirst')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : isFixedView ? (
            <div className="space-y-8">
              {(Object.keys(TYPE_CONFIG) as TransactionType[]).map((type) => {
                const typeTransactions = fixedTransactionsByType[type] || [];
                const config = TYPE_CONFIG[type];

                if (typeTransactions.length === 0) return null;

                const paidCount = typeTransactions.filter(
                  (t) => t.currentPeriodPayment
                ).length;
                const totalThisPeriod = typeTransactions.reduce(
                  (sum, t) => sum + (t.currentPeriodPayment?.amount || 0),
                  0
                );

                return (
                  <div key={type} className="space-y-4">
                    <CategoryHeader
                      icon={config.icon}
                      label={config.label}
                      description={config.description}
                      accentColor={config.accentColor}
                      iconColor={config.iconColor}
                      summaryValue={`$${formatCurrency(totalThisPeriod)}`}
                      summaryLabel="This Period"
                      itemCount={typeTransactions.length}
                      itemName="transaction"
                      extraInfo={`${paidCount}/${typeTransactions.length} paid`}
                    />

                    <div className="space-y-3">
                      {typeTransactions.map((transaction) => (
                        <FixedTransactionCard
                          key={transaction.id}
                          transaction={transaction}
                          onAddPayment={handleAddPayment}
                          onEdit={handleEditFixedTransaction}
                          onDelete={handleDeleteTransaction}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-8">
              {(Object.keys(TYPE_CONFIG) as TransactionType[]).map((type) => {
                const typeTransactions = transactionsByType[type] || [];
                const config = TYPE_CONFIG[type];

                if (typeTransactions.length === 0) return null;

                const typeTotal = typeTransactions.reduce(
                  (sum, t) => sum + t.amount,
                  0
                );

                return (
                  <div key={type} className="space-y-4">
                    <CategoryHeader
                      icon={config.icon}
                      label={config.label}
                      description={config.description}
                      accentColor={config.accentColor}
                      iconColor={config.iconColor}
                      summaryValue={`$${formatCurrency(typeTotal)}`}
                      summaryLabel={tCommon('total')}
                      itemCount={typeTransactions.length}
                      itemName="transaction"
                    />

                    <div className="space-y-4">
                      {typeTransactions.map((transaction) => {
                        const isIncome = transaction.type === 'income';
                        return (
                          <EntityCard
                            key={transaction.id}
                            title={transaction.category}
                            subtitle={transaction.description}
                            badges={[
                              {
                                label: transaction.type,
                                variant: isIncome ? 'default' : 'destructive',
                              },
                            ]}
                            metadata={
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-4 w-4 shrink-0" />
                                  <span className="truncate">
                                    {formatDate(transaction.date)}
                                  </span>
                                </div>
                                <span
                                  className={`font-semibold text-base sm:text-sm ${
                                    isIncome
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  {isIncome ? '+' : '-'}$
                                  {formatCurrency(transaction.amount)}
                                </span>
                              </div>
                            }
                            onEdit={() => handleEditTransaction(transaction)}
                            onDelete={() =>
                              handleDeleteTransaction(transaction.id)
                            }
                            deleteModal={{
                              title: t('deleteTransaction'),
                              itemName: transaction.category,
                              confirmLabel: t('deleteTransaction'),
                              itemDetails: (
                                <div className="text-sm">
                                  <div className="font-medium text-foreground mb-1">
                                    {transaction.category}
                                  </div>
                                  <div className="text-muted-foreground text-xs">
                                    {transaction.description && (
                                      <div className="mb-1">
                                        {transaction.description}
                                      </div>
                                    )}
                                    <div>
                                      {transaction.type} • $
                                      {formatCurrency(transaction.amount)}
                                    </div>
                                  </div>
                                </div>
                              ),
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <CreateTransactionModal
            open={showCreateModal}
            onOpenChange={setShowCreateModal}
            onTransactionCreated={handleTransactionCreated}
            categories={categories}
            defaultFrequency={activeFrequency}
          />

          <EditTransactionModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            transaction={editingTransaction}
            onTransactionUpdated={handleTransactionUpdated}
            categories={categories}
          />

          <PaymentModal
            open={showPaymentModal}
            onOpenChange={setShowPaymentModal}
            transaction={selectedFixedTransaction}
            onPaymentCreated={handlePaymentCreated}
          />

          <GenericFilterModal
            open={showFilterModal}
            onOpenChange={setShowFilterModal}
            currentFilter={activeFilter}
            onApplyFilter={handleApplyFilter}
            title={t('filterTransactions')}
            fields={[
              {
                id: 'month',
                label: t('month'),
                type: 'select',
                options: MONTHS,
                placeholder: t('allMonths'),
              },
              {
                id: 'year',
                label: t('year'),
                type: 'select',
                options: YEARS.map((y) => ({ value: y, label: String(y) })),
                placeholder: t('allYears'),
              },
              ...(activeFrequency === 'variable'
                ? [
                    {
                      id: 'categoryId',
                      label: t('category'),
                      type: 'select' as const,
                      options: createCategoryOptions(categories),
                      placeholder: t('allCategories'),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>
    </AuthGuard>
  );
}
