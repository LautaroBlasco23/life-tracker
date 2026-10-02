import '../global.css';
import '../lib/storage-init';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LanguageProvider } from '@shared';
import { ThemeProvider } from '../lib/theme-provider';
import { ToastProvider } from '../components/ui/toast';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SafeAreaProvider>
          <SafeAreaView className="flex-1 bg-background dark:bg-dark-background" edges={['top']}>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="user/[username]" />
            </Stack>
            <ToastProvider />
          </SafeAreaView>
        </SafeAreaProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
