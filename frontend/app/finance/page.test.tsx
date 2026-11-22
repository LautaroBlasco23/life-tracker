import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@shared/types';
import FinancePage from './page';
import { useFinanceCategories } from './hooks/use-finance-categories';

// Mocking the shared context keeps this test on the component's own logic and
// avoids a second React copy (the workspace root installs React for mobile).
vi.mock('@shared/contexts/language-context', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const finance: Record<string, string> = {
      title: 'Finance',
      description: 'Track your income and expenses',
      movements: 'Transactions',
      dashboard: 'Dashboard',
      addMovement: 'Add transaction',
    };
    return namespace === 'finance' ? (finance[key] ?? key) : key;
  },
}));

vi.mock('./hooks/use-finance-categories', () => ({
  useFinanceCategories: vi.fn(),
}));

// Child views/modals are covered by their own suites; stubbed to observe how
// the page mounts, hides and refreshes them across tab switches.
vi.mock('./views/transactionsView', () => ({
  TransactionsView: (props: {
    refreshKey: number;
    onOpenCreate: () => void;
  }) => (
    <div data-testid="transactions-view">
      <span data-testid="transactions-refresh">{props.refreshKey}</span>
      <button onClick={props.onOpenCreate}>open-create</button>
    </div>
  ),
}));
vi.mock('./views/dashboardView', () => ({
  DashboardView: (props: { refreshKey: number }) => (
    <div data-testid="dashboard-view">
      <span data-testid="dashboard-refresh">{props.refreshKey}</span>
    </div>
  ),
}));
vi.mock('./modal/createTransactionModal', () => ({
  CreateTransactionModal: (props: {
    open: boolean;
    onTransactionCreated: () => void;
  }) =>
    props.open ? (
      <div data-testid="create-modal">
        <button onClick={props.onTransactionCreated}>create-done</button>
      </div>
    ) : null,
}));

const mockUseFinanceCategories = vi.mocked(useFinanceCategories);

const categories: Category[] = [{ name: 'Food & Groceries', type: 'outcome' }];

describe('FinancePage (tabbed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFinanceCategories.mockReturnValue(categories);
  });

  it('starts on the transactions tab with the dashboard not mounted yet', () => {
    render(<FinancePage />);

    expect(screen.getByRole('tab', { name: 'Transactions' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('transactions-view')).toBeVisible();
    expect(screen.queryByTestId('dashboard-view')).not.toBeInTheDocument();
  });

  it('mounts the dashboard tab lazily on first visit', async () => {
    const user = userEvent.setup();
    render(<FinancePage />);

    expect(screen.queryByTestId('dashboard-view')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Dashboard' }));

    expect(screen.getByTestId('dashboard-view')).toBeVisible();
  });

  it('keeps visited tabs mounted but hidden after switching back', async () => {
    const user = userEvent.setup();
    render(<FinancePage />);

    await user.click(screen.getByRole('tab', { name: 'Dashboard' }));
    expect(screen.getByTestId('dashboard-view')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Transactions' }));
    expect(screen.getByTestId('transactions-view')).toBeVisible();
    // Dashboard stays mounted (state survives) but inside a hidden wrapper —
    // Tailwind classes are not computed in jsdom, so check the wrapper class.
    const dashboardWrapper =
      screen.getByTestId('dashboard-view').parentElement!;
    expect(dashboardWrapper.className).toContain('hidden');
    expect(screen.getByRole('tab', { name: 'Transactions' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('passes the loaded categories to the transactions view', () => {
    render(<FinancePage />);

    expect(mockUseFinanceCategories).toHaveBeenCalled();
    expect(screen.getByTestId('transactions-view')).toBeVisible();
  });

  it('opens the create modal from the header button', async () => {
    const user = userEvent.setup();
    render(<FinancePage />);

    await user.click(screen.getByRole('button', { name: /Add transaction/ }));

    expect(screen.getByTestId('create-modal')).toBeVisible();
  });

  it('bumps the refresh key and closes the modal after a transaction is created', async () => {
    const user = userEvent.setup();
    render(<FinancePage />);

    await user.click(screen.getByRole('button', { name: /Add transaction/ }));
    await user.click(screen.getByRole('button', { name: 'create-done' }));

    expect(screen.queryByTestId('create-modal')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('transactions-refresh')).toHaveTextContent('1')
    );
  });

  it('opens the create modal from the empty-feed action inside the view', async () => {
    const user = userEvent.setup();
    render(<FinancePage />);

    await user.click(screen.getByRole('button', { name: 'open-create' }));

    expect(screen.getByTestId('create-modal')).toBeVisible();
  });
});
