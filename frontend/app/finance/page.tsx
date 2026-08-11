'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthGuard } from '@/components/auth-guard';
import { Navigation } from '@/components/navigation';
import type {
  Transaction,
  TransactionType,
  Category,
  FixedTransaction,
  Movement,
} from '@/types';
import { Plus, Filter, X, TrendingUp, TrendingDown } from 'lucide-react';
import { financeService } from '@/services/finance-service';
import { showToast } from '@/lib/toast';
import { CategoryHeader } from '@/components/ui/category/categoryHeader';
import { formatCurrency } from '@/utils/formatNumbers';
import { CreateTransactionModal } from './modal/createTransactionModal';
import { EditTransactionModal } from './modal/editTransactionModal';
import { PaymentModal } from './modal/paymentModal';
import { DeleteModal } from '@/components/ui/card/delete-modal';
import { FixedTransactionCard } from './components/fixedTransactionCard';
import { MovementsFeed } from './components/movementsFeed';
import { FinanceDashboard } from './components/financeDashboard';
import {
  createCategoryOptions,
  MONTHS,
  YEARS,
} from '@/components/ui/filterModal/filterModal';
import { FilterSidebar } from '@/components/ui/filterModal/filterSidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslations } from '@/contexts/language-context';

export interface TransactionFilter
  extends Record<string, string | number | undefined> {
  month?: number;
  year?: number;
  category?: string;
}

type FinanceView = 'movements' | 'dashboard' | 'bills';

const PAGE_SIZE = 30;

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

export default function FinancePage() {
  const t = useTranslations('finance');
  const tCommon = useTranslations('common');

  const [view, setView] = useState<FinanceView>('movements');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [fixedTransactions, setFixedTransactions] = useState<
    FixedTransaction[]
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFixed, setIsLoadingFixed] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [selectedFixedTransaction, setSelectedFixedTransaction] =
    useState<FixedTransaction | null>(null);
  const [deletingMovement, setDeletingMovement] = useState<Movement | null>(
    null
  );
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>({});
  const hasLoadedRef = useRef(false);

  const loadCategories = useCallback(async () => {
    try {
      const allCategories = await financeService.getCategories();
      setCategories(allCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  const loadFirstPage = useCallback(
    async (silent = false) => {
      try {
        // Keep the current list visible during post-mutation refetches once
        // data has loaded. Initial load and filter changes still show loading.
        if (!silent || !hasLoadedRef.current) {
          setIsLoading(true);
        }
        const { data, total: newTotal } = await financeService.getMovements({
          category: activeFilter.category,
          month: activeFilter.month,
          year: activeFilter.year,
          limit: PAGE_SIZE,
          offset: 0,
        });
        hasLoadedRef.current = true;
        setMovements(data);
        setTotal(newTotal);
      } catch (error) {
        console.error('Failed to load movements:', error);
        showToast({
          title: t('loadFailed'),
          description:
            error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [activeFilter, t]
  );

  const loadMore = useCallback(async () => {
    try {
      setIsLoadingMore(true);
      const { data, total: newTotal } = await financeService.getMovements({
        category: activeFilter.category,
        month: activeFilter.month,
        year: activeFilter.year,
        limit: PAGE_SIZE,
        offset: movements.length,
      });
      setMovements((prev) => [...prev, ...data]);
      setTotal(newTotal);
    } catch (error) {
      console.error('Failed to load more movements:', error);
      showToast({
        title: t('loadFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeFilter, movements.length, t]);

  const loadFixedTransactions = useCallback(async () => {
    try {
      setIsLoadingFixed(true);
      const fixed = await financeService.getFixedTransactions();
      setFixedTransactions(fixed);
    } catch (error) {
      console.error('Failed to load fixed transactions:', error);
    } finally {
      setIsLoadingFixed(false);
    }
  }, []);

  const reloadAll = useCallback(
    (silent = false) => {
      loadFirstPage(silent);
      loadFixedTransactions();
    },
    [loadFirstPage, loadFixedTransactions]
  );

  useEffect(() => {
    loadCategories();
    loadFirstPage();
    loadFixedTransactions();
  }, [loadCategories, loadFirstPage, loadFixedTransactions]);

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
    if (activeFilter.category !== undefined) count++;
    return count;
  };

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

  const handleTransactionCreated = (_newTransaction: Transaction) => {
    reloadAll(true);
    setShowCreateModal(false);
  };

  const handleTransactionUpdated = (_updatedTransaction: Transaction) => {
    reloadAll(true);
    setShowEditModal(false);
    setEditingTransaction(null);
  };

  const handleDeleteMovement = (movement: Movement) => {
    setDeletingMovement(movement);
  };

  const handleConfirmDeleteMovement = async () => {
    if (!deletingMovement) return;
    try {
      await financeService.deleteTransaction(deletingMovement.id);
      showToast({
        title: t('transactionDeleted'),
        description: t('transactionDeletedDescription'),
      });
      reloadAll(true);
    } catch (error) {
      showToast({
        title: t('deleteFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleEditMovement = (movement: Movement) => {
    const transactionForEdit: Transaction = {
      id: movement.id,
      userId: 0,
      type: movement.type,
      frequency: 'variable',
      amount: movement.amount,
      category: movement.category,
      description: movement.description,
      date: movement.date,
      createdAt: movement.date,
      updatedAt: movement.date,
    };
    setEditingTransaction(transactionForEdit);
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

  const handlePendingMovementClick = (movement: Movement) => {
    if (!movement.transactionId) return;
    setSelectedFixedTransaction({
      id: movement.transactionId,
      type: movement.type,
      // Unused by the modal — it refetches full details on open.
      paymentFrequency: 'monthly',
      category: movement.category,
      description: movement.description,
      totalPaid: 0,
      createdAt: movement.date,
      updatedAt: movement.date,
    });
    setShowPaymentModal(true);
  };

  const handleAddPayment = (transaction: FixedTransaction) => {
    setSelectedFixedTransaction(transaction);
    setShowPaymentModal(true);
  };

  const handlePaymentCreated = () => {
    reloadAll(true);
  };

  const categoryIcons = useMemo(() => {
    const map: Record<string, string> = {};
    for (const category of categories) {
      if (category.icon) map[category.name] = category.icon;
    }
    return map;
  }, [categories]);

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

  const filterCount = getActiveFilterCount();

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
        <Navigation />
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-1">
                {t('title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('description')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {view === 'movements' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilterSidebar(true)}
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
              )}
              <Button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('addMovement')}
              </Button>
            </div>
          </div>

          <Tabs
            value={view}
            onValueChange={(value) => setView(value as FinanceView)}
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="movements">{t('movements')}</TabsTrigger>
              <TabsTrigger value="dashboard">{t('dashboard')}</TabsTrigger>
              <TabsTrigger value="bills">{t('bills')}</TabsTrigger>
            </TabsList>
          </Tabs>

          {view === 'movements' && filterCount > 0 && (
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

          {view === 'movements' && (
            <MovementsFeed
              movements={movements}
              categoryIcons={categoryIcons}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              hasMore={movements.length < total}
              filterCount={filterCount}
              onShowMore={loadMore}
              onClearFilters={handleClearFilters}
              onAddMovement={() => setShowCreateModal(true)}
              onClickPending={handlePendingMovementClick}
              onEditMovement={handleEditMovement}
              onDeleteMovement={handleDeleteMovement}
            />
          )}

          {view === 'dashboard' && (
            <FinanceDashboard
              fixedTransactions={fixedTransactions}
              onRecordPayment={handleAddPayment}
            />
          )}

          {view === 'bills' &&
            (!isLoadingFixed || fixedTransactions.length > 0) && (
              <div className="space-y-8">
                {(Object.keys(TYPE_CONFIG) as TransactionType[]).map((type) => {
                  const typeTransactions = fixedTransactionsByType[type] || [];
                  const config = TYPE_CONFIG[type];

                  if (typeTransactions.length === 0) return null;

                  const paidCount = typeTransactions.filter(
                    (transaction) => transaction.currentPeriodPayment
                  ).length;
                  const totalThisPeriod = typeTransactions.reduce(
                    (sum, transaction) =>
                      sum + (transaction.currentPeriodPayment?.amount || 0),
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
                        summaryLabel={t('thisPeriod')}
                        itemCount={typeTransactions.length}
                        itemName="transaction"
                        extraInfo={`${paidCount}/${typeTransactions.length} ${t('paid')}`}
                      />

                      <div className="space-y-3">
                        {typeTransactions.map((transaction) => (
                          <FixedTransactionCard
                            key={transaction.id}
                            transaction={transaction}
                            onAddPayment={handleAddPayment}
                            onEdit={handleEditFixedTransaction}
                            onDelete={async (id) => {
                              await financeService.deleteTransaction(id);
                              showToast({
                                title: t('transactionDeleted'),
                                description: t('transactionDeletedDescription'),
                              });
                              reloadAll(true);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {fixedTransactions.length === 0 && (
                  <Card className="text-center py-12 bg-muted/30">
                    <CardContent>
                      <div className="text-muted-foreground">
                        <h3 className="text-lg font-medium text-foreground mb-2">
                          {t('noBillsYet')}
                        </h3>
                        <p>{t('noBillsYetDescription')}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

          <CreateTransactionModal
            open={showCreateModal}
            onOpenChange={setShowCreateModal}
            onTransactionCreated={handleTransactionCreated}
            categories={categories}
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

          <DeleteModal
            open={deletingMovement !== null}
            onOpenChange={(open) => {
              if (!open) setDeletingMovement(null);
            }}
            title={t('deleteTransaction')}
            itemName={deletingMovement?.category ?? ''}
            confirmLabel={t('deleteTransaction')}
            itemDetails={
              <div className="text-sm">
                <div className="font-medium text-foreground mb-1">
                  {deletingMovement?.category}
                </div>
                <div className="text-muted-foreground text-xs">
                  {deletingMovement?.description && (
                    <div className="mb-1">{deletingMovement.description}</div>
                  )}
                  <div>
                    {deletingMovement?.type} • $
                    {formatCurrency(deletingMovement?.amount ?? 0)}
                  </div>
                </div>
              </div>
            }
            onConfirm={handleConfirmDeleteMovement}
          />

          <FilterSidebar
            open={showFilterSidebar}
            onOpenChange={setShowFilterSidebar}
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
              {
                id: 'category',
                label: t('category'),
                type: 'select',
                options: createCategoryOptions(categories),
                placeholder: t('allCategories'),
              },
            ]}
          />
        </div>
      </div>
    </AuthGuard>
  );
}
