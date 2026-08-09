'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { financeService } from '@/services/finance-service';
import { showToast } from '@/lib/toast';
import type {
  Transaction,
  TransactionType,
  TransactionFrequency,
  PaymentFrequency,
  Category,
} from '@/types';
import { formatInputValue, parseInputValue } from '@/utils/formatNumbers';
import { useTranslations } from '@/contexts/language-context';

interface EditTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onTransactionUpdated: (transaction: Transaction) => void;
  categories: Category[];
}

export function EditTransactionModal({
  open,
  onOpenChange,
  transaction,
  onTransactionUpdated,
  categories,
}: EditTransactionModalProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('outcome');
  const [frequency, setFrequency] = useState<TransactionFrequency>('variable');
  const [paymentFrequency, setPaymentFrequency] =
    useState<PaymentFrequency>('monthly');
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const t = useTranslations('createTransaction');
  const tCommon = useTranslations('common');
  const tFinance = useTranslations('finance');
  const tFinanceCategories = useTranslations('financeCategories');

  const isFixed = frequency === 'fixed';

  useEffect(() => {
    if (transaction && open) {
      setDescription(transaction.description || '');
      setAmount(
        transaction.amount > 0
          ? formatInputValue(Math.floor(transaction.amount).toString())
          : ''
      );
      setType(transaction.type);
      setFrequency(transaction.frequency);
      setPaymentFrequency(transaction.paymentFrequency || 'monthly');
      setCategory(transaction.category);
      setDate(new Date(transaction.date).toISOString().split('T')[0]);
    }
  }, [transaction, open]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setType('outcome');
    setFrequency('variable');
    setPaymentFrequency('monthly');
    setCategory(null);
    setDate('');
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (category) {
      const currentCategory = categories.find((cat) => cat.name === category);
      if (currentCategory?.type !== newType) {
        setCategory(null);
      }
    }
  };

  const handleFrequencyChange = (newFrequency: TransactionFrequency) => {
    setFrequency(newFrequency);
    setCategory(null);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputValue(e.target.value);
    setAmount(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    if (!category) {
      showToast({
        title: t('validationError'),
        description: t('selectCategoryError'),
        variant: 'destructive',
      });
      return;
    }

    let amountValue = 0;
    if (!isFixed && amount) {
      const numericAmount = parseInputValue(amount);
      amountValue = parseFloat(numericAmount);

      if (isNaN(amountValue) || amountValue <= 0) {
        showToast({
          title: t('validationError'),
          description: t('invalidAmountError'),
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      const updatedTransaction = await financeService.updateTransaction(
        transaction.id,
        {
          type,
          frequency,
          paymentFrequency: isFixed ? paymentFrequency : undefined,
          amount: amountValue,
          category,
          description,
          date: new Date(date).toISOString(),
        }
      );

      onTransactionUpdated(updatedTransaction);
      showToast({
        title: tFinance('transactionUpdated') || 'Transaction updated',
        description:
          tFinance('transactionUpdatedDescription') ||
          'Your transaction has been successfully updated.',
      });
      onOpenChange(false);
    } catch (error) {
      showToast({
        title: tCommon('error'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  if (!transaction) return null;

  const filteredCategories = categories.filter((cat) => cat.type === type);

  const translateCategory = (catName: string) => {
    return tFinanceCategories(catName);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {tFinance('editTransaction') || 'Edit Transaction'}
          </DialogTitle>
          <DialogDescription>{t('descriptionNew')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-description">{t('descriptionLabel')}</Label>
            <Textarea
              id="edit-description"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-input border-border resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-type">{t('type')}</Label>
            <Select
              value={type}
              onValueChange={(value: TransactionType) =>
                handleTypeChange(value)
              }
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">{t('income')}</SelectItem>
                <SelectItem value="outcome">{t('expense')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-frequency">{t('frequency')}</Label>
            <Select
              value={frequency}
              onValueChange={(value: TransactionFrequency) =>
                handleFrequencyChange(value)
              }
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">{t('fixed')}</SelectItem>
                <SelectItem value="variable">{t('variable')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isFixed && (
            <div className="space-y-2">
              <Label htmlFor="edit-paymentFrequency">
                {t('paymentFrequency')}
              </Label>
              <Select
                value={paymentFrequency}
                onValueChange={(value: PaymentFrequency) =>
                  setPaymentFrequency(value)
                }
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t('monthly')}</SelectItem>
                  <SelectItem value="bimonthly">{t('bimonthly')}</SelectItem>
                  <SelectItem value="yearly">{t('yearly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!isFixed && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-amount">{t('amount')}</Label>
                <Input
                  id="edit-amount"
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
                <Label htmlFor="edit-date">{t('date')}</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="bg-input border-border"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-category">{t('category')}</Label>
            <Select
              value={category || ''}
              onValueChange={(value) => setCategory(value)}
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder={t('selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name}>
                    {translateCategory(cat.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? tCommon('updating')
                : tFinance('updateTransaction') || 'Update Transaction'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
