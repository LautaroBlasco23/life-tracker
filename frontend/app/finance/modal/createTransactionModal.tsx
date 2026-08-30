'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  PaymentFrequency,
  Category,
} from '@shared/types';
import { financeService } from '@shared/services/finance-service';
import { showToast } from '@/lib/toast';
import { formatInputValue, parseInputValue } from '@shared/utils/format';
import { dateInputToISO, todayInput } from '@shared/utils/format';
import { useTranslations } from '@shared/contexts/language-context';

interface CreateTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionCreated: (transaction: Transaction) => void;
  categories: Category[];
  defaultRecurring?: boolean;
}

export function CreateTransactionModal({
  open,
  onOpenChange,
  onTransactionCreated,
  categories,
  defaultRecurring = false,
}: CreateTransactionModalProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('outcome');
  const [isRecurring, setIsRecurring] = useState(defaultRecurring);
  const [paymentFrequency, setPaymentFrequency] =
    useState<PaymentFrequency>('monthly');
  const [category, setCategory] = useState<string | null>(null);
  const [recordNow, setRecordNow] = useState(true);
  const [date, setDate] = useState(todayInput());
  const [isLoading, setIsLoading] = useState(false);

  const t = useTranslations('createTransaction');
  const tCommon = useTranslations('common');

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setType('outcome');
    setIsRecurring(defaultRecurring);
    setPaymentFrequency('monthly');
    setCategory(null);
    setRecordNow(true);
    setDate(todayInput());
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategory(null);
  };

  const handleRecurringChange = (recurring: boolean) => {
    setIsRecurring(recurring);
    setCategory(null);
    if (recurring) {
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
    if (!isRecurring && amount) {
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
        frequency: isRecurring ? 'fixed' : 'variable',
        paymentFrequency: isRecurring ? paymentFrequency : undefined,
        amount: amountValue,
        category,
        description,
        date: recordNow ? undefined : dateInputToISO(date),
      });

      onTransactionCreated(newTransaction);
      resetForm();
      showToast({
        title: t('transactionCreated'),
        description: isRecurring
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

  const filteredCategories = categories.filter(
    (cat) =>
      cat.type === type &&
      (cat.applicableToFreq === (isRecurring ? 'fixed' : 'variable') ||
        !cat.applicableToFreq)
  );

  const categoryOptions =
    filteredCategories.length > 0
      ? filteredCategories
      : categories.filter((cat) => cat.type === type);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isRecurring ? t('titleFixed') : t('titleNew')}
          </DialogTitle>
          <DialogDescription>
            {isRecurring ? t('descriptionFixed') : t('descriptionNew')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">{t('type')}</Label>
              <Select
                value={type}
                onValueChange={(value: TransactionType) =>
                  handleTypeChange(value)
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t('income')}</SelectItem>
                  <SelectItem value="outcome">{t('expense')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium leading-none">
                {t('date')}
              </span>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <Label htmlFor="recordNow" className="cursor-pointer">
                    {t('rightNow')}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('rightNowHint')}
                  </p>
                </div>
                <Switch
                  id="recordNow"
                  checked={recordNow}
                  onCheckedChange={setRecordNow}
                />
              </div>
              {!recordNow && (
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="bg-input border-border"
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">{t('amount')}</Label>
            <Input
              id="amount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={handleAmountChange}
              disabled={isRecurring}
              required={!isRecurring}
              className="bg-input border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t('category')}</Label>
            <Select
              value={category || ''}
              onValueChange={(value) => setCategory(value)}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder={t('selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name}>
                    {cat.icon ? `${cat.icon} ` : ''}
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div>
              <Label htmlFor="recurring" className="cursor-pointer">
                {t('recurring')}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t('recurringHint')}
              </p>
            </div>
            <Switch
              id="recurring"
              checked={isRecurring}
              onCheckedChange={handleRecurringChange}
            />
          </div>

          {isRecurring && (
            <div className="space-y-2">
              <Label htmlFor="paymentFrequency">{t('paymentFrequency')}</Label>
              <Select
                value={paymentFrequency}
                onValueChange={(value: PaymentFrequency) =>
                  setPaymentFrequency(value)
                }
              >
                <SelectTrigger id="paymentFrequency">
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
                : isRecurring
                  ? t('createFixed')
                  : t('createTransaction')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
