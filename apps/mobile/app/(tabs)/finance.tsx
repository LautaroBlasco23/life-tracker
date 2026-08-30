import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Plus, SlidersHorizontal, X } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import type { Category, FixedTransaction, Movement, Transaction, TransactionType } from '@shared/types/finance';
import { financeService, useTranslations } from '@shared';
import { formatCurrency, formatShortDate, getDayKey, getDayLabel } from '@shared/utils/format';
import { SegmentedTabs } from '../../components/ui/segmented-tabs';
import { Button } from '../../components/ui/button';
import { OptionSelect } from '../../components/ui/option-select';
import { TransactionFormModal } from '../../components/finance/transaction-form-modal';
import { PaymentModal } from '../../components/finance/payment-modal';
import { FinanceDashboard } from '../../components/finance/finance-dashboard';
import { useTheme } from '../../lib/theme-provider';
import { cn } from '../../lib/cn';

type FinanceView = 'movements' | 'dashboard' | 'bills';

const PAGE_SIZE = 30;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface FinanceFilter {
  month?: number;
  year?: number;
  category?: string;
}

export default function FinanceScreen() {
  const t = useTranslations('finance');
  const tCategories = useTranslations('financeCategories');
  const tCommon = useTranslations('common');
  const tSocial = useTranslations('social');
  const { theme } = useTheme();

  const [view, setView] = useState<FinanceView>('movements');
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
        Alert.alert(t('loadFailed'));
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
      Alert.alert(t('loadFailed'));
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

  const reloadAll = () => {
    loadMovements(filter);
    loadFixed();
  };

  const handleDeleteMovement = (movement: Movement) => {
    Alert.alert(t('deleteTransaction'), movement.category, [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: tCommon('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await financeService.deleteTransaction(movement.id);
            reloadAll();
          } catch {
            Alert.alert(t('deleteFailed'));
          }
        },
      },
    ]);
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
        onLongPress={() => handleEditMovement(movement)}
        className="mx-4 mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
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

  const spinnerColor = theme === 'dark' ? '#61dafb' : '#0583f2';

  return (
    <View className="flex-1 bg-background dark:bg-dark-background">
      <FlatList
        data={view === 'movements' ? dayGroups : []}
        keyExtractor={(g) => g.key}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View className="p-4 pb-0">
            <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
              {t('title')}
            </Text>
            <Text className="text-sm text-muted dark:text-dark-muted mt-1 mb-4">{t('description')}</Text>
            <SegmentedTabs<FinanceView>
              value={view}
              onChange={setView}
              options={[
                { value: 'movements', label: t('movements') },
                { value: 'dashboard', label: t('dashboard') },
                { value: 'bills', label: t('bills') },
              ]}
            />
            {view === 'movements' ? (
              <View className="flex-row items-center gap-2 mb-3">
                <Button variant="outline" className="h-9" onPress={() => setShowFilterModal(true)}>
                  <View className="flex-row items-center gap-1.5">
                    <SlidersHorizontal size={14} color={spinnerColor} />
                    <Text className="text-sm text-foreground dark:text-dark-foreground">
                      {tCommon('filters')}
                      {filterCount > 0 ? ` (${filterCount})` : ''}
                    </Text>
                  </View>
                </Button>
                {filterCount > 0 ? (
                  <Button variant="ghost" className="h-9" onPress={() => setFilter({})}>
                    <View className="flex-row items-center gap-1">
                      <X size={14} color={spinnerColor} />
                      <Text className="text-sm text-primary dark:text-dark-primary">
                        {tCommon('clearAll')}
                      </Text>
                    </View>
                  </Button>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) =>
          view === 'movements' ? (
            <View>
              <Text className="mx-4 mb-2 mt-2 text-sm font-medium text-muted dark:text-dark-muted">
                {item.label}
              </Text>
              {item.items.map(renderMovement)}
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={spinnerColor} className="mt-10" />
          ) : view === 'movements' ? (
            <View className="items-center mt-10 px-6">
              <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
                {t('noTransactionsYet')}
              </Text>
              <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                {t('getStarted')}
              </Text>
            </View>
          ) : view === 'dashboard' ? (
            <View className="p-4">
              <FinanceDashboard fixedTransactions={fixedTransactions} onRecordPayment={setPaymentFor} />
            </View>
          ) : (
            <View className="p-4">
              {(['income', 'outcome'] as TransactionType[]).map((type) => {
                const list = fixedByType[type] ?? [];
                if (list.length === 0) return null;
                return (
                  <View key={type} className="mb-6">
                    <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-2">
                      {type === 'income' ? t('income') : t('expenses')}
                    </Text>
                    {list.map((tx) => (
                      <Pressable
                        key={tx.id}
                        onPress={() => setPaymentFor(tx)}
                        onLongPress={() => handleEditFixed(tx)}
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
                      </Pressable>
                    ))}
                  </View>
                );
              })}
              {fixedTransactions.length === 0 ? (
                <View className="items-center mt-10">
                  <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
                    {t('noBillsYet')}
                  </Text>
                  <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                    {t('noBillsYetDescription')}
                  </Text>
                </View>
              ) : null}
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
        <Plus size={26} color="#0d1117" />
      </Pressable>

      {/* Filter modal */}
      <Modal visible={showFilterModal} animationType="fade" transparent onRequestClose={() => setShowFilterModal(false)}>
        <View className="flex-1 justify-center bg-black/50 p-6">
          <View className="rounded-2xl bg-background dark:bg-dark-background p-5">
            <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-4">
              {t('filterTransactions')}
            </Text>
            <FilterForm
              categories={categories}
              initial={filter}
              onApply={(f) => {
                setFilter(f);
                setShowFilterModal(false);
              }}
              onCancel={() => setShowFilterModal(false)}
            />
          </View>
        </View>
      </Modal>

      <TransactionFormModal
        visible={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditing(null);
        }}
        onSaved={reloadAll}
        transaction={editing}
        categories={categories}
      />

      <PaymentModal
        visible={paymentFor !== null}
        onClose={() => setPaymentFor(null)}
        onSaved={reloadAll}
        transaction={paymentFor}
      />
    </View>
  );
}

function FilterForm({
  categories,
  initial,
  onApply,
  onCancel,
}: {
  categories: Category[];
  initial: FinanceFilter;
  onApply: (filter: FinanceFilter) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('finance');
  const tCommon = useTranslations('common');
  const [month, setMonth] = useState<number | null>(initial.month ?? null);
  const [year, setYear] = useState<number | null>(initial.year ?? null);
  const [category, setCategory] = useState<string | null>(initial.category ?? null);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 4 + i);

  return (
    <View>
      <OptionSelect
        label={t('month')}
        value={month !== null ? String(month) : null}
        options={MONTHS.map((label, i) => ({ value: String(i + 1), label }))}
        onSelect={(v) => setMonth(Number(v))}
        placeholder={t('allMonths')}
      />
      <View className="h-4" />
      <OptionSelect
        label={t('year')}
        value={year !== null ? String(year) : null}
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
        onSelect={(v) => setYear(Number(v))}
        placeholder={t('allYears')}
      />
      <View className="h-4" />
      <OptionSelect
        label={t('category')}
        value={category}
        options={categories.map((c) => ({ value: c.name, label: c.name }))}
        onSelect={setCategory}
        placeholder={t('allCategories')}
      />
      <View className="flex-row gap-3 mt-5">
        <Button variant="outline" className="flex-1" onPress={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button
          className="flex-1"
          onPress={() =>
            onApply({
              month: month ?? undefined,
              year: year ?? undefined,
              category: category ?? undefined,
            })
          }
        >
          {tCommon('save')}
        </Button>
      </View>
    </View>
  );
}
