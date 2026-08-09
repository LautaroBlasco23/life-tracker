'use client';

import { useState } from 'react';
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
import type {
  Transaction,
  TransactionType,
  TransactionFrequency,
  PaymentFrequency,
  Category,
} from '@/types';
import { financeService } from '@/services/finance-service';
import { showToast } from '@/lib/toast';
import { formatInputValue, parseInputValue } from '@/utils/formatNumbers';
import { useTranslations } from '@/contexts/language-context';

interface CreateTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionCreated: (transaction: Transaction) => void;
  categories: Category[];
  defaultFrequency: TransactionFrequency;
}

export function CreateTransactionModal({
  open,
  onOpenChange,
  onTransactionCreated,
  categories,
  defaultFrequency,
}: CreateTransactionModalProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('outcome');
  const [frequency, setFrequency] =
    useState<TransactionFrequency>(defaultFrequency);
  const [paymentFrequency, setPaymentFrequency] =
    useState<PaymentFrequency>('monthly');
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  const t = useTranslations('createTransaction');
  const tCommon = useTranslations('common');
  const tFinanceCategories = useTranslations('financeCategories');

  const isFixed = frequency === 'fixed';

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setType('outcome');
    setFrequency(defaultFrequency);
    setPaymentFrequency('monthly');
    setCategory(null);
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategory(null);
  };

  const handleFrequencyChange = (newFrequency: TransactionFrequency) => {
    setFrequency(newFrequency);
    setCategory(null);
    if (newFrequency === 'fixed') {
      setAmount('');
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputValue(e.target.value);
    setAmount(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const newTransaction = await financeService.createTransaction({
        type,
        frequency,
        paymentFrequency: isFixed ? paymentFrequency : undefined,
        amount: amountValue,
        category,
        description,
        date: new Date(date).toISOString(),
      });

      onTransactionCreated(newTransaction);
      resetForm();
      showToast({
        title: t('transactionCreated'),
        description: isFixed
          ? t('fixedCreatedDescription')
          : t('variableCreatedDescription'),
      });
    } catch (error) {
      console.error('Create transaction error:', error);
      showToast({
        title: t('creationFailed'),
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

  const filteredCategories = categories.filter((cat) => cat.type === type);

  const translateCategory = (catName: string) => {
    return tFinanceCategories(catName);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isFixed ? t('titleFixed') : t('titleNew')}</DialogTitle>
          <DialogDescription>
            {isFixed ? t('descriptionFixed') : t('descriptionNew')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">{t('descriptionLabel')}</Label>
            <Textarea
              id="description"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-input border-border resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">{t('type')}</Label>
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
            <Label htmlFor="frequency">{t('frequency')}</Label>
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
              <Label htmlFor="paymentFrequency">{t('paymentFrequency')}</Label>
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
              <p className="text-xs text-muted-foreground">
                {t('paymentFrequencyHint')}
              </p>
            </div>
          )}

          {!isFixed && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">{t('amount')}</Label>
                <Input
                  id="amount"
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
                <Label htmlFor="date">{t('date')}</Label>
                <Input
                  id="date"
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
            <Label htmlFor="category">{t('category')}</Label>
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
                ? t('creating')
                : isFixed
                  ? t('createFixed')
                  : t('createTransaction')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
