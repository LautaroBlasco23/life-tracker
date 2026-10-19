'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { FixedTransaction, Payment, PaymentSummary } from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { showToast } from '@/lib/toast';
import {
  formatCurrency,
  formatInputValue,
  parseInputValue,
} from '@shared/utils/format';
import { Calendar, DollarSign, Trash2, Plus, History } from 'lucide-react';
import { useTranslations } from '@shared/contexts/language-context';
import {
  dateInputToISO,
  formatShortDate,
  todayInput,
} from '@shared/utils/format';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: FixedTransaction | null;
  onPaymentCreated: () => void;
}

export function PaymentModal({
  open,
  onOpenChange,
  transaction,
  onPaymentCreated,
}: PaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayInput());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const t = useTranslations('paymentModal');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (transaction && open) {
      loadTransactionDetails();
    }
  }, [transaction, open]);

  const loadTransactionDetails = async () => {
    if (!transaction) return;

    setIsLoadingDetails(true);
    try {
      const details = await financeService.getFixedTransactionWithPayments(
        transaction.id
      );
      setPayments(details.payments || []);
      setTotalPaid(details.totalPaid);
    } catch (error) {
      console.error('Failed to load transaction details:', error);
      setPayments([]);
      setTotalPaid(transaction.totalPaid);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setDate(todayInput());
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputValue(e.target.value);
    setAmount(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    const numericAmount = parseInputValue(amount);
    const amountValue = parseFloat(numericAmount);

    if (isNaN(amountValue) || amountValue <= 0) {
      showToast({
        title: tCommon('error'),
        description: t('invalidAmount'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await financeService.createPayment({
        transactionId: transaction.id,
        amount: amountValue,
        date: dateInputToISO(date),
      });

      showToast({
        title: t('paymentRecorded'),
        description: t('paymentRecordedDescription', {
          amount: formatCurrency(amountValue),
        }),
      });

      resetForm();
      onPaymentCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Create payment error:', error);
      showToast({
        title: t('paymentFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      await financeService.deletePayment(paymentId);
      showToast({
        title: t('paymentDeleted'),
        description: t('paymentDeletedDescription'),
      });
      onPaymentCreated();
      await loadTransactionDetails();
    } catch (error) {
      showToast({
        title: t('deleteFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      resetForm();
      setPayments([]);
    }
    onOpenChange(newOpen);
  };

  if (!transaction) return null;

  const isIncome = transaction.type === 'income';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {isIncome ? t('descriptionIncome') : t('descriptionExpense')}
          </DialogDescription>
        </DialogHeader>

        <Card className="bg-muted/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">
                  {transaction.category}
                </CardTitle>
                {transaction.description && (
                  <CardDescription className="mt-1">
                    {transaction.description}
                  </CardDescription>
                )}
              </div>
              <Badge variant={isIncome ? 'default' : 'destructive'}>
                {t(transaction.type)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('totalPaid')}</span>
              <span
                className={`font-semibold ${
                  isIncome ? 'text-success' : 'text-danger'
                }`}
              >
                ${formatCurrency(totalPaid)}
              </span>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">{t('amount')}</Label>
              <Input
                id="payment-amount"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={handleAmountChange}
                required
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-date">{t('date')}</Label>
              <Input
                id="payment-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="bg-input border-border"
              />
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              t('recording')
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                {t('recordPayment')}
              </>
            )}
          </Button>
        </form>

        {payments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4" />
                {t('paymentHistory', { count: payments.length })}
              </div>

              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-2">
                  {isLoadingDetails ? (
                    <div className="text-center text-muted-foreground py-4">
                      {t('loadingPayments')}
                    </div>
                  ) : (
                    payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-muted-foreground text-sm">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatShortDate(new Date(payment.date))}
                          </div>
                          <span
                            className={`font-medium ${
                              isIncome ? 'text-success' : 'text-danger'
                            }`}
                          >
                            ${formatCurrency(payment.amount)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeletePayment(payment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
