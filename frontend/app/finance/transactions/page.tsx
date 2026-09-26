'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type {
  Transaction,
  FixedTransaction,
  Movement,
} from '@shared/types';
import { Plus, Filter, X } from 'lucide-react';
import { financeService } from '@shared/services/finance-service';
import { showToast } from '@/lib/toast';
import { formatCurrency } from '@shared/utils/format';
import { CreateTransactionModal } from '../modal/createTransactionModal';
import { EditTransactionModal } from '../modal/editTransactionModal';
import { PaymentModal } from '../modal/paymentModal';
import { DeleteModal } from '@/components/ui/card/delete-modal';
import { MovementsFeed } from '../components/movementsFeed';
import { BillsSection } from '../components/billsSection';
import { FinanceHeader } from '../components/financeHeader';
import { useFinanceCategories } from '../hooks/use-finance-categories';
import {
  createCategoryOptions,
  MONTHS,
  YEARS,
} from '@/components/ui/filterModal/filterModal';
import { FilterSidebar } from '@/components/ui/filterModal/filterSidebar';
import { useTranslations } from '@shared/contexts/language-context';

export interface TransactionFilter
  extends Record<string, string | number | undefined> {
  month?: number;
  year?: number;
  category?: string;
}

const PAGE_SIZE = 30;

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

export default function TransactionsPage() {
  const t = useTranslations('finance');
  const tCommon = useTranslations('common');
  const categories = useFinanceCategories();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

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
    loadFirstPage(true);
    setShowCreateModal(false);
  };

  const handleTransactionUpdated = (_updatedTransaction: Transaction) => {
    loadFirstPage(true);
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
      loadFirstPage(true);
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

  const filterCount = getActiveFilterCount();

  const categoryIcons = useMemo(() => {
    const map: Record<string, string> = {};
    for (const category of categories) {
      if (category.icon) map[category.name] = category.icon;
    }
    return map;
  }, [categories]);

  return (
    <>
      <FinanceHeader>
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
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('addMovement')}
        </Button>
      </FinanceHeader>

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

      <BillsSection categories={categories} />

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
        onPaymentCreated={() => loadFirstPage(true)}
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
    </>
  );
}
