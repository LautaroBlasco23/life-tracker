import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import {
  authService,
  userService,
  useLanguage,
  useTranslations,
  type Locale,
} from '@shared';
import { Button } from '../components/ui/button';
import { FormField } from '../components/ui/form-field';

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'available' | 'taken' | 'checking' | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<'available' | 'taken' | 'checking' | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const t = useTranslations('auth');
  const { locale, setLocale } = useLanguage();

  const isPasswordValid = password.length >= MIN_PASSWORD_LENGTH;

  const checkUsername = useCallback(
    async (value: string) => {
      if (!value || value.length < 3) {
        setUsernameStatus(null);
        setUsernameError(null);
        return;
      }
      setUsernameStatus('checking');
      setUsernameError(null);
      try {
        const isAvailable = await authService.checkUsernameAvailability(value);
        if (isAvailable) {
          setUsernameStatus('available');
        } else {
          setUsernameStatus('taken');
          setUsernameError(t('usernameTaken'));
        }
      } catch {
        setUsernameStatus(null);
        setUsernameError(null);
      }
    },
    [t]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (username && username.length >= 3) {
        checkUsername(username);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [username, checkUsername]);

  const checkEmail = useCallback(
    async (value: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value || !emailRegex.test(value)) {
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
    },
    [t]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (email) {
        checkEmail(email);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [email, checkEmail]);

  const handleSubmit = async () => {
    setError(null);
    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }
    if (!isPasswordValid) {
      setError(t('passwordTooShort'));
      return;
    }
    setIsLoading(true);
    try {
      await authService.register({
        firstName,
        lastName,
        username,
        email,
        password,
      });
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registrationFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background dark:bg-dark-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center p-6" keyboardShouldPersistTaps="handled">
        <View className="flex-row justify-end mb-4">
          <Button variant="ghost" onPress={() => setLocale(locale === 'en' ? 'es' : 'en')}>
            {locale === 'en' ? 'Español' : 'English'}
          </Button>
        </View>
        <Text className="text-3xl font-semibold text-center text-foreground dark:text-dark-foreground">
          {t('createAccount')}
        </Text>
        <Text className="text-center text-muted dark:text-dark-muted mt-2 mb-8">
          {t('createAccountDescription')}
        </Text>

        <View className="space-y-4">
          <FormField label={t('firstName')} placeholder={t('firstNamePlaceholder')} value={firstName} onChangeText={setFirstName} />
          <FormField label={t('lastName')} placeholder={t('lastNamePlaceholder')} value={lastName} onChangeText={setLastName} />
          <FormField
            label={t('username')}
            placeholder={t('usernamePlaceholder')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            error={usernameError ?? undefined}
          />
          {usernameStatus === 'available' ? (
            <Text className="text-success dark:text-dark-success text-sm">{t('usernameAvailable')}</Text>
          ) : null}
          <FormField
            label={t('email')}
            placeholder={t('emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            error={emailError ?? undefined}
          />
          {emailStatus === 'available' ? (
            <Text className="text-success dark:text-dark-success text-sm">{t('emailAvailable')}</Text>
          ) : null}
          <FormField label={t('password')} placeholder={t('createPasswordPlaceholder')} value={password} onChangeText={setPassword} secureTextEntry />
          <FormField label={t('confirmPassword')} placeholder={t('confirmPasswordPlaceholder')} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          {error ? <Text className="text-danger dark:text-dark-danger text-sm">{error}</Text> : null}
          <Button
            onPress={handleSubmit}
            loading={isLoading}
            disabled={!firstName || !lastName || !username || !email || !password || !confirmPassword}
          >
            {isLoading ? t('creatingAccount') : t('signUp')}
          </Button>
        </View>

        <View className="mt-8 flex-row justify-center">
          <Text className="text-muted dark:text-dark-muted text-sm">{t('haveAccount')} </Text>
          <Link href="/login" className="text-primary dark:text-dark-primary font-medium">
            {t('signIn')}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
