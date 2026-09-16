'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import type {
  Transaction,
  FixedTransaction,
} from '@shared/types';
import { Plus } from 'lucide-react';
import { financeService } from '@shared/services/finance-service';
import { CreateTransactionModal } from '../modal/createTransactionModal';
import { PaymentModal } from '../modal/paymentModal';
import { FinanceDashboard } from '../components/financeDashboard';
import { FinanceHeader } from '../components/financeHeader';
import { useFinanceCategories } from '../hooks/use-finance-categories';
import { useTranslations } from '@shared/contexts/language-context';

export default function DashboardPage() {
  const t = useTranslations('finance');
  const categories = useFinanceCategories();

  const [fixedTransactions, setFixedTransactions] = useState<
    FixedTransaction[]
  >([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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

  const handleAddPayment = (transaction: FixedTransaction) => {
    setSelectedFixedTransaction(transaction);
    setShowPaymentModal(true);
  };

  return (
    <>
      <FinanceHeader>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('addMovement')}
        </Button>
      </FinanceHeader>

      <FinanceDashboard
        fixedTransactions={fixedTransactions}
        onRecordPayment={handleAddPayment}
      />

      <CreateTransactionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onTransactionCreated={handleTransactionCreated}
        categories={categories}
      />

      <PaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        transaction={selectedFixedTransaction}
        onPaymentCreated={loadFixedTransactions}
      />
    </>
  );
}
