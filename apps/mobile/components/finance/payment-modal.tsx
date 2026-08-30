import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import type { FixedTransaction, PaymentSummary } from '@shared/types/finance';
import { financeService, useTranslations } from '@shared';
import { dateInputToISO, formatCurrency, formatInputValue, formatShortDate, parseInputValue, todayInput } from '@shared/utils/format';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  transaction: FixedTransaction | null;
}

export function PaymentModal({ visible, onClose, onSaved, transaction }: PaymentModalProps) {
  const t = useTranslations('paymentModal');
  const tCommon = useTranslations('common');

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayInput());
  const [isSaving, setIsSaving] = useState(false);
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (!visible || !transaction) return;
    setAmount('');
    setDate(todayInput());
    setIsLoadingDetails(true);
    financeService
      .getFixedTransactionWithPayments(transaction.id)
      .then((details) => {
        setPayments(details.payments ?? []);
        setTotalPaid(details.totalPaid);
      })
      .catch(() => Alert.alert(tCommon('error')))
      .finally(() => setIsLoadingDetails(false));
  }, [visible, transaction]);

  const handleRecord = async () => {
    if (!transaction) return;
    const amountValue = parseFloat(parseInputValue(amount));
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert(t('invalidAmount'));
      return;
    }
    setIsSaving(true);
    try {
      await financeService.createPayment({
        transactionId: transaction.id,
        amount: amountValue,
        date: dateInputToISO(date),
      });
      onSaved();
      onClose();
    } catch {
      Alert.alert(tCommon('error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePayment = (paymentId: string) => {
    Alert.alert(tCommon('delete'), undefined, [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: tCommon('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await financeService.deletePayment(paymentId);
            setPayments((prev) => prev.filter((p) => p.id !== paymentId));
          } catch {
            Alert.alert(t('deleteFailed'));
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-1">
            {t('title')}
          </Text>
          {transaction?.description ? (
            <Text className="text-sm text-muted dark:text-dark-muted mb-2">
              {transaction.description}
            </Text>
          ) : null}
          <Text className="text-sm text-muted dark:text-dark-muted mb-4">
            {t('totalPaid')}: ${formatCurrency(totalPaid)}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            <FormField
              label={t('amount')}
              placeholder="0"
              value={amount}
              onChangeText={(text) => setAmount(formatInputValue(text))}
              keyboardType="number-pad"
            />
            <View className="h-4" />
            <FormField label={t('date')} placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />

            <Button className="mt-5" onPress={handleRecord} loading={isSaving}>
              {t('recordPayment')}
            </Button>

            {isLoadingDetails ? (
              <Text className="text-sm text-muted dark:text-dark-muted mt-5">{tCommon('loading')}</Text>
            ) : payments.length > 0 ? (
              <View className="mt-6">
                <Text className="text-sm font-medium text-foreground dark:text-dark-foreground mb-2">
                  {t('paymentHistory', { count: payments.length })}
                </Text>
                {payments.map((payment) => (
                  <View
                    key={payment.id}
                    className="flex-row items-center justify-between py-2 border-b border-border dark:border-dark-border"
                  >
                    <Text className="text-sm text-muted dark:text-dark-muted">
                      {formatShortDate(new Date(payment.date))}
                    </Text>
                    <View className="flex-row items-center gap-3">
                      <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                        ${formatCurrency(payment.amount)}
                      </Text>
                      <Button
                        variant="ghost"
                        className="h-8 px-2"
                        textClassName="text-danger dark:text-dark-danger text-xs"
                        onPress={() => handleDeletePayment(payment.id)}
                      >
                        {tCommon('delete')}
                      </Button>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            <View className="h-4" />
            <Button variant="outline" onPress={onClose}>
              {tCommon('close')}
            </Button>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
