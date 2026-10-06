'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FixedTransaction } from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { PaymentModal } from '../modal/paymentModal';
import { FinanceDashboard } from '../components/financeDashboard';

interface DashboardViewProps {
  refreshKey: number;
}

export function DashboardView({ refreshKey }: DashboardViewProps) {
  const [fixedTransactions, setFixedTransactions] = useState<
    FixedTransaction[]
  >([]);
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

  // Refetch when a page-level action (e.g. creating a transaction) invalidates
  // the fixed transactions list.
  const lastRefreshRef = useRef(refreshKey);
  useEffect(() => {
    if (lastRefreshRef.current === refreshKey) return;
    lastRefreshRef.current = refreshKey;
    loadFixedTransactions();
  }, [refreshKey, loadFixedTransactions]);

  const handleAddPayment = (transaction: FixedTransaction) => {
    setSelectedFixedTransaction(transaction);
    setShowPaymentModal(true);
  };

  return (
    <>
      <FinanceDashboard
        fixedTransactions={fixedTransactions}
        onRecordPayment={handleAddPayment}
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
