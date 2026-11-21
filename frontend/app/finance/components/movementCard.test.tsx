import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Movement } from '@shared/types';
import { MovementCard } from './movementCard';

vi.mock('@shared/contexts/language-context', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const finance: Record<string, string> = {
      paymentRequired: 'Payment required',
    };
    const financeCategories: Record<string, string> = {
      'Food & Groceries': 'Food & Groceries',
    };
    const common: Record<string, string> = {
      edit: 'Edit',
      delete: 'Delete',
    };
    const ns =
      namespace === 'financeCategories'
        ? financeCategories
        : namespace === 'common'
          ? common
          : finance;
    return ns[key] ?? key;
  },
}));

// Fixed local instant: 12:30 local -> a deterministic "12:30 PM" label.
const DATE = new Date(2026, 0, 15, 12, 30).toISOString();

const baseMovement: Movement = {
  id: 'm1',
  sourceType: 'transaction',
  type: 'outcome',
  amount: 1234.5,
  category: 'Food & Groceries',
  description: 'Weekly groceries',
  date: DATE,
  paid: true,
};

function renderCard(
  overrides: Partial<Movement> = {},
  handlers: Partial<Parameters<typeof MovementCard>[0]> = {}
) {
  return render(
    <MovementCard
      movement={{ ...baseMovement, ...overrides }}
      icon="🍔"
      {...handlers}
    />
  );
}

// Text broken across nodes ("-" + "$" + "1,234.5"), so match the wrapping <p>.
// formatCurrency drops trailing zeros (1234.5 -> "1,234.5").
const amountP = (sign: '-' | '+') =>
  screen.getByText(
    (_, el) => el?.tagName === 'P' && el.textContent === `${sign}$1,234.5`
  );

describe('MovementCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the translated category, description, time and formatted amount', () => {
    renderCard();

    expect(screen.getByText('Food & Groceries')).toBeInTheDocument();
    expect(screen.getByText('Weekly groceries')).toBeInTheDocument();
    expect(screen.getByText('12:30 PM')).toBeInTheDocument();
    expect(amountP('-')).toBeInTheDocument();
    expect(screen.getByText('🍔')).toBeInTheDocument();
  });

  it('does not show the pending badge or dropdown escape for paid transactions', () => {
    renderCard();
    expect(screen.queryByText('Payment required')).not.toBeInTheDocument();
  });

  it('flags unpaid movements as payment required', () => {
    renderCard({ paid: false });
    expect(screen.getByText('Payment required')).toBeInTheDocument();
  });

  it('uses + and the success color for income', () => {
    renderCard({ type: 'income' });
    expect(amountP('+').className).toContain('text-success');
  });

  it('falls back to the money icon when the category has none', () => {
    render(<MovementCard movement={baseMovement} onClickPending={vi.fn()} />);
    expect(screen.getByText('💸')).toBeInTheDocument();
  });

  it('clicking a pending movement opens the payment flow', async () => {
    const onClickPending = vi.fn();
    const user = userEvent.setup();
    renderCard({ paid: false }, { onClickPending });

    await user.click(screen.getByText('Food & Groceries'));
    expect(onClickPending).toHaveBeenCalledTimes(1);
    expect(onClickPending).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm1', paid: false })
    );
  });

  it('clicking a paid movement does nothing', async () => {
    const onClickPending = vi.fn();
    const user = userEvent.setup();
    renderCard({ paid: true }, { onClickPending });

    await user.click(screen.getByText('Food & Groceries'));
    expect(onClickPending).not.toHaveBeenCalled();
  });

  it('hides the action dropdown for movements without a transaction source', () => {
    renderCard({ sourceType: 'payment' });
    expect(
      screen.queryByRole('button', { name: 'Open menu' })
    ).not.toBeInTheDocument();
  });

  it('edits and deletes a transaction movement from the dropdown', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderCard({}, { onEdit, onDelete });

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('renders the pending card at reduced opacity', async () => {
    const { container } = renderCard({ paid: false });
    await waitFor(() =>
      expect(container.firstElementChild?.className).toContain('opacity-60')
    );
  });
});
