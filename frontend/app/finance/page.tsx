'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { CreateTransactionModal } from './modal/createTransactionModal';
import { FinanceHeader } from './components/financeHeader';
import { TransactionsView } from './views/transactionsView';
import { DashboardView } from './views/dashboardView';
import { useFinanceCategories } from './hooks/use-finance-categories';
import { useTranslations } from '@shared/contexts/language-context';

type FinanceView = 'transactions' | 'dashboard';

export default function FinancePage() {
  const t = useTranslations('finance');
  const categories = useFinanceCategories();

  const [view, setView] = useState<FinanceView>('transactions');
  // Views mount lazily the first time they are visited and stay mounted
  // (hidden) afterwards, so list state and loaded data survive tab switches.
  const [visited, setVisited] = useState<Record<FinanceView, boolean>>({
    transactions: true,
    dashboard: false,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleViewChange = (next: string) => {
    const nextView = next as FinanceView;
    setView(nextView);
    setVisited((prev) =>
      prev[nextView] ? prev : { ...prev, [nextView]: true }
    );
  };

  const refreshViews = () => setRefreshKey((key) => key + 1);

  return (
    <>
      <FinanceHeader>
        <Tabs value={view} onValueChange={handleViewChange}>
          <TabsList>
            <TabsTrigger value="transactions">{t('movements')}</TabsTrigger>
            <TabsTrigger value="dashboard">{t('dashboard')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('addMovement')}
        </Button>
      </FinanceHeader>

      {visited.transactions && (
        <div className={view === 'transactions' ? undefined : 'hidden'}>
          <TransactionsView
            categories={categories}
            refreshKey={refreshKey}
            onOpenCreate={() => setShowCreateModal(true)}
          />
        </div>
      )}

      {visited.dashboard && (
        <div className={view === 'dashboard' ? undefined : 'hidden'}>
          <DashboardView refreshKey={refreshKey} />
        </div>
      )}

      <CreateTransactionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onTransactionCreated={() => {
          setShowCreateModal(false);
          refreshViews();
        }}
        categories={categories}
      />
    </>
  );
}
