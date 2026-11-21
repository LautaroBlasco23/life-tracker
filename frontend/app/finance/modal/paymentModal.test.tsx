import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixedTransaction } from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { showToast } from '@/lib/toast';
import { PaymentModal } from './paymentModal';

vi.mock('@shared/services/finance-service', () => ({
  financeService: {
    getFixedTransactionWithPayments: vi.fn(),
    createPayment: vi.fn(),
    deletePayment: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// Mocking the shared context keeps this test on the component's own logic and
// avoids a second React copy (the workspace root installs React for mobile).
vi.mock('@shared/contexts/language-context', () => ({
  useTranslations:
    (namespace: string) => (key: string, vars?: Record<string, string>) => {
      const paymentModal: Record<string, string> = {
        title: 'Record a payment',
        descriptionIncome: 'Income payment',
        descriptionExpense: 'Expense payment',
        totalPaid: 'Total paid',
        amount: 'Amount',
        date: 'Date',
        recordPayment: 'Record payment',
        recording: 'Recording...',
        paymentHistory: 'Payment history ({count})',
        loadingPayments: 'Loading payments...',
        paymentRecorded: 'Payment recorded',
        paymentRecordedDescription: 'Recorded ${amount}',
        paymentFailed: 'Payment failed',
        paymentDeleted: 'Payment deleted',
        paymentDeletedDescription: 'Removed',
        deleteFailed: 'Delete failed',
        invalidAmount: 'Enter a valid amount',
      };
      const common: Record<string, string> = { error: 'Error' };
      const ns = namespace === 'common' ? common : paymentModal;
      return (ns[key] ?? key).replace(
        /\{(\w+)\}/g,
        (_, name) => vars?.[name] ?? `{${name}}`
      );
    },
}));

const mockFinanceService = vi.mocked(financeService);

const transaction: FixedTransaction = {
  id: 'fixed-1',
  type: 'outcome',
  paymentFrequency: 'monthly',
  category: 'Housing & Utilities',
  description: 'Rent',
  totalPaid: 3600,
  createdAt: new Date(2026, 0, 1).toISOString(),
  updatedAt: new Date(2026, 0, 1).toISOString(),
};

const details = {
  ...transaction,
  payments: [
    { id: 'p1', amount: 1200, date: new Date(2026, 0, 1).toISOString() },
    { id: 'p2', amount: 1200, date: new Date(2026, 1, 1).toISOString() },
  ],
};

// The history rows expose a bare icon button with no accessible name. Radix
// portals the dialog to document.body, so query there, not the container.
function historyDeleteButtons(): HTMLButtonElement[] {
  return Array.from(document.body.querySelectorAll('button')).filter((button) =>
    button.querySelector('svg.lucide-trash-2')
  ) as HTMLButtonElement[];
}

function renderModal(props: Partial<Parameters<typeof PaymentModal>[0]> = {}) {
  return render(
    <PaymentModal
      open
      onOpenChange={vi.fn()}
      transaction={transaction}
      onPaymentCreated={vi.fn()}
      {...props}
    />
  );
}

describe('PaymentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinanceService.getFixedTransactionWithPayments.mockResolvedValue(
      details
    );
  });

  it('renders nothing without a transaction', () => {
    const { container } = renderModal({ transaction: null });
    expect(container).toBeEmptyDOMElement();
  });

  it('loads and lists the payment history on open', async () => {
    renderModal();

    expect(
      mockFinanceService.getFixedTransactionWithPayments
    ).toHaveBeenCalledWith('fixed-1');
    expect(await screen.findByText('Payment history (2)')).toBeInTheDocument();
    expect(screen.getAllByText('$1,200')).toHaveLength(2);
    expect(screen.getByText('$3,600')).toBeInTheDocument();
  });

  it('falls back to the summary total when details fail to load', async () => {
    mockFinanceService.getFixedTransactionWithPayments.mockRejectedValue(
      new Error('offline')
    );
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    renderModal();

    await waitFor(() => expect(screen.getByText('$3,600')).toBeVisible());
    expect(screen.queryByText(/Payment history/)).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('rejects a zero amount without calling the service', async () => {
    renderModal();
    await screen.findByText(/Payment history/);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Amount'), '0');
    await user.click(screen.getByRole('button', { name: /Record payment/ }));

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'Enter a valid amount',
        variant: 'destructive',
      })
    );
    expect(mockFinanceService.createPayment).not.toHaveBeenCalled();
  });

  it('records a payment for the entered amount and date', async () => {
    const onPaymentCreated = vi.fn();
    const onOpenChange = vi.fn();
    mockFinanceService.createPayment.mockResolvedValue({
      id: 'p3',
      transactionId: 'fixed-1',
      amount: 1200,
      date: new Date(2026, 2, 1).toISOString(),
      createdAt: new Date(2026, 2, 1).toISOString(),
    });
    const user = userEvent.setup();
    renderModal({ onPaymentCreated, onOpenChange });
    await screen.findByText(/Payment history/);

    await user.type(screen.getByLabelText('Amount'), '1200');
    await user.click(screen.getByRole('button', { name: /Record payment/ }));

    await waitFor(() =>
      expect(mockFinanceService.createPayment).toHaveBeenCalledWith({
        transactionId: 'fixed-1',
        amount: 1200,
        date: expect.stringContaining('T'),
      })
    );
    expect(onPaymentCreated).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Payment recorded',
        description: 'Recorded $1,200',
      })
    );
  });

  it('shows a failure toast when the payment cannot be created', async () => {
    mockFinanceService.createPayment.mockRejectedValue(
      new Error('exceeds amount')
    );
    const user = userEvent.setup();
    renderModal();
    await screen.findByText(/Payment history/);

    await user.type(screen.getByLabelText('Amount'), '99999');
    await user.click(screen.getByRole('button', { name: /Record payment/ }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Payment failed',
          description: 'exceeds amount',
          variant: 'destructive',
        })
      )
    );
  });

  it('deletes a payment from the history and reloads the details', async () => {
    const onPaymentCreated = vi.fn();
    mockFinanceService.deletePayment.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderModal({ onPaymentCreated });
    await screen.findByText(/Payment history/);

    const deleteButtons = await waitFor(() => {
      const buttons = historyDeleteButtons();
      expect(buttons).toHaveLength(2);
      return buttons;
    });
    await user.click(deleteButtons[0]);

    await waitFor(() =>
      expect(mockFinanceService.deletePayment).toHaveBeenCalledWith('p1')
    );
    expect(onPaymentCreated).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Payment deleted' })
    );
    // Details are refetched after the deletion.
    expect(
      mockFinanceService.getFixedTransactionWithPayments
    ).toHaveBeenCalledTimes(2);
  });

  it('shows a failure toast when deleting a payment fails', async () => {
    mockFinanceService.deletePayment.mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    renderModal();
    await screen.findByText(/Payment history/);

    const deleteButtons = await waitFor(() => {
      const buttons = historyDeleteButtons();
      expect(buttons.length).toBeGreaterThan(1);
      return buttons;
    });
    await user.click(deleteButtons[1]);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete failed',
          description: 'nope',
          variant: 'destructive',
        })
      )
    );
  });

  it('describes an income fixed transaction differently', async () => {
    renderModal({ transaction: { ...transaction, type: 'income' } });

    expect(await screen.findByText('Income payment')).toBeVisible();
  });
});
