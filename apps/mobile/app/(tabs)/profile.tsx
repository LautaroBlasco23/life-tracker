import { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { authService, getConfig, setApiUrl, useLanguage, useTranslations, userService } from '@shared';
import { Button } from '../../components/ui/button';
import { FormField } from '../../components/ui/form-field';
import { useTheme } from '../../lib/theme-provider';
import { storage } from '@shared';

export default function ProfileScreen() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const { locale, setLocale } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState(authService.getCurrentUser());
  const [showApiUrlModal, setShowApiUrlModal] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState(getConfig().apiUrl);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setIsUploadingImage(true);
    try {
      const updated = await userService.uploadProfilePicture({
        uri: asset.uri,
        name: asset.fileName ?? 'profile.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      setUser(updated);
    } catch {
      Alert.alert(tCommon('error'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImage = () => {
    Alert.alert(tCommon('delete'), undefined, [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: tCommon('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await userService.deleteProfilePicture();
            setUser(updated);
          } catch {
            Alert.alert(tCommon('error'));
          }
        },
      },
    ]);
  };

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
        <View className="flex-row items-center">
          {user?.thumbnailUrl || user?.profilePicUrl ? (
            <Image
              source={{ uri: user.thumbnailUrl ?? user.profilePicUrl }}
              className="h-16 w-16 rounded-full mr-4"
            />
          ) : (
            <View className="h-16 w-16 rounded-full bg-surface dark:bg-dark-surface items-center justify-center mr-4">
              <Text className="text-xl font-semibold text-muted dark:text-dark-muted">
                {user?.firstName?.[0] ?? '?'}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
              {user ? `${user.firstName} ${user.lastName}` : ''}
            </Text>
            <Text className="text-sm text-muted dark:text-dark-muted mt-0.5">@{user?.username}</Text>
            <Text className="text-sm text-muted dark:text-dark-muted mt-0.5">{user?.email}</Text>
          </View>
        </View>
        <View className="flex-row gap-3 mt-4">
          <Button
            variant="outline"
            className="flex-1 h-9"
            textClassName="text-sm"
            onPress={pickImage}
            loading={isUploadingImage}
          >
            {t('changePicture') ?? 'Change picture'}
          </Button>
          {user?.profilePicUrl ? (
            <Button variant="ghost" className="h-9" textClassName="text-sm text-danger dark:text-dark-danger" onPress={removeImage}>
              {tCommon('delete')}
            </Button>
          ) : null}
        </View>
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