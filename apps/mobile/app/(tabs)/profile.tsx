import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { authService, getConfig, setApiUrl, useLanguage, useTranslations } from '@shared';
import { Button } from '../../components/ui/button';
import { FormField } from '../../components/ui/form-field';
import { useTheme } from '../../lib/theme-provider';
import { storage } from '@shared';

export default function ProfileScreen() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const { locale, setLocale } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const user = authService.getCurrentUser();
  const [showApiUrlModal, setShowApiUrlModal] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState(getConfig().apiUrl);

  const handleLogout = () => {
    Alert.alert(t('signOut'), undefined, [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const saveApiUrl = () => {
    const url = apiUrlInput.trim().replace(/\/+$/, '');
    if (!url) return;
    setApiUrl(url);
    storage.setItem('apiUrl', url);
    setShowApiUrlModal(false);
    Alert.alert('API URL updated', 'Sign out and sign back in to use the new server.', [
      {
        text: t('signOut'),
        onPress: async () => {
          await authService.logout();
          router.replace('/login');
        },
      },
      { text: tCommon('cancel'), style: 'cancel' },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-background dark:bg-dark-background p-4">
      <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground mb-6">
        {t('title')}
      </Text>

      <View className="rounded-xl border border-border dark:border-dark-border p-4 mb-6">
        <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
          {user ? `${user.firstName} ${user.lastName}` : ''}
        </Text>
        <Text className="text-sm text-muted dark:text-dark-muted mt-1">@{user?.username}</Text>
        <Text className="text-sm text-muted dark:text-dark-muted mt-1">{user?.email}</Text>
      </View>

      <View className="rounded-xl border border-border dark:border-dark-border overflow-hidden">
        <Pressable
          className="flex-row items-center justify-between p-4 border-b border-border dark:border-dark-border"
          onPress={toggleTheme}
        >
          <Text className="text-foreground dark:text-dark-foreground">Theme</Text>
          <Text className="text-muted dark:text-dark-muted">{theme}</Text>
        </Pressable>
        <Pressable
          className="flex-row items-center justify-between p-4 border-b border-border dark:border-dark-border"
          onPress={() => setLocale(locale === 'en' ? 'es' : 'en')}
        >
          <Text className="text-foreground dark:text-dark-foreground">{t('language')}</Text>
          <Text className="text-muted dark:text-dark-muted">
            {locale === 'en' ? 'English' : 'Español'}
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center justify-between p-4"
          onPress={() => {
            setApiUrlInput(getConfig().apiUrl);
            setShowApiUrlModal(true);
          }}
        >
          <Text className="text-foreground dark:text-dark-foreground">API URL</Text>
          <Text className="text-muted dark:text-dark-muted text-xs flex-1 text-right ml-3" numberOfLines={1}>
            {getConfig().apiUrl}
          </Text>
        </Pressable>
      </View>

      <Button variant="destructive" className="mt-8" onPress={handleLogout}>
        {t('signOut')}
      </Button>

      <Modal visible={showApiUrlModal} animationType="fade" transparent onRequestClose={() => setShowApiUrlModal(false)}>
        <View className="flex-1 justify-center bg-black/50 p-6">
          <View className="rounded-2xl bg-background dark:bg-dark-background p-5">
            <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-4">
              API URL
            </Text>
            <TextInput
              className="h-11 rounded-lg border border-border dark:border-dark-border px-3 text-foreground dark:text-dark-foreground"
              value={apiUrlInput}
              onChangeText={setApiUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.1.10:8080/api"
              placeholderTextColor="#57606a"
            />
            <View className="flex-row gap-3 mt-5">
              <Button variant="outline" className="flex-1" onPress={() => setShowApiUrlModal(false)}>
                {tCommon('cancel')}
              </Button>
              <Button className="flex-1" onPress={saveApiUrl}>
                {tCommon('save')}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}