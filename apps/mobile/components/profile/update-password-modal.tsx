import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';
import { authService, useTranslations } from '@shared';
import { showToast } from '../ui/toast';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';

interface UpdatePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Mobile port of web's update-password-modal.tsx. */
export function UpdatePasswordModal({ visible, onClose }: UpdatePasswordModalProps) {
  const t = useTranslations('updatePassword');
  const tCommon = useTranslations('common');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (newPassword !== confirmPassword) {
      showToast({
        title: t('passwordsDoNotMatch'),
        description: t('passwordsDoNotMatchDescription'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      showToast({
        title: t('passwordTooShort'),
        description: t('passwordTooShortDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await authService.updatePassword({ currentPassword, newPassword });
      showToast({
        title: t('passwordUpdated'),
        description: t('passwordUpdatedDescription'),
      });
      handleClose();
    } catch (error) {
      showToast({
        title: t('updateFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-1">
            {t('title')}
          </Text>
          <Text className="text-sm text-muted dark:text-dark-muted mb-4">
            {t('description')}
          </Text>

          <FormField
            label={t('currentPassword')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <View className="h-4" />
          <FormField
            label={t('newPassword')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <Text className="text-xs text-muted dark:text-dark-muted mt-1">{t('minLength')}</Text>
          <View className="h-4" />
          <FormField
            label={t('confirmNewPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <View className="flex-row gap-3 pt-5">
            <Button variant="outline" className="flex-1" onPress={handleClose} disabled={isLoading}>
              {tCommon('cancel')}
            </Button>
            <Button className="flex-1" onPress={handleSubmit} loading={isLoading}>
              {isLoading ? t('updating') : t('updatePassword')}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
