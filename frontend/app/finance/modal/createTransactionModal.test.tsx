import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Transaction } from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { showToast } from '@/lib/toast';
import { CreateTransactionModal } from './createTransactionModal';

vi.mock('@shared/services/finance-service', () => ({
  financeService: {
    createTransaction: vi.fn(),
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
      titleFixed: 'New fixed transaction',
      titleNew: 'New transaction',
      descriptionFixed: 'Describe the fixed transaction',
      descriptionNew: 'Describe the transaction',
      descriptionLabel: 'Description',
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
      rightNow: 'Right now',
      category: 'Category',
      selectCategory: 'Select a category',
      selectCategoryError: 'Pick a category first',
      invalidAmountError: 'Enter an amount greater than zero',
      creating: 'Creating...',
      createFixed: 'Create fixed',
      createTransaction: 'Create transaction',
      validationError: 'Validation error',
      transactionCreated: 'Transaction created',
      fixedCreatedDescription: 'Fixed created',
      variableCreatedDescription: 'Variable created',
      creationFailed: 'Creation failed',
      recurring: 'Recurring',
    };
    const common: Record<string, string> = {
      cancel: 'Cancel',
    };
    const ns = namespace === 'common' ? common : createTransaction;
    return ns[key] ?? key;
  },
}));

const mockFinanceService = vi.mocked(financeService);

const categories: Category[] = [
  { name: 'Food & Groceries', type: 'outcome', icon: '🍔' },
  { name: 'Transportation', type: 'outcome' },
  { name: 'Primary Income', type: 'income', applicableToFreq: 'variable' },
  { name: 'Rent', type: 'outcome', applicableToFreq: 'fixed' },
];

const createdTransaction: Transaction = {
  id: 't1',
  userId: 1,
  type: 'outcome',
  frequency: 'variable',
  amount: 2500,
  category: 'Food & Groceries',
  date: new Date(2026, 0, 15).toISOString(),
  createdAt: new Date(2026, 0, 15).toISOString(),
  updatedAt: new Date(2026, 0, 15).toISOString(),
};

function renderModal(
  props: Partial<Parameters<typeof CreateTransactionModal>[0]> = {}
) {
  return render(
    <CreateTransactionModal
      open
      onOpenChange={vi.fn()}
      onTransactionCreated={vi.fn()}
      categories={categories}
      {...props}
    />
  );
}

async function selectCategory(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Category' }));
  await user.click(
    await screen.findByRole('option', { name: new RegExp(name) })
  );
}

describe('CreateTransactionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinanceService.createTransaction.mockResolvedValue(createdTransaction);
  });

  it('validates that a category is selected before submitting', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Amount'), '100');
    await user.click(
      screen.getByRole('button', { name: 'Create transaction' })
    );

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validation error',
        description: 'Pick a category first',
        variant: 'destructive',
      })
    );
    expect(mockFinanceService.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects a zero or non-numeric amount for variable transactions', async () => {
    const user = userEvent.setup();
    renderModal();

    await selectCategory('Food & Groceries');
    await user.type(screen.getByLabelText('Amount'), '0');
    await user.click(
      screen.getByRole('button', { name: 'Create transaction' })
    );

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Enter an amount greater than zero',
        variant: 'destructive',
      })
    );
    expect(mockFinanceService.createTransaction).not.toHaveBeenCalled();
  });

  it('creates a variable transaction with the formatted amount', async () => {
    const onTransactionCreated = vi.fn();
    const user = userEvent.setup();
    renderModal({ onTransactionCreated });

    await user.type(screen.getByLabelText('Amount'), '2500');
    await selectCategory('Food & Groceries');
    await user.type(screen.getByLabelText('Description'), 'Dinner');
    await user.click(
      screen.getByRole('button', { name: 'Create transaction' })
    );

    await waitFor(() =>
      expect(mockFinanceService.createTransaction).toHaveBeenCalledWith({
        type: 'outcome',
        frequency: 'variable',
        paymentFrequency: undefined,
        amount: 2500,
        category: 'Food & Groceries',
        description: 'Dinner',
        date: undefined,
      })
    );
    expect(onTransactionCreated).toHaveBeenCalledWith(createdTransaction);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Transaction created',
        description: 'Variable created',
      })
    );
  });

  it('formats the amount input with thousands separators', async () => {
    const user = userEvent.setup();
    renderModal();

    const amount = screen.getByLabelText('Amount');
    await user.type(amount, '1234567');
    expect(amount).toHaveValue('1,234,567');
  });

  it('creates an income transaction of a different type with its own categories', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByRole('option', { name: 'Income' }));

    await selectCategory('Primary Income');
    await user.type(screen.getByLabelText('Amount'), '900');
    await user.click(
      screen.getByRole('button', { name: 'Create transaction' })
    );

    await waitFor(() =>
      expect(mockFinanceService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'income', category: 'Primary Income' })
      )
    );
  });

  it('creates a recurring fixed transaction with the payment frequency and no amount', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByLabelText('Recurring'));
    expect(screen.getByLabelText('Amount')).toBeDisabled();

    await selectCategory('Rent');
    await user.click(
      screen.getByRole('combobox', { name: 'Payment frequency' })
    );
    await user.click(await screen.findByRole('option', { name: 'Yearly' }));
    await user.click(screen.getByRole('button', { name: 'Create fixed' }));

    await waitFor(() =>
      expect(mockFinanceService.createTransaction).toHaveBeenCalledWith({
        type: 'outcome',
        frequency: 'fixed',
        paymentFrequency: 'yearly',
        amount: 0,
        category: 'Rent',
        description: '',
        date: undefined,
      })
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Fixed created' })
    );
  });

  it('picks a custom date when "Right now" is off', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByLabelText('Right now'));
    const date = document.getElementById('date') as HTMLInputElement;
    expect(date).toBeInTheDocument();
    fireEvent.change(date, { target: { value: '2026-01-15' } });
    expect(date.value).toBe('2026-01-15');

    await user.type(screen.getByLabelText('Amount'), '500');
    await selectCategory('Food & Groceries');
    await user.click(
      screen.getByRole('button', { name: 'Create transaction' })
    );

    await waitFor(() =>
      expect(mockFinanceService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          date: new Date(2026, 0, 15, 0, 0, 0).toISOString(),
        })
      )
    );
  });

  it('clears the selected category when the type changes', async () => {
    const user = userEvent.setup();
    renderModal();

    await selectCategory('Food & Groceries');
    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByRole('option', { name: 'Income' }));

    // Required amount must be satisfied for the submit handler to run.
    await user.type(screen.getByLabelText('Amount'), '900');
    await user.click(
      screen.getByRole('button', { name: 'Create transaction' })
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Pick a category first' })
    );
    expect(mockFinanceService.createTransaction).not.toHaveBeenCalled();
  });

  it('resets the form and reports closed after a cancel', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderModal({ onOpenChange });

    await user.type(screen.getByLabelText('Description'), 'Dinner');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByLabelText('Description')).toHaveValue('');
  });

  it('shows a destructive toast when creation fails', async () => {
    mockFinanceService.createTransaction.mockRejectedValue(
      new Error('backend down')
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Amount'), '300');
    await selectCategory('Food & Groceries');
    await user.click(
      screen.getByRole('button', { name: 'Create transaction' })
    );

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Creation failed',
          description: 'backend down',
          variant: 'destructive',
        })
      )
    );
  });
});
