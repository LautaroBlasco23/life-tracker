import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTranslations } from '@shared';
import { Button } from './button';
import { useTheme } from '../../lib/theme-provider';

interface DeleteModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  itemName: string;
  /** Optional extra details (description lines) shown inside the details box. */
  itemDetails?: React.ReactNode;
  /** Loader that performs the deletion; throws to keep the modal open. */
  onConfirm: () => Promise<void>;
  confirmLabel?: string;
}

/** Confirm modal mirroring web's DeleteModal (title, details, confirm loader). */
export function DeleteModal({
  visible,
  onClose,
  title,
  itemName,
  itemDetails,
  onConfirm,
  confirmLabel,
}: DeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations('deleteModal');
  const tCommon = useTranslations('common');
  const { theme } = useTheme();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-black/50 p-6">
        <View className="rounded-2xl bg-background dark:bg-dark-background p-5">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="h-9 w-9 rounded-full bg-danger/10 dark:bg-dark-danger/10 items-center justify-center">
              <AlertTriangle
                size={18}
                color={theme === 'dark' ? '#ff7b72' : '#cf222e'}
              />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground">
                {title}
              </Text>
              <Text className="text-sm text-muted dark:text-dark-muted">
                {t('cannotBeUndone')}
              </Text>
            </View>
          </View>
          <Text className="text-sm text-muted dark:text-dark-muted mb-3">
            {t('areYouSure', { name: itemName })}
          </Text>
          {itemDetails ? (
            <View className="rounded-lg border border-border dark:border-dark-border bg-surface dark:bg-dark-surface p-3">
              {itemDetails}
            </View>
          ) : null}
          <View className="flex-row gap-3 mt-5">
            <Button variant="outline" className="flex-1" onPress={onClose} disabled={isDeleting}>
              {tCommon('cancel')}
            </Button>
            <Button variant="destructive" className="flex-1" onPress={handleDelete} loading={isDeleting}>
              {confirmLabel ?? tCommon('delete')}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
