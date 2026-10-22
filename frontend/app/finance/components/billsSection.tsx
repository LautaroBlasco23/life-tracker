'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type {
  Category,
  FixedTransaction,
  Transaction,
  TransactionType,
} from '@shared/types';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { financeService } from '@shared/services/finance-service';
import { showToast } from '@/lib/toast';
import { CategoryHeader } from '@/components/ui/category/categoryHeader';
import { formatCurrency } from '@shared/utils/format';
import { CreateTransactionModal } from '../modal/createTransactionModal';
import { EditTransactionModal } from '../modal/editTransactionModal';
import { PaymentModal } from '../modal/paymentModal';
import { FixedTransactionCard } from './fixedTransactionCard';
import { useTranslations } from '@shared/contexts/language-context';

const TYPE_CONFIG = {
  income: {
    label: 'Income',
    icon: TrendingUp,
    description: 'Money coming in',
    accentColor: 'border-success',
    iconColor: 'text-success',
  },
  outcome: {
    label: 'Expenses',
    icon: TrendingDown,
    description: 'Money going out',
    accentColor: 'border-red-400',
    iconColor: 'text-danger',
  },
} as const;

export function BillsSection({ categories }: { categories: Category[] }) {
  const t = useTranslations('finance');

  const [fixedTransactions, setFixedTransactions] = useState<
    FixedTransaction[]
  >([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [selectedFixedTransaction, setSelectedFixedTransaction] =
    useState<FixedTransaction | null>(null);

  const loadFixedTransactions = useCallback(async () => {
    try {
      const fixed = await financeService.getFixedTransactions();
      setFixedTransactions(fixed);
    } catch (error) {
      console.error('Failed to load fixed transactions:', error);
    }
  }, []);

  useEffect(() => {
    loadFixedTransactions();
  }, [loadFixedTransactions]);

  const handleTransactionCreated = (_newTransaction: Transaction) => {
    loadFixedTransactions();
    setShowCreateModal(false);
  };

  const handleTransactionUpdated = (_updatedTransaction: Transaction) => {
    loadFixedTransactions();
    setShowEditModal(false);
    setEditingTransaction(null);
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

  const handleDeleteFixedTransaction = async (id: string) => {
    await financeService.deleteTransaction(id);
    showToast({
      title: t('transactionDeleted'),
      description: t('transactionDeletedDescription'),
    });
    loadFixedTransactions();
  };

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

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t('bills')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('billsSubtitle')}</p>
        </div>
      </div>

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
                    onDelete={handleDeleteFixedTransaction}
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
        onPaymentCreated={loadFixedTransactions}
      />
    </section>
  );
}
