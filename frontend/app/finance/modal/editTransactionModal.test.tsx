import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Transaction } from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { showToast } from '@/lib/toast';
import { EditTransactionModal } from './editTransactionModal';

vi.mock('@shared/services/finance-service', () => ({
  financeService: {
    updateTransaction: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// Mocking the shared context keeps this test on the component's own logic and
// avoids a second React copy (the workspace root installs React for mobile).
vi.mock('@shared/contexts/language-context', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const createTransaction: Record<string, string> = {
      descriptionNew: 'Describe the transaction',
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'What was it for?',
      type: 'Type',
      income: 'Income',
      expense: 'Expense',
      frequency: 'Frequency',
      fixed: 'Fixed',
      variable: 'Variable',
      paymentFrequency: 'Payment frequency',
      monthly: 'Monthly',
      bimonthly: 'Bimonthly',
      yearly: 'Yearly',
      amount: 'Amount',
      date: 'Date',
      category: 'Category',
      selectCategory: 'Select a category',
      selectCategoryError: 'Pick a category first',
      invalidAmountError: 'Enter an amount greater than zero',
      validationError: 'Validation error',
    };
    const common: Record<string, string> = {
      cancel: 'Cancel',
      error: 'Error',
      updating: 'Updating...',
    };
    const finance: Record<string, string> = {
      editTransaction: 'Edit transaction',
      updateTransaction: 'Update transaction',
      transactionUpdated: 'Transaction updated',
      transactionUpdatedDescription: 'Saved',
    };
    const ns =
      namespace === 'common'
        ? common
        : namespace === 'finance'
          ? finance
          : createTransaction;
    return ns[key] ?? key;
  },
}));

const mockFinanceService = vi.mocked(financeService);

// The triggers carry no accessible name (labels are not linked via htmlFor
// here), so select them positionally by data-slot: [0] type, [1] frequency,
// [2] payment frequency (fixed only), then category.
function trigger(index: number): HTMLElement {
  const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
  expect(triggers.length).toBeGreaterThan(index);
  return triggers[index] as HTMLElement;
}

const categories: Category[] = [
  { name: 'Food & Groceries', type: 'outcome' },
  { name: 'Primary Income', type: 'income' },
];

const transaction: Transaction = {
  id: 't1',
  userId: 1,
  type: 'outcome',
  frequency: 'variable',
  amount: 2500,
  category: 'Food & Groceries',
  description: 'Dinner',
  date: new Date(2026, 0, 15, 12).toISOString(),
  createdAt: new Date(2026, 0, 15).toISOString(),
  updatedAt: new Date(2026, 0, 15).toISOString(),
};

const updatedTransaction: Transaction = {
  ...transaction,
  amount: 3000,
  description: 'Family dinner',
};

function renderModal(
  props: Partial<Parameters<typeof EditTransactionModal>[0]> = {}
) {
  return render(
    <EditTransactionModal
      open
      onOpenChange={vi.fn()}
      transaction={transaction}
      onTransactionUpdated={vi.fn()}
      categories={categories}
      {...props}
    />
  );
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Update transaction' }));
}

describe('EditTransactionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinanceService.updateTransaction.mockResolvedValue(updatedTransaction);
  });

  it('renders nothing without a transaction', () => {
    const { container } = renderModal({ transaction: null });
    expect(container).toBeEmptyDOMElement();
  });

  it('prefills the form from the transaction being edited', () => {
    renderModal();

    expect(screen.getByLabelText('Description')).toHaveValue('Dinner');
    expect(screen.getByLabelText('Amount')).toHaveValue('2,500');
    expect(trigger(0)).toHaveTextContent('Expense');
    expect(trigger(1)).toHaveTextContent('Variable');
    expect(document.getElementById('edit-date')).toHaveValue('2026-01-15');
  });

  it('saves variable edits and closes on success', async () => {
    const onTransactionUpdated = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderModal({ onTransactionUpdated, onOpenChange });

    await user.type(screen.getByLabelText('Description'), ' Family dinner');
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '3000');
    await submit(user);

    await waitFor(() =>
      expect(mockFinanceService.updateTransaction).toHaveBeenCalledWith('t1', {
        type: 'outcome',
        frequency: 'variable',
        paymentFrequency: undefined,
        amount: 3000,
        category: 'Food & Groceries',
        description: 'Dinner Family dinner',
        date: new Date(2026, 0, 15, 0, 0, 0).toISOString(),
      })
    );
    expect(onTransactionUpdated).toHaveBeenCalledWith(updatedTransaction);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Transaction updated' })
    );
  });

  it('rejects a category-less submit', async () => {
    const user = userEvent.setup();
    renderModal({
      categories: [],
      transaction: { ...transaction, category: '' },
    });

    await submit(user);

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Pick a category first',
        variant: 'destructive',
      })
    );
    expect(mockFinanceService.updateTransaction).not.toHaveBeenCalled();
  });

  it('rejects a non-positive amount', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '0');
    await submit(user);

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Enter an amount greater than zero',
      })
    );
    expect(mockFinanceService.updateTransaction).not.toHaveBeenCalled();
  });

  it('switching to fixed hides amount and date and sends the payment frequency', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(trigger(1));
    await user.click(await screen.findByRole('option', { name: 'Fixed' }));

    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Date' })
    ).not.toBeInTheDocument();
    expect(trigger(2)).toHaveTextContent('Monthly');

    // Switching frequency cleared the category, so pick one again.
    await user.click(trigger(3));
    await user.click(
      await screen.findByRole('option', { name: 'Food & Groceries' })
    );
    await submit(user);

    await waitFor(() =>
      expect(mockFinanceService.updateTransaction).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          frequency: 'fixed',
          paymentFrequency: 'monthly',
          amount: 0,
          category: 'Food & Groceries',
        })
      )
    );
  });

  it('clears the category when the type change makes it invalid', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(trigger(0));
    await user.click(await screen.findByRole('option', { name: 'Income' }));
    await user.type(screen.getByLabelText('Amount'), '900');
    await submit(user);

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Pick a category first' })
    );
  });

  it('reports a validation error when the frequency change cleared the category', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(trigger(1));
    await user.click(await screen.findByRole('option', { name: 'Fixed' }));
    await submit(user);

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Pick a category first' })
    );
    expect(mockFinanceService.updateTransaction).not.toHaveBeenCalled();
  });

  it('shows an error toast when the update fails', async () => {
    mockFinanceService.updateTransaction.mockRejectedValue(
      new Error('conflict')
    );
    const user = userEvent.setup();
    renderModal();

    await submit(user);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'conflict',
          variant: 'destructive',
        })
      )
    );
  });

  it('resets the form when cancelled', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderModal({ onOpenChange });

    await user.type(screen.getByLabelText('Description'), ' extra');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() =>
      expect(screen.getByLabelText('Description')).toHaveValue('')
    );
  });
});
