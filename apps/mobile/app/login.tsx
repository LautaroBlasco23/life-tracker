import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { authService, useLanguage, useTranslations, type Locale } from '@shared';
import { Button } from '../components/ui/button';
import { FormField } from '../components/ui/form-field';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('auth');
  const { locale, setLocale } = useLanguage();

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await authService.login({ identifier, password });
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background dark:bg-dark-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center p-6">
        <View className="flex-row justify-end mb-4">
          <Button variant="ghost" onPress={() => setLocale(locale === 'en' ? 'es' : 'en')}>
            {locale === 'en' ? 'Español' : 'English'}
          </Button>
        </View>
        <Text className="text-3xl font-semibold text-center text-foreground dark:text-dark-foreground">
          {t('signIn')}
        </Text>
        <Text className="text-center text-muted dark:text-dark-muted mt-2 mb-8">
          {t('signInDescription')}
        </Text>

        <View className="space-y-4">
          <FormField
            label={t('usernameOrEmail')}
            placeholder={t('usernameOrEmailPlaceholder')}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
          />
          <FormField
            label={t('password')}
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {error ? (
            <Text className="text-danger dark:text-dark-danger text-sm">{error}</Text>
          ) : null}
          <Button onPress={handleSubmit} loading={isLoading} disabled={!identifier || !password}>
            {isLoading ? t('signingIn') : t('signIn')}
          </Button>
        </View>

        <View className="mt-8 flex-row justify-center">
          <Text className="text-muted dark:text-dark-muted text-sm">{t('noAccount')} </Text>
          <Link href="/register" className="text-primary dark:text-dark-primary font-medium">
            {t('signUp')}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
