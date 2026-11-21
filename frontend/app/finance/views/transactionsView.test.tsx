import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Movement } from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { showToast } from '@/lib/toast';
import { TransactionsView } from './transactionsView';

vi.mock('@shared/services/finance-service', () => ({
  financeService: {
    getMovements: vi.fn(),
    deleteTransaction: vi.fn(),
    getFixedTransactions: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// Covered by their own suites; stubbed to observe how this view drives them.
vi.mock('../modal/editTransactionModal', () => ({
  EditTransactionModal: (props: { open: boolean; transaction: unknown }) =>
    props.open ? (
      <div data-testid="edit-modal">{JSON.stringify(props.transaction)}</div>
    ) : null,
}));
vi.mock('../modal/paymentModal', () => ({
  PaymentModal: (props: { open: boolean; transaction: unknown }) =>
    props.open ? (
      <div data-testid="payment-modal">{JSON.stringify(props.transaction)}</div>
    ) : null,
}));

// Mocking the shared context keeps this test on the component's own logic and
// avoids a second React copy (the workspace root installs React for mobile).
// The translator must be referentially stable per namespace: loadFirstPage
// depends on `t`, and a fresh function each render would loop the load effect.
vi.mock('@shared/contexts/language-context', () => {
  const finance: Record<string, string> = {
    loadFailed: 'Failed to load data',
    deleteTransaction: 'Delete transaction',
    transactionDeleted: 'Transaction deleted',
    transactionDeletedDescription: 'Removed',
    deleteFailed: 'Delete failed',
    filterTransactions: 'Filter transactions',
    month: 'Month',
    allMonths: 'All months',
    year: 'Year',
    allYears: 'All years',
    category: 'Category',
    allCategories: 'All categories',
    showMore: 'Show more',
    addMovement: 'Add transaction',
    noMovementsYet: 'No transactions yet',
    noMovementsMatch: 'No transactions match your filters',
    tryAdjusting: 'Try adjusting your filters',
    movementsGetStarted: 'Add your first transaction',
    today: 'Today',
    yesterday: 'Yesterday',
  };
  const filterModal: Record<string, string> = {
    filter: 'Filter',
    reset: 'Reset',
    applyFilters: 'Apply Filters',
  };
  const common: Record<string, string> = {
    filters: 'Filters',
    activeFilters: 'Active filters:',
    clearAll: 'Clear all',
    close: 'Close',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    error: 'Error',
    loading: 'Loading...',
    saving: 'Saving...',
    updating: 'Updating...',
    creating: 'Creating...',
    deleting: 'Deleting...',
  };
  const dictionaries: Record<string, Record<string, string>> = {
    finance,
    filterModal,
    common,
  };
  const cache = new Map<string, (key: string) => string>();
  return {
    useTranslations: (namespace: string) => {
      if (!cache.has(namespace)) {
        const dictionary = dictionaries[namespace] ?? {};
        cache.set(namespace, (key: string) => dictionary[key] ?? key);
      }
      return cache.get(namespace)!;
    },
  };
});

const mockFinanceService = vi.mocked(financeService);

const DAY = new Date(2026, 0, 15, 12, 30).toISOString();

const movements: Movement[] = [
  {
    id: 'm1',
    sourceType: 'transaction',
    type: 'outcome',
    amount: 100,
    category: 'Food & Groceries',
    description: 'Dinner',
    date: DAY,
    paid: true,
  },
  {
    id: 'm2',
    sourceType: 'payment',
    type: 'outcome',
    amount: 50,
    category: 'Transportation',
    date: DAY,
    paid: true,
  },
  {
    id: 'm3',
    sourceType: 'fixed',
    type: 'outcome',
    amount: 75,
    category: 'Housing & Utilities',
    date: DAY,
    paid: false,
    transactionId: 'fixed-1',
  },
];

const categories: Category[] = [
  { name: 'Food & Groceries', type: 'outcome' },
  { name: 'Transportation', type: 'outcome' },
];

function renderView(
  props: Partial<Parameters<typeof TransactionsView>[0]> = {}
) {
  return render(
    <TransactionsView
      categories={categories}
      refreshKey={0}
      onOpenCreate={vi.fn()}
      {...props}
    />
  );
}

describe('TransactionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinanceService.getMovements.mockResolvedValue({
      data: movements,
      total: movements.length,
    });
    mockFinanceService.getFixedTransactions.mockResolvedValue([]);
  });

  it('loads the first page of movements on mount', async () => {
    renderView();

    await waitFor(() =>
      expect(mockFinanceService.getMovements).toHaveBeenCalledWith({
        category: undefined,
        month: undefined,
        year: undefined,
        limit: 30,
        offset: 0,
      })
    );
    expect(await screen.findByText('Food & Groceries')).toBeInTheDocument();
  });

  it('shows a destructive toast when the first page fails to load', async () => {
    mockFinanceService.getMovements.mockRejectedValue(new Error('boom'));

    renderView();

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to load data',
          description: 'boom',
          variant: 'destructive',
        })
      )
    );
  });

  it('refetches silently when refreshKey increases, keeping the list visible', async () => {
    const { rerender } = renderView({ refreshKey: 0 });
    await screen.findByText('Food & Groceries');
    expect(mockFinanceService.getMovements).toHaveBeenCalledTimes(1);

    rerender(
      <TransactionsView
        categories={categories}
        refreshKey={1}
        onOpenCreate={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(mockFinanceService.getMovements).toHaveBeenCalledTimes(2)
    );
    // Silent refetch: no blank loading state in between.
    expect(screen.getByText('Food & Groceries')).toBeInTheDocument();
  });

  it('appends the next page when Show more is used', async () => {
    mockFinanceService.getMovements
      .mockResolvedValueOnce({ data: movements, total: 4 })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'm4',
            sourceType: 'transaction',
            type: 'income',
            amount: 10,
            category: 'Transportation',
            date: DAY,
            paid: true,
          },
        ],
        total: 4,
      });

    const user = userEvent.setup();
    renderView();
    await screen.findByText('Food & Groceries');

    await user.click(screen.getByRole('button', { name: /Show more/ }));

    await waitFor(() => {
      expect(mockFinanceService.getMovements).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 30, offset: 3 })
      );
      expect(screen.getByText('+$10')).toBeInTheDocument();
    });
  });

  it('deletes a movement after confirmation and refetches silently', async () => {
    mockFinanceService.deleteTransaction.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Food & Groceries');

    // Open the row dropdown of the first (editable) movement.
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Delete transaction' })
    );

    await waitFor(() =>
      expect(mockFinanceService.deleteTransaction).toHaveBeenCalledWith('m1')
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Transaction deleted' })
    );
    expect(mockFinanceService.getMovements).toHaveBeenCalledTimes(2);
  });

  it('shows a failure toast when the delete fails', async () => {
    mockFinanceService.deleteTransaction.mockRejectedValue(new Error('locked'));
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Food & Groceries');

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Delete transaction' })
    );

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete failed',
          description: 'locked',
          variant: 'destructive',
        })
      )
    );
  });

  it('opens the edit modal with the movement mapped to a transaction', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Food & Groceries');

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));

    const editModal = await screen.findByTestId('edit-modal');
    const payload = JSON.parse(editModal.textContent!);
    expect(payload).toMatchObject({
      id: 'm1',
      type: 'outcome',
      frequency: 'variable',
      amount: 100,
      category: 'Food & Groceries',
    });
  });

  it('opens the payment modal for a pending fixed movement', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Housing & Utilities');

    await user.click(screen.getByText('Housing & Utilities'));

    expect(await screen.findByTestId('payment-modal')).toHaveTextContent(
      '"id":"fixed-1"'
    );
  });

  it('ignores pending clicks on movements without a transaction id', async () => {
    mockFinanceService.getMovements.mockResolvedValue({
      data: [
        {
          id: 'm2',
          sourceType: 'transaction',
          type: 'outcome',
          amount: 50,
          category: 'Transportation',
          date: DAY,
          paid: false,
        },
      ],
      total: 1,
    });
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Transportation');

    await user.click(screen.getByText('Transportation'));

    expect(screen.queryByTestId('payment-modal')).not.toBeInTheDocument();
  });

  it('filters by month and shows the active filter badges', async () => {
    mockFinanceService.getMovements.mockResolvedValue({
      data: movements,
      total: movements.length,
    });
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Food & Groceries');

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(await screen.findByRole('combobox', { name: 'Month' }));
    await user.click(await screen.findByRole('option', { name: 'January' }));
    await user.click(screen.getByRole('button', { name: 'Apply Filters' }));

    await waitFor(() =>
      expect(mockFinanceService.getMovements).toHaveBeenLastCalledWith(
        expect.objectContaining({ month: 1, year: undefined })
      )
    );
    // Two month badges render (count area + badge); the day header reads
    // "January 15" and must not match an exact-text query.
    expect(screen.getAllByText('January').length).toBeGreaterThan(0);
    expect(screen.getByText('Active filters:')).toBeInTheDocument();
  });

  it('filters by category and clears everything from the badges', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Food & Groceries');

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(await screen.findByRole('combobox', { name: 'Category' }));
    await user.click(
      await screen.findByRole('option', { name: 'Food & Groceries' })
    );
    await user.click(screen.getByRole('button', { name: 'Apply Filters' }));

    await waitFor(() =>
      expect(mockFinanceService.getMovements).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'Food & Groceries' })
      )
    );
    // Row text + active-filter badge.
    expect(screen.getAllByText('Food & Groceries').length).toBeGreaterThan(1);

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    await waitFor(() =>
      expect(mockFinanceService.getMovements).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: undefined, month: undefined })
      )
    );
    expect(screen.queryByText('Active filters:')).not.toBeInTheDocument();
  });
});
