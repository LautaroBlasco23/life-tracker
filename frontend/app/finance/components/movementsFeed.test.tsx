import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Movement } from '@shared/types';
import { showToast } from '@/lib/toast';
import { MovementsFeed } from './movementsFeed';

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

// Mocking the shared context keeps this test on the component's own logic and
// avoids a second React copy (the workspace root installs React for mobile).
vi.mock('@shared/contexts/language-context', () => ({
  useTranslations:
    (namespace: string) => (key: string, vars?: Record<string, string>) => {
      const finance: Record<string, string> = {
        noMovementsMatch: 'No transactions match your filters',
        noMovementsYet: 'No transactions yet',
        movementsGetStarted:
          'Add your first transaction to start tracking your money.',
        tryAdjusting: 'Try adjusting your filters',
        addMovement: 'Add transaction',
        showMore: 'Show more',
        today: 'Today',
        yesterday: 'Yesterday',
      };
      const common: Record<string, string> = {
        clearFilters: 'Clear filters',
        clearAll: 'Clear all',
        activeFilters: 'Active filters:',
        filters: 'Filters',
      };
      const ns = namespace === 'common' ? common : finance;
      return (ns[key] ?? key).replace(
        /\{(\w+)\}/g,
        (_, name) => vars?.[name] ?? `{${name}}`
      );
    },
}));

// Real shared translations (en fallback); day in the past so the group label is a plain date, never Today/Yesterday.
const DAY = new Date(2026, 0, 15, 12);

const movement = (overrides: Partial<Movement> & { id: string }): Movement => ({
  sourceType: 'transaction',
  type: 'outcome',
  amount: 25,
  category: 'Food & Groceries',
  date: new Date(2026, 0, 15, 12, 30).toISOString(),
  paid: true,
  ...overrides,
});

const movements: Movement[] = [
  movement({ id: 'm1' }),
  movement({ id: 'm2', date: new Date(2026, 0, 15, 18, 0).toISOString() }),
  movement({ id: 'm3', category: 'Transportation', type: 'income' }),
  movement({
    id: 'm4',
    date: new Date(2026, 0, 14, 9, 0).toISOString(),
  }),
];

function renderFeed(props: Partial<Parameters<typeof MovementsFeed>[0]> = {}) {
  return render(
    <MovementsFeed
      movements={movements}
      categoryIcons={{ 'Food & Groceries': '🍔' }}
      isLoading={false}
      isLoadingMore={false}
      hasMore={false}
      filterCount={0}
      onShowMore={vi.fn()}
      onClearFilters={vi.fn()}
      onAddMovement={vi.fn()}
      onClickPending={vi.fn()}
      onEditMovement={vi.fn()}
      onDeleteMovement={vi.fn()}
      {...props}
    />
  );
}

describe('MovementsFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing while the first load is in flight', () => {
    const { container } = renderFeed({
      movements: [],
      isLoading: true,
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the existing list visible while refetching after a mutation', () => {
    renderFeed({ isLoading: true });
    expect(screen.getAllByText(/Food & Groceries|Transportation/).length).toBe(
      4
    );
  });

  it('groups movements by day with a header per day', () => {
    renderFeed();

    const headers = screen.getAllByText(/^January \d+$/);
    expect(headers).toHaveLength(2);
    expect(screen.getByText('January 15')).toBeInTheDocument();
    expect(screen.getByText('January 14')).toBeInTheDocument();
  });

  it('renders every movement inside its day group', () => {
    renderFeed();
    expect(screen.getAllByText('Food & Groceries')).toHaveLength(3);
    expect(screen.getAllByText('Transportation')).toHaveLength(1);
  });

  it('shows the empty state without filters and opens the add flow', async () => {
    const onAddMovement = vi.fn();
    const user = userEvent.setup();
    renderFeed({ movements: [], onAddMovement });

    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Add your first transaction to start tracking your money.'
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add transaction/ }));
    expect(onAddMovement).toHaveBeenCalledTimes(1);
  });

  it('shows the filtered empty state and clears filters from there', async () => {
    const onClearFilters = vi.fn();
    const user = userEvent.setup();
    renderFeed({ movements: [], filterCount: 1, onClearFilters });

    expect(
      screen.getByText('No transactions match your filters')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('offers Show more only when there are more pages and disables it while loading', async () => {
    const onShowMore = vi.fn();
    const user = userEvent.setup();
    const { rerender } = renderFeed({ hasMore: true, onShowMore });

    const showMore = screen.getByRole('button', { name: /Show more/ });
    await user.click(showMore);
    expect(onShowMore).toHaveBeenCalledTimes(1);

    rerender(
      <MovementsFeed
        movements={movements}
        categoryIcons={{}}
        isLoading={false}
        isLoadingMore
        hasMore
        filterCount={0}
        onShowMore={vi.fn()}
        onClearFilters={vi.fn()}
        onAddMovement={vi.fn()}
        onClickPending={vi.fn()}
        onEditMovement={vi.fn()}
        onDeleteMovement={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Show more/ })).toBeDisabled();
  });

  it('does not offer Show more when everything is loaded', () => {
    renderFeed({ hasMore: false });
    expect(screen.queryByText('Show more')).not.toBeInTheDocument();
  });
});
