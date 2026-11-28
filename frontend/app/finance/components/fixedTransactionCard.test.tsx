import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixedTransaction } from '@shared/types';
import { FixedTransactionCard } from './fixedTransactionCard';

vi.mock('@shared/contexts/language-context', () => ({
  useTranslations:
    (namespace: string) => (key: string, vars?: Record<string, string>) => {
      const finance: Record<string, string> = {
        income: 'Income',
        outcome: 'Expense',
        created: 'Created',
        thisPeriod: 'This period',
        total: 'Total',
        recordPayment: 'Record payment',
      };
      const createTransaction: Record<string, string> = {
        monthly: 'Monthly',
        yearly: 'Yearly',
      };
      const common: Record<string, string> = {
        edit: 'Edit',
        delete: 'Delete',
      };
      const ns =
        namespace === 'createTransaction'
          ? createTransaction
          : namespace === 'common'
            ? common
            : finance;
      return (ns[key] ?? key).replace(
        /\{(\w+)\}/g,
        (_, name) => vars?.[name] ?? `{${name}}`
      );
    },
}));

const unpaidBill: FixedTransaction = {
  id: 'fixed-1',
  type: 'outcome',
  paymentFrequency: 'monthly',
  category: 'Housing & Utilities',
  description: 'Rent',
  totalPaid: 12000,
  createdAt: new Date(2026, 0, 1).toISOString(),
  updatedAt: new Date(2026, 0, 1).toISOString(),
};

const paidBill: FixedTransaction = {
  ...unpaidBill,
  id: 'fixed-2',
  type: 'income',
  totalPaid: 500,
  currentPeriodPayment: {
    id: 'p1',
    amount: 500,
    date: new Date(2026, 0, 10).toISOString(),
  },
};

function renderCard(
  transaction: FixedTransaction,
  handlers: Partial<Parameters<typeof FixedTransactionCard>[0]> = {}
) {
  return render(
    <FixedTransactionCard
      transaction={transaction}
      onAddPayment={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      {...handlers}
    />
  );
}

describe('FixedTransactionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the category, badges, creation date and total', () => {
    renderCard(unpaidBill);

    expect(screen.getByText('Housing & Utilities')).toBeInTheDocument();
    expect(screen.getByText('Expense')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText(/Created Jan 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText('$12,000')).toBeInTheDocument();
    expect(screen.queryByText('This period:')).not.toBeInTheDocument();
  });

  it('shows the current period payment for a paid bill', () => {
    renderCard(paidBill);
    expect(screen.getByText('This period:')).toBeInTheDocument();
    expect(screen.getByText('+$500')).toBeInTheDocument();
  });

  it('opens the payment flow when an unpaid card is clicked', async () => {
    const onAddPayment = vi.fn();
    const user = userEvent.setup();
    renderCard(unpaidBill, { onAddPayment });

    await user.click(screen.getByText('Housing & Utilities'));
    expect(onAddPayment).toHaveBeenCalledWith(unpaidBill);
  });

  it('does not open the payment flow for an already paid card', async () => {
    const onAddPayment = vi.fn();
    const user = userEvent.setup();
    renderCard(paidBill, { onAddPayment });

    await user.click(screen.getByText('Housing & Utilities'));
    expect(onAddPayment).not.toHaveBeenCalled();
  });

  it('ignores clicks that start on a button or the dropdown', async () => {
    const onAddPayment = vi.fn();
    const user = userEvent.setup();
    renderCard(unpaidBill, { onAddPayment });

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(onAddPayment).not.toHaveBeenCalled();
  });

  it('records a payment from the dropdown menu', async () => {
    const onAddPayment = vi.fn();
    const user = userEvent.setup();
    renderCard(unpaidBill, { onAddPayment });

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(
      await screen.findByRole('menuitem', { name: /Record payment/ })
    );
    expect(onAddPayment).toHaveBeenCalledWith(unpaidBill);
  });

  it('does not offer recording a payment when the period is already paid', async () => {
    const user = userEvent.setup();
    renderCard(paidBill);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(
      screen.queryByRole('menuitem', { name: /Record payment/ })
    ).not.toBeInTheDocument();
  });

  it('edits the bill from the dropdown menu', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    renderCard(unpaidBill, { onEdit });

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    expect(onEdit).toHaveBeenCalledWith(unpaidBill);
  });

  it('deletes the bill after confirming in the delete modal', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderCard(unpaidBill, { onDelete });

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(await screen.findByRole('menuitem', { name: /Delete/ }));

    const confirm = await screen.findByRole('button', {
      name: 'Delete Transaction',
    });
    await user.click(confirm);

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('fixed-1'));
  });
});
