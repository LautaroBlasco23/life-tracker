import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixedTransaction } from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { showToast } from '@/lib/toast';
import { BillsSection } from './billsSection';

vi.mock('@shared/services/finance-service', () => ({
  financeService: {
    getFixedTransactions: vi.fn(),
    deleteTransaction: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// The modals are covered by their own tests; stub them to keep this suite
// focused on the grouping, headers and action wiring.
vi.mock('../modal/createTransactionModal', () => ({
  CreateTransactionModal: (props: { open: boolean }) =>
    props.open ? <div data-testid="create-modal" /> : null,
}));
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
// The translator is cached per namespace so `t` stays referentially stable.
vi.mock('@shared/contexts/language-context', () => {
  const finance: Record<string, string> = {
    bills: 'Bills',
    billsSubtitle: 'Recurring fixed transactions',
    noBillsYet: 'No fixed transactions yet',
    noBillsYetDescription: 'Add a recurring bill.',
    thisPeriod: 'This period',
    paid: 'paid',
    transactionDeleted: 'Transaction deleted',
    transactionDeletedDescription: 'Removed',
  };
  const createTransaction: Record<string, string> = {
    recordPayment: 'Record payment',
    monthly: 'Monthly',
  };
  const common: Record<string, string> = {
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    error: 'Error',
    deleting: 'Deleting...',
  };
  const deleteModal: Record<string, string> = {
    cannotBeUndone: 'This action cannot be undone.',
    areYouSure: 'Are you sure you want to delete "{name}"?',
    deleting: 'Deleting...',
  };
  const dictionaries: Record<string, Record<string, string>> = {
    finance,
    createTransaction,
    common,
    deleteModal,
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

const outcomeBill: FixedTransaction = {
  id: 'fixed-1',
  type: 'outcome',
  paymentFrequency: 'monthly',
  category: 'Housing & Utilities',
  description: 'Rent',
  totalPaid: 2400,
  createdAt: new Date(2026, 0, 1).toISOString(),
  updatedAt: new Date(2026, 0, 1).toISOString(),
};

const paidOutcomeBill: FixedTransaction = {
  ...outcomeBill,
  id: 'fixed-2',
  currentPeriodPayment: {
    id: 'p1',
    amount: 1200,
    date: new Date(2026, 0, 10).toISOString(),
  },
};

const incomeBill: FixedTransaction = {
  id: 'fixed-3',
  type: 'income',
  paymentFrequency: 'monthly',
  category: 'Primary Income',
  totalPaid: 900,
  createdAt: new Date(2026, 0, 2).toISOString(),
  updatedAt: new Date(2026, 0, 2).toISOString(),
};

const categories = [
  { name: 'Housing & Utilities', type: 'outcome' as const },
  { name: 'Primary Income', type: 'income' as const },
];

describe('BillsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinanceService.getFixedTransactions.mockResolvedValue([
      outcomeBill,
      paidOutcomeBill,
      incomeBill,
    ]);
  });

  it('loads fixed transactions on mount', async () => {
    render(<BillsSection categories={categories} />);

    await waitFor(() =>
      expect(mockFinanceService.getFixedTransactions).toHaveBeenCalledTimes(1)
    );
    // Two unpaid+paid outcome bills share the category name.
    expect(
      (await screen.findAllByText('Housing & Utilities')).length
    ).toBeGreaterThanOrEqual(2);
  });

  it('groups bills by type with per-type headers and paid counts', async () => {
    render(<BillsSection categories={categories} />);

    expect(await screen.findByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();

    // Outcome group: 2 transactions, 1 paid this period, $1,200 this period.
    expect(screen.getByText('2 transactions')).toBeInTheDocument();
    expect(screen.getByText(/1\/2 paid/)).toBeInTheDocument();
    expect(screen.getByText('$1,200')).toBeInTheDocument();

    // Income group: 1 transaction, none paid, $0 this period.
    expect(screen.getByText('1 transaction')).toBeInTheDocument();
    expect(screen.getByText(/0\/1 paid/)).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('shows the empty state when there are no fixed transactions', async () => {
    mockFinanceService.getFixedTransactions.mockResolvedValue([]);

    render(<BillsSection categories={categories} />);

    expect(await screen.findByText('No fixed transactions yet')).toBeVisible();
    expect(screen.getByText('Add a recurring bill.')).toBeInTheDocument();
  });

  it('keeps loading silently when the fetch fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockFinanceService.getFixedTransactions.mockRejectedValue(
      new Error('offline')
    );

    render(<BillsSection categories={categories} />);

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load fixed transactions:',
        expect.any(Error)
      )
    );
    expect(await screen.findByText('No fixed transactions yet')).toBeVisible();
    consoleError.mockRestore();
  });

  it('opens the edit modal with the fixed transaction mapped for editing', async () => {
    const user = userEvent.setup();
    const { container } = render(<BillsSection categories={categories} />);
    await screen.findAllByText('Housing & Utilities');

    // The income group renders before the expenses group, so the first
    // outcome bill's menu is the second trigger in the DOM.
    const menuTriggers = screen.getAllByRole('button', { name: 'Open menu' });
    await user.click(menuTriggers[1]);
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));

    const editModal = await screen.findByTestId('edit-modal');
    const payload = JSON.parse(editModal.textContent!);
    expect(payload).toMatchObject({
      id: 'fixed-1',
      frequency: 'fixed',
      paymentFrequency: 'monthly',
      amount: 0,
      category: 'Housing & Utilities',
    });
  });

  it('opens the payment modal when an unpaid bill is clicked', async () => {
    const user = userEvent.setup();
    render(<BillsSection categories={categories} />);
    await screen.findAllByText('Housing & Utilities');

    // First card is the unpaid bill; the paid one ignores card clicks.
    await user.click(screen.getAllByText('Rent')[0]);

    expect(await screen.findByTestId('payment-modal')).toHaveTextContent(
      '"id":"fixed-1"'
    );
  });

  it('deletes a fixed transaction after confirmation', async () => {
    mockFinanceService.deleteTransaction.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { container } = render(<BillsSection categories={categories} />);
    await screen.findAllByText('Housing & Utilities');

    // The income group renders before the expenses group, so the first
    // outcome bill's menu is the second trigger in the DOM.
    const menuTriggers = screen.getAllByRole('button', { name: 'Open menu' });
    await user.click(menuTriggers[1]);
    await user.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Delete Transaction' })
    );

    await waitFor(() =>
      expect(mockFinanceService.deleteTransaction).toHaveBeenCalledWith(
        'fixed-1'
      )
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Transaction deleted' })
    );
    // The list is refreshed after deleting.
    expect(mockFinanceService.getFixedTransactions).toHaveBeenCalledTimes(2);
  });
});
