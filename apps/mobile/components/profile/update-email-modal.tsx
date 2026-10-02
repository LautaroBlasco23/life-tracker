import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';
import { authService, userService, useTranslations } from '@shared';
import type { User } from '@shared/types/user';
import { showToast } from '../ui/toast';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';

interface UpdateEmailModalProps {
  visible: boolean;
  onClose: () => void;
  currentEmail: string;
  onEmailUpdated: (user: User) => void;
}

/** Mobile port of web's update-email-modal.tsx (with availability check). */
export function UpdateEmailModal({
  visible,
  onClose,
  currentEmail,
  onEmailUpdated,
}: UpdateEmailModalProps) {
  const t = useTranslations('updateEmail');
  const tCommon = useTranslations('common');

  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<
    'available' | 'taken' | 'checking' | null
  >(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const resetForm = () => {
    setPassword('');
    setNewEmail('');
    setEmailStatus(null);
    setEmailError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const checkEmail = async (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value || !emailRegex.test(value) || value === currentEmail) {
      setEmailStatus(null);
      setEmailError(null);
      return;
    }

    setEmailStatus('checking');
    setEmailError(null);
    try {
      const isAvailable = await userService.checkEmailAvailability(value);
      if (isAvailable) {
        setEmailStatus('available');
      } else {
        setEmailStatus('taken');
        setEmailError(t('emailTaken'));
      }
    } catch {
      setEmailStatus(null);
      setEmailError(null);
    }
  };

  // Same debounced availability check as web.
  useEffect(() => {
    if (!visible || !newEmail) return;
    const timeoutId = setTimeout(() => {
      checkEmail(newEmail);
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newEmail, visible]);

  const handleSubmit = async () => {
    if (newEmail === currentEmail) {
      showToast({
        title: t('sameEmail'),
        description: t('sameEmailDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await authService.updateEmail({ password, newEmail });

      const updatedUser = authService.getCurrentUser();
      if (updatedUser) {
        onEmailUpdated(updatedUser);
      }

      showToast({
        title: t('emailUpdated'),
        description: t('emailUpdatedDescription'),
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

          <View className="space-y-1.5 mb-4">
            <Text className="text-sm text-foreground dark:text-dark-foreground">
              {t('currentEmail')}
            </Text>
            <View className="h-11 rounded-lg border border-border dark:border-dark-border justify-center px-3 bg-surface dark:bg-dark-surface">
              <Text className="text-base text-muted dark:text-dark-muted">{currentEmail}</Text>
            </View>
          </View>

          <FormField
            label={t('newEmail')}
            placeholder={t('newEmailPlaceholder')}
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            error={emailError ?? undefined}
          />
          {emailStatus === 'available' ? (
            <Text className="text-xs text-success dark:text-dark-success">
              {t('emailAvailable')}
            </Text>
          ) : null}

          <FormField
            label={t('password')}
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Text className="text-xs text-muted dark:text-dark-muted mt-1">{t('passwordHint')}</Text>

          <View className="flex-row gap-3 pt-5">
            <Button variant="outline" className="flex-1" onPress={handleClose} disabled={isLoading}>
              {tCommon('cancel')}
            </Button>
            <Button className="flex-1" onPress={handleSubmit} loading={isLoading}>
              {isLoading ? t('updating') : t('updateEmail')}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
