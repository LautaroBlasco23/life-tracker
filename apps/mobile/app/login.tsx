import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { authService, useLanguage, useTranslations, type Locale } from '@shared';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
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
      router.replace('/activities');
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
        <Card className="w-full max-w-md self-center">
          <View className="flex-row justify-end mb-3">
            <Button variant="ghost" className="h-9 self-start" onPress={() => setLocale(locale === 'en' ? 'es' : 'en')}>
              {locale === 'en' ? t('spanish') : t('english')}
            </Button>
          </View>
          <Text className="text-2xl font-semibold text-center text-foreground dark:text-dark-foreground">
            {t('signIn')}
          </Text>
          <Text className="text-center text-muted dark:text-dark-muted mt-1 mb-6">
            {t('signInDescription')}
          </Text>

          <View className="gap-4">
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

          <View className="mt-6 flex-row justify-center">
            <Text className="text-muted dark:text-dark-muted text-sm">{t('noAccount')} </Text>
            <Link href="/register" className="text-primary dark:text-dark-primary font-medium">
              {t('signUp')}
            </Link>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
