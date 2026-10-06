import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { AlertTriangle, Plus, SlidersHorizontal, X, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import type {
  Category,
  FixedTransaction,
  Movement,
  Transaction,
  TransactionType,
} from '@shared/types/finance';
import { financeService, useTranslations, themeColors } from '@shared';
import { formatCurrency, formatShortDate, getDayKey, getDayLabel } from '@shared/utils/format';
import { Navigation } from '../../../components/navigation';
import { Button } from '../../../components/ui/button';
import { DeleteModal } from '../../../components/ui/delete-modal';
import { FilterModal, getActiveFilterCount } from '../../../components/ui/filter-modal';
import { TransactionFormModal } from '../../../components/finance/transaction-form-modal';
import { PaymentModal } from '../../../components/finance/payment-modal';
import { showToast } from '../../../components/ui/toast';
import { useMonthYearOptions } from '../../../lib/filter-options';
import { useTheme } from '../../../lib/theme-provider';
import { cn } from '../../../lib/cn';

const PAGE_SIZE = 30;

interface FinanceFilter {
  month?: number;
  year?: number;
  category?: string;
}

const TYPE_CONFIG: Record<
  TransactionType,
  { accentKey: 'success' | 'danger'; labelKey: 'income' | 'expenses' }
> = {
  income: { accentKey: 'success', labelKey: 'income' },
  outcome: { accentKey: 'danger', labelKey: 'expenses' },
};

/** /finance/transactions — movements feed + bills (web parity). */
export default function TransactionsScreen() {
  const t = useTranslations('finance');
  const tCategories = useTranslations('financeCategories');
  const tSocial = useTranslations('social');
  const tCommon = useTranslations('common');
  const { theme } = useTheme();
  const colors = themeColors[theme];
  const { monthOptions, yearOptions } = useMonthYearOptions();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [fixedTransactions, setFixedTransactions] = useState<FixedTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FinanceFilter>({});
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [paymentFor, setPaymentFor] = useState<FixedTransaction | null>(null);
  const [deletingMovement, setDeletingMovement] = useState<Movement | null>(null);
  const [deletingFixed, setDeletingFixed] = useState<FixedTransaction | null>(null);

  const loadMovements = useCallback(
    async (currentFilter: FinanceFilter, offset = 0, append = false) => {
      try {
        const { data, total: newTotal } = await financeService.getMovements({
          category: currentFilter.category,
          month: currentFilter.month,
          year: currentFilter.year,
          limit: PAGE_SIZE,
          offset,
        });
        setMovements((prev) => (append ? [...prev, ...data] : data));
        setTotal(newTotal);
      } catch {
        showToast({ title: t('loadFailed'), variant: 'destructive' });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [t]
  );

  const loadFixed = useCallback(async () => {
    try {
      setFixedTransactions(await financeService.getFixedTransactions());
    } catch {
      showToast({ title: t('loadFailed'), variant: 'destructive' });
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadMovements(filter);
      loadFixed();
      financeService
        .getCategories()
        .then(setCategories)
        .catch(() => undefined);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter])
  );

  const loadMore = () => {
    if (isLoadingMore || movements.length >= total) return;
    setIsLoadingMore(true);
    loadMovements(filter, movements.length, true);
  };

  const handleDeleteMovement = async () => {
    if (!deletingMovement) return;
    const movement = deletingMovement;
    const snapshot = movements;
    // Optimistic local removal, reverted on failure (web refetches; the mobile
    // feed keeps its state local — task-mandated behavior).
    setMovements((prev) => prev.filter((m) => m.id !== movement.id));
    try {
      await financeService.deleteTransaction(movement.id);
      setTotal((prev) => Math.max(0, prev - 1));
      showToast({
        title: t('transactionDeleted'),
        description: t('transactionDeletedDescription'),
      });
    } catch (error) {
      setMovements(snapshot);
      showToast({
        title: t('deleteFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('delete failed');
    }
  };

  const handleDeleteFixed = async () => {
    if (!deletingFixed) return;
    const fixed = deletingFixed;
    const snapshot = fixedTransactions;
    // Optimistic local removal, reverted on failure.
    setFixedTransactions((prev) => prev.filter((f) => f.id !== fixed.id));
    try {
      await financeService.deleteTransaction(fixed.id);
      showToast({
        title: t('transactionDeleted'),
        description: t('transactionDeletedDescription'),
      });
    } catch (error) {
      setFixedTransactions(snapshot);
      showToast({
        title: t('deleteFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('delete failed');
    }
  };

  const handleEditMovement = (movement: Movement) => {
    setEditing({
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
    });
    setShowFormModal(true);
  };

  const handleMenuLongPress = (movement: Movement) => {
    Alert.alert(tCategories(movement.category), undefined, [
      { text: tCommon('edit'), onPress: () => handleEditMovement(movement) },
      { text: t('deleteTransaction'), style: 'destructive', onPress: () => setDeletingMovement(movement) },
      { text: tCommon('cancel'), style: 'cancel' },
    ]);
  };

  const handleFixedLongPress = (fixed: FixedTransaction) => {
    Alert.alert(tCategories(fixed.category), undefined, [
      { text: tCommon('edit'), onPress: () => handleEditFixed(fixed) },
      { text: t('deleteTransaction'), style: 'destructive', onPress: () => setDeletingFixed(fixed) },
      { text: tCommon('cancel'), style: 'cancel' },
    ]);
  };

  const handleEditFixed = (fixed: FixedTransaction) => {
    setEditing({
      id: fixed.id,
      userId: 0,
      type: fixed.type,
      frequency: 'fixed',
      paymentFrequency: fixed.paymentFrequency,
      amount: 0,
      category: fixed.category,
      description: fixed.description,
      date: fixed.createdAt,
      createdAt: fixed.createdAt,
      updatedAt: fixed.updatedAt,
    });
    setShowFormModal(true);
  };

  const handlePendingMovement = (movement: Movement) => {
    if (!movement.transactionId) return;
    setPaymentFor({
      id: movement.transactionId,
      type: movement.type,
      paymentFrequency: 'monthly',
      category: movement.category,
      description: movement.description,
      totalPaid: 0,
      createdAt: movement.date,
      updatedAt: movement.date,
    });
  };

  const handleApplyFilter = (draft: Record<string, string | undefined>) => {
    setFilter({
      month: draft.month !== undefined ? Number(draft.month) : undefined,
      year: draft.year !== undefined ? Number(draft.year) : undefined,
      category: draft.category,
    });
  };

  const filterCount = [filter.month, filter.year, filter.category].filter((v) => v !== undefined).length;

  // Group movements by day for section headers.
  const dayGroups: { key: string; label: string; items: Movement[] }[] = [];
  for (const movement of movements) {
    const key = getDayKey(new Date(movement.date));
    const group = dayGroups.find((g) => g.key === key);
    if (group) group.items.push(movement);
    else dayGroups.push({ key, label: getDayLabel(new Date(movement.date), t), items: [movement] });
  }

  const fixedByType = fixedTransactions.reduce(
    (acc, tx) => {
      (acc[tx.type] ||= []).push(tx);
      return acc;
    },
    {} as Record<TransactionType, FixedTransaction[]>
  );

  const renderMovement = (movement: Movement) => {
    const isIncome = movement.type === 'income';
    const isPending = !movement.paid && movement.sourceType === 'fixed';
    return (
      <Pressable
        onPress={isPending ? () => handlePendingMovement(movement) : undefined}
        onLongPress={() => handleMenuLongPress(movement)}
        className="rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
              {tCategories(movement.category)}
            </Text>
            {movement.description ? (
              <Text className="text-sm text-muted dark:text-dark-muted mt-0.5" numberOfLines={1}>
                {movement.description}
              </Text>
            ) : null}
            <Text className="text-xs text-muted dark:text-dark-muted mt-1">
              {formatShortDate(new Date(movement.date))}
              {isPending ? ` · ${tSocial('pending')}` : ''}
            </Text>
          </View>
          <Text
            className={cn(
              'text-base font-semibold',
              isIncome ? 'text-success dark:text-dark-success' : 'text-danger dark:text-dark-danger'
            )}
          >
            {isIncome ? '+' : '−'}${formatCurrency(movement.amount)}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderBills = () => (
    <View className="p-4">
      <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-1">
        {t('bills')}
      </Text>
      <Text className="text-sm text-muted dark:text-dark-muted mb-3">
        {t('billsSubtitle')}
      </Text>
      {(['income', 'outcome'] as TransactionType[]).map((type) => {
        const list = fixedByType[type] ?? [];
        if (list.length === 0) return null;
        const config = TYPE_CONFIG[type];
        const accentColor = colors[config.accentKey];
        const Icon = type === 'income' ? TrendingUp : TrendingDown;
        const paidCount = list.filter((tx) => tx.currentPeriodPayment).length;
        const totalThisPeriod = list.reduce(
          (sum, tx) => sum + (tx.currentPeriodPayment?.amount ?? 0),
          0
        );
        return (
          <View key={type} className="mb-6">
            <View
              className="flex-row items-center gap-4 py-3 pl-4 mb-1"
              style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
            >
              <Icon size={22} color={accentColor} />
              <View className="flex-1">
                <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground">
                  {t(config.labelKey)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-lg font-bold" style={{ color: accentColor }}>
                  ${formatCurrency(totalThisPeriod)}
                </Text>
                <Text className="text-sm text-muted dark:text-dark-muted">
                  {list.length} · {paidCount}/{list.length} {t('paid')}
                </Text>
              </View>
            </View>
            {list.map((tx) => (
              <Pressable
                key={tx.id}
                onPress={() => setPaymentFor(tx)}
                onLongPress={() => handleFixedLongPress(tx)}
                className="mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
                      {tCategories(tx.category)}
                    </Text>
                    {tx.description ? (
                      <Text className="text-sm text-muted dark:text-dark-muted mt-0.5" numberOfLines={1}>
                        {tx.description}
                      </Text>
                    ) : null}
                    <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                      {t('thisPeriod')}: ${formatCurrency(tx.currentPeriodPayment?.amount ?? 0)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <AlertTriangle
                      size={14}
                      color={tx.currentPeriodPayment ? colors.success : colors.warning}
                    />
                    <Text
                      className={cn(
                        'text-sm font-medium',
                        tx.currentPeriodPayment
                          ? 'text-success dark:text-dark-success'
                          : 'text-warning dark:text-dark-warning'
                      )}
                    >
                      {tx.currentPeriodPayment ? t('paid') : tSocial('pending')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        );
      })}
      {fixedTransactions.length === 0 ? (
        <View className="items-center mt-6">
          <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
            {t('noBillsYet')}
          </Text>
          <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
            {t('noBillsYetDescription')}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 relative bg-background dark:bg-dark-background">
      <Navigation />
      <FlatList
        data={dayGroups}
        keyExtractor={(g) => g.key}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View className="p-4 pb-0">
            <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
              {t('movements')}
            </Text>
            <Text className="text-sm text-muted dark:text-dark-muted mt-1 mb-4">{t('description')}</Text>
            <View className="flex-row items-center gap-2 mb-3">
              <Button variant="outline" className="h-9" onPress={() => setShowFilterModal(true)}>
                <View className="flex-row items-center gap-1.5">
                  <SlidersHorizontal size={14} color={colors.primary} />
                  <Text className="text-sm text-foreground dark:text-dark-foreground">
                    {tCommon('filters')}
                    {filterCount > 0 ? ` (${filterCount})` : ''}
                  </Text>
                </View>
              </Button>
              {filterCount > 0 ? (
                <Button variant="ghost" className="h-9" onPress={() => setFilter({})}>
                  <View className="flex-row items-center gap-1">
                    <X size={14} color={colors.primary} />
                    <Text className="text-sm text-primary dark:text-dark-primary">
                      {tCommon('clearAll')}
                    </Text>
                  </View>
                </Button>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View>
            <Text className="mx-4 mb-2 mt-2 text-sm font-medium text-muted dark:text-dark-muted">
              {item.label}
            </Text>
            <View className="mx-4 gap-2">
              {item.items.map(renderMovement)}
            </View>
          </View>
        )}
        ListFooterComponent={renderBills()}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={colors.primary} className="mt-10" />
          ) : (
            <View className="items-center mt-10 px-6">
              <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
                {filterCount > 0 ? t('noTransactionsMatch') : t('noMovementsYet')}
              </Text>
              <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                {filterCount > 0 ? t('tryAdjusting') : t('movementsGetStarted')}
              </Text>
            </View>
          )
        }
        contentContainerClassName="pb-24"
      />

      {/* FAB */}
      <Pressable
        onPress={() => {
          setEditing(null);
          setShowFormModal(true);
        }}
        className="absolute bottom-6 right-5 h-14 w-14 rounded-full bg-primary dark:bg-dark-primary items-center justify-center shadow-lg"
      >
        <Plus size={26} color={colors.primaryForeground} />
      </Pressable>

      <TransactionFormModal
        visible={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditing(null);
        }}
        onSaved={() => {
          loadMovements(filter);
          loadFixed();
        }}
        transaction={editing}
        categories={categories}
      />

      <PaymentModal
        visible={paymentFor !== null}
        onClose={() => setPaymentFor(null)}
        onSaved={() => {
          loadMovements(filter);
          loadFixed();
        }}
        transaction={paymentFor}
      />

      <DeleteModal
        visible={deletingMovement !== null}
        onClose={() => setDeletingMovement(null)}
        title={t('deleteTransaction')}
        itemName={deletingMovement?.category ?? ''}
        confirmLabel={t('deleteTransaction')}
        itemDetails={
          deletingMovement ? (
            <View>
              <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                {tCategories(deletingMovement.category)}
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted">
                {deletingMovement.description
                  ? `${deletingMovement.description}\n`
                  : ''}
                {deletingMovement.type} · ${formatCurrency(deletingMovement.amount)}
              </Text>
            </View>
          ) : null
        }
        onConfirm={handleDeleteMovement}
      />

      <DeleteModal
        visible={deletingFixed !== null}
        onClose={() => setDeletingFixed(null)}
        title={t('deleteTransaction')}
        itemName={deletingFixed?.category ?? ''}
        confirmLabel={t('deleteTransaction')}
        itemDetails={
          deletingFixed ? (
            <View>
              <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                {tCategories(deletingFixed.category)}
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted">
                {deletingFixed.description ? `${deletingFixed.description}\n` : ''}
                {deletingFixed.paymentFrequency}
              </Text>
            </View>
          ) : null
        }
        onConfirm={handleDeleteFixed}
      />

      <FilterModal
        visible={showFilterModal}
        title={t('filterTransactions')}
        currentFilter={{
          month: filter.month !== undefined ? String(filter.month) : undefined,
          year: filter.year !== undefined ? String(filter.year) : undefined,
          category: filter.category,
        }}
        onApplyFilter={handleApplyFilter}
        onClose={() => setShowFilterModal(false)}
        fields={[
          {
            id: 'month',
            label: t('month'),
            type: 'select',
            options: monthOptions,
            placeholder: t('allMonths'),
          },
          {
            id: 'year',
            label: t('year'),
            type: 'select',
            options: yearOptions,
            placeholder: t('allYears'),
          },
          {
            id: 'category',
            label: t('category'),
            type: 'select',
            options: categories.map((c) => ({ value: c.name, label: c.name })),
            placeholder: t('allCategories'),
          },
        ]}
      />
    </View>
  );
}
