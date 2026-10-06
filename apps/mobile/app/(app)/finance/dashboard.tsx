import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { FixedTransaction } from '@shared/types/finance';
import { financeService, useTranslations } from '@shared';
import { Navigation } from '../../../components/navigation';
import { FinanceDashboard } from '../../../components/finance/finance-dashboard';
import { PaymentModal } from '../../../components/finance/payment-modal';
import { useTheme } from '../../../lib/theme-provider';
import { useColors } from '../../../lib/use-colors';

/** /finance/dashboard — summary, monthly stats and fixed payments (web parity). */
export default function FinanceDashboardScreen() {
  const t = useTranslations('finance');
  const { theme } = useTheme();
  const colors = useColors();

  const [fixedTransactions, setFixedTransactions] = useState<FixedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentFor, setPaymentFor] = useState<FixedTransaction | null>(null);

  const loadFixed = useCallback(async () => {
    try {
      setFixedTransactions(await financeService.getFixedTransactions());
    } catch {
      // Dashboard summary still renders; fixed list just stays empty.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFixed();
    }, [loadFixed])
  );

  return (
    <View className="flex-1 relative bg-background dark:bg-dark-background">
      <Navigation />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View className="flex-1 p-4">
          <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
            {t('dashboard')}
          </Text>
          <Text className="text-sm text-muted dark:text-dark-muted mt-1 mb-4">{t('description')}</Text>
          <FinanceDashboard
            fixedTransactions={fixedTransactions}
            onRecordPayment={setPaymentFor}
          />
        </View>
      )}

      <PaymentModal
        visible={paymentFor !== null}
        onClose={() => setPaymentFor(null)}
        onSaved={loadFixed}
        transaction={paymentFor}
      />
    </View>
  );
}
