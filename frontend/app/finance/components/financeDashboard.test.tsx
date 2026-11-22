import {
  cloneElement,
  isValidElement,
  type PropsWithChildren,
  type ReactElement,
} from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  FinanceSummary,
  FixedTransaction,
  MonthlyStats,
} from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { FinanceDashboard } from './financeDashboard';

// ResponsiveContainer measures its parent via ResizeObserver and jsdom
// reports 0x0, so the chart would never render. Hand the chart child fixed
// dimensions instead — same as passing width/height props in an app.
vi.mock('recharts', async (importOriginal) => {
  const recharts = await importOriginal<typeof import('recharts')>();
  return {
    ...recharts,
    ResponsiveContainer: ({ children }: PropsWithChildren) =>
      isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ width: number; height: number }>,
            { width: 320, height: 200 }
          )
        : children,
  };
});

vi.mock('@shared/services/finance-service', () => ({
  financeService: {
    getFinanceSummary: vi.fn(),
    getMonthlyStats: vi.fn(),
  },
}));

// Mocking the shared context keeps this test on the component's own logic and
// avoids a second React copy (the workspace root installs React for mobile).
vi.mock('@shared/contexts/language-context', () => ({
  useTranslations:
    (namespace: string) => (key: string, vars?: Record<string, string>) => {
      const finance: Record<string, string> = {
        totalIncome: 'Total income',
        totalOutcome: 'Total expenses',
        balance: 'Balance',
        usdOficial: 'USD Oficial',
        usdBlue: 'USD Blue',
        buy: 'Buy',
        sell: 'Sell',
        updated: 'Updated {date}',
        unavailable: 'Unavailable',
        monthlyTrend: 'Monthly trend',
        noChartData: 'No data to show yet.',
        incomeByCategory: 'Income by category',
        outcomeByCategory: 'Expenses by category',
        noIncomeCategories: 'No income recorded this month.',
        noOutcomeCategories: 'No expenses recorded this month.',
        upcomingBills: 'Upcoming bills',
        noUpcomingBills: 'All bills paid. Nice!',
        recordPayment: 'Record payment',
        income: 'Income',
        outcome: 'Expense',
      };
      const financeCategories: Record<string, string> = {
        'Food & Groceries': 'Food & Groceries',
        'Primary Income': 'Primary Income',
      };
      const createTransaction: Record<string, string> = {
        monthly: 'Monthly',
        bimonthly: 'Bimonthly',
        yearly: 'Yearly',
      };
      const ns =
        namespace === 'financeCategories'
          ? financeCategories
          : namespace === 'createTransaction'
            ? createTransaction
            : finance;
      return (ns[key] ?? key).replace(
        /\{(\w+)\}/g,
        (_, name) => vars?.[name] ?? `{${name}}`
      );
    },
}));

const mockFinanceService = vi.mocked(financeService);

const summary: FinanceSummary = {
  totalIncome: 1500,
  totalOutcome: 400,
  balance: 1100,
  incomeByCategory: [
    {
      categoryName: 'Primary Income',
      total: 1500,
      percentage: 100,
      count: 1,
    },
  ],
  outcomeByCategory: [
    {
      categoryName: 'Food & Groceries',
      total: 400,
      percentage: 55,
      count: 3,
    },
  ],
  period: '2026-01',
};

// Full year of stats; the component keeps only the months up to today's month
// and the last 6 of those. Month names make the sliced tick labels
// predictable ("January" -> "Jan").
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const monthlyStats: MonthlyStats[] = MONTH_NAMES.map((month, index) => ({
  month,
  year: 2026,
  totalIncome: 1000 + index,
  totalOutcome: 100 + index,
  balance: 900 + index,
  transactionCount: 10 + index,
}));

const unpaidBill: FixedTransaction = {
  id: 'fixed-1',
  type: 'outcome',
  paymentFrequency: 'monthly',
  category: 'Housing & Utilities',
  description: 'Rent',
  totalPaid: 0,
  createdAt: new Date(2026, 0, 1).toISOString(),
  updatedAt: new Date(2026, 0, 1).toISOString(),
};

const paidBill: FixedTransaction = {
  ...unpaidBill,
  id: 'fixed-2',
  category: 'Food & Groceries',
  currentPeriodPayment: {
    id: 'p1',
    amount: 100,
    date: new Date(2026, 0, 10).toISOString(),
  },
};

const dolarRatesPayload = [
  {
    casa: 'oficial',
    compra: 1000,
    venta: 1050,
    fechaActualizacion: '2026-01-15T10:30:00.000Z',
  },
  {
    casa: 'blue',
    compra: 1200,
    venta: 1250,
    fechaActualizacion: '2026-01-15T10:30:00.000Z',
  },
];

function renderDashboard(
  fixedTransactions: FixedTransaction[] = [],
  onRecordPayment = vi.fn()
) {
  return render(
    <FinanceDashboard
      fixedTransactions={fixedTransactions}
      onRecordPayment={onRecordPayment}
    />
  );
}

describe('FinanceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinanceService.getFinanceSummary.mockResolvedValue(summary);
    mockFinanceService.getMonthlyStats.mockResolvedValue(monthlyStats);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve(dolarRatesPayload),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing while the first load is in flight', () => {
    mockFinanceService.getFinanceSummary.mockReturnValue(
      new Promise(() => undefined)
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => undefined))
    );

    const { container } = renderDashboard();
    expect(container).toBeEmptyDOMElement();
  });

  it('fetches the current month summary and this year stats', async () => {
    renderDashboard();

    await waitFor(() => expect(screen.getByText('Balance')).toBeVisible());

    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .getDate()
      .toString()
      .padStart(2, '0');
    expect(mockFinanceService.getFinanceSummary).toHaveBeenCalledWith(
      `${now.getFullYear()}-${month}-01`,
      `${now.getFullYear()}-${month}-${lastDay}`
    );
    expect(mockFinanceService.getMonthlyStats).toHaveBeenCalledWith(
      now.getFullYear()
    );
  });

  it('shows the income, outcome and balance summary cards', async () => {
    renderDashboard();

    await waitFor(() => expect(screen.getByText('Total income')).toBeVisible());
    expect(screen.getAllByText('$1,500').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$400').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$1,100').length).toBeGreaterThanOrEqual(1);
  });

  it('colors a negative balance as danger', async () => {
    mockFinanceService.getFinanceSummary.mockResolvedValue({
      ...summary,
      balance: -250,
    });

    renderDashboard();

    const balanceP = await screen.findByText(
      (_, el) => el?.tagName === 'P' && el.textContent === '$-250'
    );
    expect(balanceP.className).toContain('text-danger');
  });

  it('renders the dolar buy/sell cards with the update timestamp', async () => {
    renderDashboard();

    await waitFor(() => expect(screen.getByText('USD Blue')).toBeVisible());
    expect(screen.getAllByText('$1,000').length).toBe(1);
    expect(screen.getAllByText('$1,050').length).toBe(1);
    expect(screen.getAllByText('$1,200').length).toBe(1);
    expect(screen.getAllByText('$1,250').length).toBe(1);
    expect(screen.getAllByText(/^Updated /).length).toBe(2);
  });

  it('shows Unavailable when the dolar rate fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    renderDashboard();

    await waitFor(() =>
      expect(screen.getAllByText('Unavailable')).toHaveLength(2)
    );
  });

  it('renders the monthly trend chart for the visible months only', async () => {
    const { container } = renderDashboard();

    await waitFor(() =>
      expect(screen.getByText('Monthly trend')).toBeVisible()
    );

    const currentMonth = new Date().getMonth();
    const visible = MONTH_NAMES.slice(0, currentMonth + 1)
      .slice(-6)
      .map((name) => name.slice(0, 3));
    const hidden = MONTH_NAMES.slice(currentMonth + 1).map((name) =>
      name.slice(0, 3)
    );

    const svg = await waitFor(() => {
      const el = container.querySelector('svg.recharts-surface');
      expect(el).not.toBeNull();
      return el!;
    });
    const svgText = svg.textContent ?? '';
    // The axis may auto-skip ticks on the narrow container, but the most
    // recent month is always drawn and future months are never drawn.
    expect(svgText).toContain(visible[visible.length - 1]);
    for (const tick of hidden) {
      expect(svgText).not.toContain(tick);
    }
    // Bars render for the income and outcome series.
    expect(
      container.querySelectorAll('.recharts-bar-rectangle').length
    ).toBeGreaterThan(0);
  });

  it('shows the no-chart-data fallback when there are no stats', async () => {
    mockFinanceService.getMonthlyStats.mockResolvedValue([]);

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText('No data to show yet.')).toBeVisible()
    );
  });

  it('breaks down income and outcome by category with progress bars', async () => {
    const { container } = renderDashboard();

    await waitFor(() =>
      expect(screen.getByText('Income by category')).toBeVisible()
    );
    expect(screen.getByText('Primary Income')).toBeInTheDocument();
    expect(screen.getByText('Food & Groceries')).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-slot="progress"]').length
    ).toBeGreaterThan(0);
  });

  it('shows the empty-category fallbacks', async () => {
    mockFinanceService.getFinanceSummary.mockResolvedValue({
      ...summary,
      incomeByCategory: [],
      outcomeByCategory: [],
    });

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText('No income recorded this month.')).toBeVisible()
    );
    expect(
      screen.getByText('No expenses recorded this month.')
    ).toBeInTheDocument();
  });

  it('lists only unpaid fixed transactions as upcoming bills', async () => {
    const onRecordPayment = vi.fn();
    const user = userEvent.setup();
    renderDashboard([paidBill, unpaidBill], onRecordPayment);

    await waitFor(() =>
      expect(screen.getByText('Upcoming bills')).toBeVisible()
    );

    // Only the unpaid bill gets a row; the paid one is filtered out.
    expect(screen.getByText('Housing & Utilities')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Record payment.*\$100/ })
    ).not.toBeInTheDocument();
    const recordButtons = screen.getAllByRole('button', {
      name: 'Record payment',
    });
    expect(recordButtons).toHaveLength(1);

    await user.click(recordButtons[0]);
    expect(onRecordPayment).toHaveBeenCalledWith(unpaidBill);
  });

  it('shows the all-paid fallback when every bill is paid', async () => {
    renderDashboard([paidBill]);

    await waitFor(() =>
      expect(screen.getByText('All bills paid. Nice!')).toBeVisible()
    );
  });
});
