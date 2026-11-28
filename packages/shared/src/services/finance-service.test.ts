import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorageAdapter } from '../lib/storage';

// Services are module singletons hydrating from storage at import time; the
// in-memory adapter must be installed before the imports below.

const store = new Map<string, string>();
setStorageAdapter({
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
});

const { authService } = await import('./auth-service');
const { financeService } = await import('./finance-service');
import type { Transaction } from '../types';

const API_URL = 'http://test-api';

const user = {
  id: 1,
  username: 'tester',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const transaction: Transaction = {
  id: 'tx-1',
  userId: 1,
  type: 'outcome',
  frequency: 'variable',
  amount: 25.5,
  category: 'Food & Groceries',
  description: 'Groceries',
  date: '2026-11-01T00:00:00Z',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const tokens = (accessToken = 'access-1', refreshToken = 'refresh-1') => ({
  accessToken,
  refreshToken,
  expiresIn: 3600,
  tokenType: 'Bearer',
});

beforeEach(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_URL);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 500 }))
  );

  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ data: { tokens: tokens(), user }, message: 'ok' })
  );
  await authService.login({ identifier: 'test@example.com', password: 'secret' });
  vi.mocked(fetch).mockClear();
});

afterEach(async () => {
  await authService.logout();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  store.clear();
});

describe('financeService.getCategories', () => {
  it('fetches categories without a query string when unfiltered', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: [{ name: 'Food & Groceries', type: 'outcome' }], message: 'ok' })
    );

    const categories = await financeService.getCategories();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/categories`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(categories).toEqual([{ name: 'Food & Groceries', type: 'outcome' }]);
  });

  it('appends type and frequency filters to the query string', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], message: 'ok' }));

    await financeService.getCategories('income', 'fixed');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/categories?type=income&frequency=fixed`);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(financeService.getCategories()).rejects.toThrow(
      'Failed to fetch categories'
    );
  });
});

describe('financeService.getTransactions', () => {
  it('requests transactions with an empty query string when no params', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [transaction], message: 'ok' })
    );

    const result = await financeService.getTransactions();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/transactions?`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual([transaction]);
  });

  it('maps every filter to its snake_case query param', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], message: 'ok' }));

    await financeService.getTransactions({
      type: 'income',
      frequency: 'variable',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      month: 3,
      year: 2026,
      category: 'Side Income',
      limit: 10,
    });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      `${API_URL}/finances/transactions?type=income&frequency=variable&start_date=2026-01-01&end_date=2026-01-31&month=3&year=2026&category=Side+Income&limit=10`
    );
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(financeService.getTransactions()).rejects.toThrow(
      'Failed to fetch transactions'
    );
  });
});

describe('financeService.getTransactionById', () => {
  it('fetches a single transaction by id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: transaction, message: 'ok' })
    );

    const result = await financeService.getTransactionById('tx-1');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/transactions/tx-1`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual(transaction);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 404 }));

    await expect(financeService.getTransactionById('tx-1')).rejects.toThrow(
      'Failed to fetch transaction'
    );
  });
});

describe('financeService.createTransaction', () => {
  it('posts the payload and defaults a missing date to now', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: transaction, message: 'ok' })
    );

    const result = await financeService.createTransaction({
      type: 'outcome',
      frequency: 'variable',
      amount: 25.5,
      category: 'Food & Groceries',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/transactions`);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    const body = JSON.parse(init?.body as string);
    // Omitted optionals (description, paymentFrequency) are not serialized;
    // date is defaulted to an ISO timestamp of "now".
    expect(body).toEqual({
      type: 'outcome',
      frequency: 'variable',
      amount: 25.5,
      category: 'Food & Groceries',
      date: expect.any(String),
    });
    expect(Math.abs(Date.parse(body.date) - Date.now())).toBeLessThan(1000);
    expect(result).toEqual(transaction);
  });

  it('passes an explicit date through unchanged', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: transaction, message: 'ok' }));

    await financeService.createTransaction({
      type: 'income',
      frequency: 'fixed',
      paymentFrequency: 'monthly',
      amount: 100,
      category: 'Primary Income',
      description: 'Salary',
      date: '2026-02-01T00:00:00Z',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      type: 'income',
      frequency: 'fixed',
      paymentFrequency: 'monthly',
      amount: 100,
      category: 'Primary Income',
      description: 'Salary',
      date: '2026-02-01T00:00:00Z',
    });
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 400 }));

    await expect(
      financeService.createTransaction({
        type: 'income',
        frequency: 'fixed',
        amount: 100,
        category: 'Primary Income',
      })
    ).rejects.toThrow('Failed to create transaction');
  });
});

describe('financeService.updateTransaction', () => {
  it('puts only the provided fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: { ...transaction, amount: 30 }, message: 'ok' })
    );

    const result = await financeService.updateTransaction('tx-1', { amount: 30 });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/transactions/tx-1`);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ amount: 30 });
    expect(result.amount).toBe(30);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 400 }));

    await expect(
      financeService.updateTransaction('tx-1', { amount: 30 })
    ).rejects.toThrow('Failed to update transaction');
  });
});

describe('financeService.deleteTransaction', () => {
  it('sends DELETE without a body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'deleted' }));

    await financeService.deleteTransaction('tx-1');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/transactions/tx-1`);
    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBeUndefined();
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(financeService.deleteTransaction('tx-1')).rejects.toThrow(
      'Failed to delete transaction'
    );
  });
});

describe('financeService.getFixedTransactions', () => {
  it('fetches fixed transactions without a query string when no params', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], message: 'ok' }));

    await financeService.getFixedTransactions();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/fixed-transactions`);
  });

  it('appends month and year to the query string', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], message: 'ok' }));

    await financeService.getFixedTransactions({ month: 11, year: 2026 });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/fixed-transactions?month=11&year=2026`);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(financeService.getFixedTransactions()).rejects.toThrow(
      'Failed to fetch fixed transactions'
    );
  });
});

describe('financeService.getMovements', () => {
  it('maps filters to query params and returns the backend total', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: [], total: 42, message: 'ok' })
    );

    const result = await financeService.getMovements({
      type: 'outcome',
      category: 'Food & Groceries',
      month: 11,
      year: 2026,
      limit: 20,
      offset: 40,
    });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      `${API_URL}/finances/movements?type=outcome&category=Food+%26+Groceries&month=11&year=2026&limit=20&offset=40`
    );
    expect(result).toEqual({ data: [], total: 42 });
  });

  it('falls back to the data length when no total is returned', async () => {
    const movements = [
      { id: 'm-1', sourceType: 'transaction', type: 'outcome', amount: 5, category: 'Food & Groceries', date: '2026-11-01T00:00:00Z', paid: true },
      { id: 'm-2', sourceType: 'payment', type: 'income', amount: 7, category: 'Primary Income', date: '2026-11-02T00:00:00Z', paid: true },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: movements, message: 'ok' }));

    const result = await financeService.getMovements();

    expect(result).toEqual({ data: movements, total: 2 });
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(financeService.getMovements()).rejects.toThrow(
      'Failed to fetch movements'
    );
  });
});

describe('financeService.getFixedTransactionWithPayments', () => {
  it('fetches a fixed transaction with its payments by id', async () => {
    const fixed = {
      id: 'fx-1',
      type: 'outcome',
      paymentFrequency: 'monthly',
      category: 'Housing & Utilities',
      totalPaid: 100,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: fixed, message: 'ok' }));

    const result = await financeService.getFixedTransactionWithPayments('fx-1');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/fixed-transactions/fx-1`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual(fixed);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      financeService.getFixedTransactionWithPayments('fx-1')
    ).rejects.toThrow('Failed to fetch fixed transaction');
  });
});

describe('financeService.createPayment', () => {
  it('posts the payload and defaults a missing date to now', async () => {
    const payment = {
      id: 'pay-1',
      transactionId: 'fx-1',
      amount: 50,
      date: '2026-11-17T00:00:00Z',
      createdAt: '2026-11-17T00:00:00Z',
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: payment, message: 'ok' }));

    const result = await financeService.createPayment({
      transactionId: 'fx-1',
      amount: 50,
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/payments`);
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string);
    expect(body.transactionId).toBe('fx-1');
    expect(body.amount).toBe(50);
    expect(Math.abs(Date.parse(body.date) - Date.now())).toBeLessThan(1000);
    expect(result).toEqual(payment);
  });

  it('surfaces the backend error message when present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'payment exceeds total' }, 400)
    );

    await expect(
      financeService.createPayment({ transactionId: 'fx-1', amount: 99999 })
    ).rejects.toThrow('payment exceeds total');
  });

  it('falls back to the default message on a non-JSON error body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('oops', { status: 500 }));

    await expect(
      financeService.createPayment({ transactionId: 'fx-1', amount: 10 })
    ).rejects.toThrow('Failed to create payment');
  });
});

describe('financeService.getPayments', () => {
  it('fetches payments without a query string when no params', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], message: 'ok' }));

    await financeService.getPayments();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/payments`);
  });

  it('maps filters to snake_case query params', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], message: 'ok' }));

    await financeService.getPayments({
      transactionId: 'fx-1',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      limit: 5,
    });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      `${API_URL}/finances/payments?transaction_id=fx-1&start_date=2026-01-01&end_date=2026-12-31&limit=5`
    );
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(financeService.getPayments()).rejects.toThrow(
      'Failed to fetch payments'
    );
  });
});

describe('financeService.deletePayment', () => {
  it('sends DELETE to the payment url', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'deleted' }));

    await financeService.deletePayment('pay-1');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/payments/pay-1`);
    expect(init?.method).toBe('DELETE');
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(financeService.deletePayment('pay-1')).rejects.toThrow(
      'Failed to delete payment'
    );
  });
});

describe('financeService.getFinanceSummary', () => {
  it('fetches the summary for the given date range', async () => {
    const summary = {
      totalIncome: 100,
      totalOutcome: 25.5,
      balance: 74.5,
      incomeByCategory: [],
      outcomeByCategory: [],
      period: '2026-11',
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: summary, message: 'ok' }));

    const result = await financeService.getFinanceSummary('2026-11-01', '2026-11-30');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/summary?start_date=2026-11-01&end_date=2026-11-30`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual(summary);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      financeService.getFinanceSummary('2026-11-01', '2026-11-30')
    ).rejects.toThrow('Failed to fetch summary');
  });
});

describe('financeService.getMonthlyStats', () => {
  it('requests stats without a year filter by default', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], message: 'ok' }));

    await financeService.getMonthlyStats();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/monthly-stats`);
  });

  it('appends the year filter when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], message: 'ok' }));

    await financeService.getMonthlyStats(2026);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/finances/monthly-stats?year=2026`);
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(financeService.getMonthlyStats()).rejects.toThrow(
      'Failed to fetch monthly stats'
    );
  });
});
