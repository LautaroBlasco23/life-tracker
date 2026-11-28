import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixedTransaction } from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { DashboardView } from './dashboardView';

vi.mock('@shared/services/finance-service', () => ({
  financeService: {
    getFixedTransactions: vi.fn(),
  },
}));

// Covered by their own suites; stubbed to test the view's wiring only.
vi.mock('../components/financeDashboard', () => ({
  FinanceDashboard: (props: {
    fixedTransactions: FixedTransaction[];
    onRecordPayment: (transaction: FixedTransaction) => void;
  }) => (
    <div data-testid="dashboard">
      <span data-testid="dashboard-count">
        {props.fixedTransactions.length}
      </span>
      <button onClick={() => props.onRecordPayment(props.fixedTransactions[0])}>
        record
      </button>
    </div>
  ),
}));
vi.mock('../modal/paymentModal', () => ({
  PaymentModal: (props: { open: boolean; transaction: unknown }) =>
    props.open ? (
      <div data-testid="payment-modal">{JSON.stringify(props.transaction)}</div>
    ) : null,
}));

const mockFinanceService = vi.mocked(financeService);

const fixed: FixedTransaction[] = [
  {
    id: 'fixed-1',
    type: 'outcome',
    paymentFrequency: 'monthly',
    category: 'Housing & Utilities',
    totalPaid: 0,
    createdAt: new Date(2026, 0, 1).toISOString(),
    updatedAt: new Date(2026, 0, 1).toISOString(),
  },
];

describe('DashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinanceService.getFixedTransactions.mockResolvedValue(fixed);
  });

  it('loads the fixed transactions for the dashboard tab', async () => {
    render(<DashboardView refreshKey={0} />);

    expect(mockFinanceService.getFixedTransactions).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-count')).toHaveTextContent('1')
    );
  });

  it('keeps the initial load silent on failure', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockFinanceService.getFixedTransactions.mockRejectedValue(
      new Error('offline')
    );

    render(<DashboardView refreshKey={0} />);

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load fixed transactions:',
        expect.any(Error)
      )
    );
    expect(screen.getByTestId('dashboard-count')).toHaveTextContent('0');
    consoleError.mockRestore();
  });

  it('refetches when refreshKey increases', async () => {
    const { rerender } = render(<DashboardView refreshKey={0} />);
    await waitFor(() =>
      expect(mockFinanceService.getFixedTransactions).toHaveBeenCalledTimes(1)
    );

    rerender(<DashboardView refreshKey={1} />);
    await waitFor(() =>
      expect(mockFinanceService.getFixedTransactions).toHaveBeenCalledTimes(2)
    );

    // Same refreshKey again must not refetch.
    rerender(<DashboardView refreshKey={1} />);
    expect(mockFinanceService.getFixedTransactions).toHaveBeenCalledTimes(2);
  });

  it('opens the payment modal from the dashboard record-payment action', async () => {
    const user = userEvent.setup();
    render(<DashboardView refreshKey={0} />);
    await screen.findByTestId('dashboard');

    await user.click(screen.getByRole('button', { name: 'record' }));

    expect(await screen.findByTestId('payment-modal')).toHaveTextContent(
      '"id":"fixed-1"'
    );
  });
});
