import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { useFinanceCategories } from './use-finance-categories';

vi.mock('@shared/services/finance-service', () => ({
  financeService: {
    getCategories: vi.fn(),
  },
}));

const mockFinanceService = vi.mocked(financeService);

const categories: Category[] = [
  { name: 'Food & Groceries', type: 'outcome', icon: '🍔' },
  { name: 'Primary Income', type: 'income', icon: '💼' },
];

describe('useFinanceCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts empty and loads categories from the service', async () => {
    mockFinanceService.getCategories.mockResolvedValue(categories);

    const { result } = renderHook(() => useFinanceCategories());

    expect(result.current).toEqual([]);
    await waitFor(() => expect(result.current).toEqual(categories));
    expect(mockFinanceService.getCategories).toHaveBeenCalledTimes(1);
  });

  it('keeps the list empty and logs when loading fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockFinanceService.getCategories.mockRejectedValue(
      new Error('network down')
    );

    const { result } = renderHook(() => useFinanceCategories());

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load categories:',
        expect.any(Error)
      )
    );
    expect(result.current).toEqual([]);
    consoleError.mockRestore();
  });
});
