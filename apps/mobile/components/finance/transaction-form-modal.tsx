import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import type { Category, PaymentFrequency, Transaction, TransactionType } from '@shared/types/finance';
import { financeService, useTranslations } from '@shared';
import { dateInputToISO, formatInputValue, parseInputValue, todayInput } from '@shared/utils/format';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { OptionSelect } from '../ui/option-select';

interface TransactionFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** When set, the modal edits this transaction instead of creating one. */
  transaction?: Transaction | null;
  categories: Category[];
}

const PAYMENT_FREQUENCIES: PaymentFrequency[] = ['monthly', 'bimonthly', 'yearly'];

export function TransactionFormModal({
  visible,
  onClose,
  onSaved,
  transaction,
  categories,
}: TransactionFormModalProps) {
  const t = useTranslations('createTransaction');
  const tCommon = useTranslations('common');

  const [type, setType] = useState<TransactionType>('outcome');
  const [isFixed, setIsFixed] = useState(false);
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('monthly');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayInput());
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = transaction !== null && transaction !== undefined;

  useEffect(() => {
    if (!visible) return;
    if (transaction) {
      setType(transaction.type);
      setIsFixed(transaction.frequency === 'fixed');
      setPaymentFrequency(transaction.paymentFrequency ?? 'monthly');
      setAmount(transaction.amount > 0 ? formatInputValue(String(transaction.amount)) : '');
      setCategory(transaction.category);
      setDescription(transaction.description ?? '');
    } else {
      setType('outcome');
      setIsFixed(false);
      setPaymentFrequency('monthly');
      setAmount('');
      setCategory(null);
      setDescription('');
      setDate(todayInput());
    }
  }, [visible, transaction]);

  const typeOptions = [
    { value: 'outcome' as const, label: t('expense') },
    { value: 'income' as const, label: t('income') },
  ];
  const frequencyOptions = [
    { value: 'variable' as const, label: t('variable') },
    { value: 'fixed' as const, label: t('fixed') },
  ];
  const paymentFrequencyOptions = PAYMENT_FREQUENCIES.map((f) => ({
    value: f,
    label: t(f),
  }));
  const categoryOptions = categories
    .filter((c) => c.type === type)
    .map((c) => ({ value: c.name, label: c.name }));

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert(t('validationError'), t('selectCategoryError'));
      return;
    }
    const amountValue = isFixed ? 0 : parseFloat(parseInputValue(amount));
    if (!isFixed && (isNaN(amountValue) || amountValue <= 0)) {
      Alert.alert(t('validationError'), t('invalidAmountError'));
      return;
    }
    setIsSaving(true);
    try {
      if (isEditing && transaction) {
        await financeService.updateTransaction(transaction.id, {
          type,
          frequency: isFixed ? 'fixed' : 'variable',
          paymentFrequency: isFixed ? paymentFrequency : undefined,
          amount: amountValue,
          category,
          description: description.trim() || undefined,
        });
      } else {
        await financeService.createTransaction({
          type,
          frequency: isFixed ? 'fixed' : 'variable',
          paymentFrequency: isFixed ? paymentFrequency : undefined,
          amount: amountValue,
          category,
          description: description.trim() || undefined,
          date: dateInputToISO(date),
        });
      }
      onSaved();
      onClose();
    } catch {
      Alert.alert(tCommon('error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
            {isEditing
              ? t('updateTransaction')
              : isFixed
                ? t('titleFixed')
                : t('titleNew')}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <OptionSelect label={t('type')} value={type} options={typeOptions} onSelect={setType} />
            <View className="h-4" />
            <OptionSelect
              label={t('frequency')}
              value={isFixed ? 'fixed' : 'variable'}
              options={frequencyOptions}
              onSelect={(v) => setIsFixed(v === 'fixed')}
            />
            {isFixed ? (
              <>
                <View className="h-4" />
                <OptionSelect
                  label={t('paymentFrequency')}
                  value={paymentFrequency}
                  options={paymentFrequencyOptions}
                  onSelect={setPaymentFrequency}
                />
              </>
            ) : null}
            <View className="h-4" />
            {!isFixed ? (
              <>
                <FormField
                  label={t('amount')}
                  placeholder="0"
                  value={amount}
                  onChangeText={(text) => setAmount(formatInputValue(text))}
                  keyboardType="number-pad"
                />
                <View className="h-4" />
                <FormField label={t('date')} placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
                <View className="h-4" />
              </>
            ) : null}
            <OptionSelect
              label={t('category')}
              value={category}
              options={categoryOptions}
              onSelect={setCategory}
              placeholder={t('selectCategory')}
            />
            <View className="h-4" />
            <FormField
              label={t('descriptionLabel')}
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
            />
            <View className="flex-row gap-3 mt-6 mb-2">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                {tCommon('cancel')}
              </Button>
              <Button className="flex-1" onPress={handleSubmit} loading={isSaving}>
                {isEditing ? tCommon('save') : tCommon('creating')}
              </Button>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
