import type {
  Transaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  FinanceSummary,
  Category,
  MonthlyStats,
  TransactionType,
  TransactionFrequency,
  FixedTransaction,
  Payment,
  CreatePaymentRequest,
} from '@/types';
import { authService } from './auth-service';
import { getConfig } from '@/lib/config';

interface ApiResponse<T> {
  message: string;
  data: T;
  count?: number;
  year?: number;
}

interface GetTransactionsParams {
  type?: TransactionType;
  frequency?: TransactionFrequency;
  startDate?: string;
  endDate?: string;
  month?: number;
  year?: number;
  category?: string;
  limit?: number;
}

interface GetFixedTransactionsParams {
  month?: number;
  year?: number;
}

interface GetPaymentsParams {
  transactionId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

class FinanceService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  async getCategories(
    type?: TransactionType,
    frequency?: TransactionFrequency
  ): Promise<Category[]> {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (frequency) params.append('frequency', frequency);

    const queryString = params.toString();
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/categories${queryString ? `?${queryString}` : ''}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }

    const result: ApiResponse<Category[]> = await response.json();
    return result.data;
  }

  async getTransactions(
    params?: GetTransactionsParams
  ): Promise<Transaction[]> {
    const searchParams = new URLSearchParams();

    if (params?.type) searchParams.append('type', params.type);
    if (params?.frequency) searchParams.append('frequency', params.frequency);
    if (params?.startDate) searchParams.append('start_date', params.startDate);
    if (params?.endDate) searchParams.append('end_date', params.endDate);
    if (params?.month !== undefined)
      searchParams.append('month', params.month.toString());
    if (params?.year !== undefined)
      searchParams.append('year', params.year.toString());
    if (params?.category !== undefined)
      searchParams.append('category', params.category);
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/transactions?${searchParams.toString()}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }

    const result: ApiResponse<Transaction[]> = await response.json();
    return result.data;
  }

  async getTransactionById(id: string): Promise<Transaction> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/transactions/${id}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch transaction');
    }

    const result: ApiResponse<Transaction> = await response.json();
    return result.data;
  }

  async createTransaction(
    data: CreateTransactionRequest
  ): Promise<Transaction> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/transactions`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          date: data.date || new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create transaction');
    }

    const result: ApiResponse<Transaction> = await response.json();
    return result.data;
  }

  async updateTransaction(
    id: string,
    data: UpdateTransactionRequest
  ): Promise<Transaction> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/transactions/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update transaction');
    }

    const result: ApiResponse<Transaction> = await response.json();
    return result.data;
  }

  async deleteTransaction(id: string): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/transactions/${id}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete transaction');
    }
  }

  async getFixedTransactions(
    params?: GetFixedTransactionsParams
  ): Promise<FixedTransaction[]> {
    const searchParams = new URLSearchParams();

    if (params?.month !== undefined)
      searchParams.append('month', params.month.toString());
    if (params?.year !== undefined)
      searchParams.append('year', params.year.toString());

    const queryString = searchParams.toString();
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/fixed-transactions${queryString ? `?${queryString}` : ''}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch fixed transactions');
    }

    const result: ApiResponse<FixedTransaction[]> = await response.json();
    return result.data;
  }

  async getFixedTransactionWithPayments(id: string): Promise<FixedTransaction> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/fixed-transactions/${id}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch fixed transaction');
    }

    const result: ApiResponse<FixedTransaction> = await response.json();
    return result.data;
  }

  async createPayment(data: CreatePaymentRequest): Promise<Payment> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/payments`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          date: data.date || new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create payment');
    }

    const result: ApiResponse<Payment> = await response.json();
    return result.data;
  }

  async getPayments(params?: GetPaymentsParams): Promise<Payment[]> {
    const searchParams = new URLSearchParams();

    if (params?.transactionId)
      searchParams.append('transaction_id', params.transactionId);
    if (params?.startDate) searchParams.append('start_date', params.startDate);
    if (params?.endDate) searchParams.append('end_date', params.endDate);
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const queryString = searchParams.toString();
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/payments${queryString ? `?${queryString}` : ''}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch payments');
    }

    const result: ApiResponse<Payment[]> = await response.json();
    return result.data;
  }

  async deletePayment(id: string): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/payments/${id}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete payment');
    }
  }

  async getFinanceSummary(
    startDate: string,
    endDate: string
  ): Promise<FinanceSummary> {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/summary?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch summary');
    }

    const result: ApiResponse<FinanceSummary> = await response.json();
    return result.data;
  }

  async getMonthlyStats(year?: number): Promise<MonthlyStats[]> {
    const params = year ? `?year=${year}` : '';
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/finances/monthly-stats${params}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch monthly stats');
    }

    const result: ApiResponse<MonthlyStats[]> = await response.json();
    return result.data;
  }
}

export const financeService = new FinanceService();
