import { useCallback, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Download, KeyRound, Lock, Mail, Upload } from 'lucide-react-native';
import {
  authService,
  getConfig,
  setApiUrl,
  userService,
  useLanguage,
  useTranslations,
  storage,
  type ProfilePrivacyStatus,
  type User,
} from '@shared';
import { Button } from '../../components/ui/button';
import { DeleteModal } from '../../components/ui/delete-modal';
import { showToast } from '../../components/ui/toast';
import { UpdatePasswordModal } from '../../components/profile/update-password-modal';
import { UpdateEmailModal } from '../../components/profile/update-email-modal';
import { exportBackup, importBackup, pickBackupFile } from '../../lib/data-backup';
import { useTheme } from '../../lib/theme-provider';
import { useColors } from '../../lib/use-colors';
import { Navigation } from '../../components/navigation';

export default function ProfileScreen() {
  const t = useTranslations('profile');
  const tPrivacy = useTranslations('privacy');
  const tBackup = useTranslations('dataBackup');
  const tCommon = useTranslations('common');
  const { locale, setLocale } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const colors = useColors();

  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [showApiUrlModal, setShowApiUrlModal] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState(getConfig().apiUrl);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<{ uri: string; name: string } | null>(null);

  // Same profile refresh as web (fallback to the cached user on failure).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const profile = await userService.getMyProfile();
          if (!cancelled) setUser(profile);
        } catch {
          // keep cached user
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const privacyStatus = user?.profilePrivacyStatus ?? 'public';

  const togglePrivacy = async () => {
    if (!user) return;
    const next: ProfilePrivacyStatus = privacyStatus === 'public' ? 'private' : 'public';
    const previous = user;
    // Optimistic update, reverted on failure (web saves via the profile form).
    setUser({ ...user, profilePrivacyStatus: next });
    try {
      const updated = await userService.updateUser({
        profilePrivacyStatus: next,
      });
      setUser(updated);
    } catch (error) {
      setUser(previous);
      showToast({
        title: t('updateFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

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
    } catch (error) {
      showToast({
        title: t('uploadFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImage = async () => {
    try {
      const updated = await userService.deleteProfilePicture();
      setUser(updated);
    } catch (error) {
      showToast({
        title: t('uploadFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    showToast({
      title: t('signedOut'),
      description: t('signedOutDescription'),
    });
    router.replace('/login');
  };

  const saveApiUrl = () => {
    const url = apiUrlInput.trim().replace(/\/+$/, '');
    if (!url) return;
    setApiUrl(url);
    storage.setItem('apiUrl', url);
    setShowApiUrlModal(false);
    showToast({
      title: t('apiUrlUpdated'),
      description: t('apiUrlUpdatedDescription'),
    });
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      await exportBackup();
      showToast({
        title: tBackup('exportSuccess'),
        description: tBackup('exportSuccessDescription'),
      });
    } catch (error) {
      showToast({
        title: tBackup('exportFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFileSelected = async () => {
    try {
      const file = await pickBackupFile();
      if (file) setPendingImportFile(file);
    } catch {
      showToast({ title: tBackup('importFailed'), variant: 'destructive' });
    }
  };

  const handleRestoreConfirmed = async () => {
    if (!pendingImportFile) return;
    const file = pendingImportFile;
    setPendingImportFile(null);
    setIsImporting(true);
    try {
      const counts = await importBackup(file);
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      showToast({
        title: tBackup('importSuccess'),
        description: tBackup('importSuccessDescription', { count: total }),
      });
      // Refresh the local cache: the restore replaced all server data.
      const profile = await userService.getMyProfile().catch(() => null);
      if (profile) setUser(profile);
    } catch (error) {
      showToast({
        title: tBackup('importFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const privacyStatusLabel =
    privacyStatus === 'public' ? tPrivacy('public') : tPrivacy('private');

  return (
    <View className="flex-1 relative bg-background dark:bg-dark-background">
      <Navigation />
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-24">
        <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground mb-1">
          {t('title')}
        </Text>
        <Text className="text-sm text-muted dark:text-dark-muted mb-6">
          {t('description')}
        </Text>

        {/* Profile picture */}
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
              {t('changePicture')}
            </Button>
            {user?.profilePicUrl ? (
              <Button
                variant="ghost"
                className="h-9"
                textClassName="text-sm text-danger dark:text-dark-danger"
                onPress={removeImage}
              >
                {tCommon('delete')}
              </Button>
            ) : null}
          </View>
        </View>

        {/* Account */}
        <View className="rounded-xl border border-border dark:border-dark-border overflow-hidden mb-6">
          <Pressable
            className="flex-row items-center justify-between p-4 border-b border-border dark:border-dark-border"
            onPress={togglePrivacy}
          >
            <View className="flex-row items-center gap-2 flex-1">
              <Lock size={16} color={colors.textMuted} />
              <Text className="text-foreground dark:text-dark-foreground">
                {tPrivacy('profilePrivacy')}
              </Text>
            </View>
            <Text className="text-muted dark:text-dark-muted">
              {privacyStatusLabel}
            </Text>
          </Pressable>

          <Pressable
            className="flex-row items-center justify-between p-4 border-b border-border dark:border-dark-border"
            onPress={toggleTheme}
          >
            <Text className="text-foreground dark:text-dark-foreground">{t('theme')}</Text>
            <Text className="text-muted dark:text-dark-muted">
              {theme === 'dark' ? t('dark') : t('light')}
            </Text>
          </Pressable>
          <Pressable
            className="flex-row items-center justify-between p-4 border-b border-border dark:border-dark-border"
            onPress={() => setLocale(locale === 'en' ? 'es' : 'en')}
          >
            <Text className="text-foreground dark:text-dark-foreground">{t('language')}</Text>
            <Text className="text-muted dark:text-dark-muted">
              {locale === 'en' ? t('english') : t('spanish')}
            </Text>
          </Pressable>
          <Pressable
            className="flex-row items-center justify-between p-4"
            onPress={() => {
              setApiUrlInput(getConfig().apiUrl);
              setShowApiUrlModal(true);
            }}
          >
            <Text className="text-foreground dark:text-dark-foreground">{t('apiUrl')}</Text>
            <Text className="text-muted dark:text-dark-muted text-xs flex-1 text-right ml-3" numberOfLines={1}>
              {getConfig().apiUrl}
            </Text>
          </Pressable>
        </View>

        {/* Security actions */}
        <View className="flex-row gap-3 mb-6">
          <Button variant="outline" className="flex-1" onPress={() => setIsPasswordModalOpen(true)}>
            <View className="flex-row items-center gap-2">
              <KeyRound size={16} color={colors.textMuted} />
              <Text className="text-sm text-foreground dark:text-dark-foreground">
                {t('changePassword')}
              </Text>
            </View>
          </Button>
          <Button variant="outline" className="flex-1" onPress={() => setIsEmailModalOpen(true)}>
            <View className="flex-row items-center gap-2">
              <Mail size={16} color={colors.textMuted} />
              <Text className="text-sm text-foreground dark:text-dark-foreground">
                {t('changeEmail')}
              </Text>
            </View>
          </Button>
        </View>

        {/* Data backup */}
        <View className="rounded-xl border border-border dark:border-dark-border p-4 mb-8">
          <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-1">
            {tBackup('title')}
          </Text>
          <Text className="text-sm text-muted dark:text-dark-muted mb-4">
            {tBackup('description')}
          </Text>
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onPress={handleExportData}
              loading={isExporting}
              disabled={isExporting || isImporting}
            >
              <View className="flex-row items-center gap-2">
                <Download size={16} color={colors.textMuted} />
                <Text className="text-sm text-foreground dark:text-dark-foreground">
                  {isExporting ? tBackup('exporting') : tBackup('exportButton')}
                </Text>
              </View>
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onPress={handleImportFileSelected}
              loading={isImporting}
              disabled={isExporting || isImporting}
            >
              <View className="flex-row items-center gap-2">
                <Upload size={16} color={colors.textMuted} />
                <Text className="text-sm text-foreground dark:text-dark-foreground">
                  {isImporting ? tBackup('importing') : tBackup('importButton')}
                </Text>
              </View>
            </Button>
          </View>
          <Text className="text-xs text-muted dark:text-dark-muted mt-3">
            {tBackup('backupHint')}
          </Text>
        </View>

        <Button variant="destructive" onPress={handleLogout}>
          {t('signOut')}
        </Button>
      </ScrollView>

      {/* Destructive restore confirm (web AlertDialog parity): */}
      <DeleteModal
        visible={pendingImportFile !== null}
        onClose={() => setPendingImportFile(null)}
        title={tBackup('importWarningTitle')}
        itemName={pendingImportFile?.name ?? ''}
        confirmLabel={tBackup('importConfirm')}
        onConfirm={handleRestoreConfirmed}
        itemDetails={
          pendingImportFile ? (
            <Text className="text-xs">
              {tBackup('importWarningDescription', {
                filename: pendingImportFile.name,
              })}
            </Text>
          ) : null
        }
      />

      <UpdatePasswordModal
        visible={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />

      <UpdateEmailModal
        visible={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        currentEmail={user?.email ?? ''}
        onEmailUpdated={setUser}
      />

      <Modal visible={showApiUrlModal} animationType="fade" transparent onRequestClose={() => setShowApiUrlModal(false)}>
        <View className="flex-1 justify-center bg-black/50 p-6">
          <View className="rounded-2xl bg-background dark:bg-dark-background p-5">
            <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-4">
              {t('apiUrl')}
            </Text>
            <TextInput
              className="h-11 rounded-lg border border-border dark:border-dark-border px-3 text-foreground dark:text-dark-foreground"
              value={apiUrlInput}
              onChangeText={setApiUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.1.10:8080/api"
              placeholderTextColor={colors.textMuted}
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
    </View>
  );
}
