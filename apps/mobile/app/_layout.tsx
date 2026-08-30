import '../global.css';
import '../lib/storage-init';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LanguageProvider } from '@shared';
import { ThemeProvider } from '../lib/theme-provider';

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
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="user/[username]" />
            </Stack>
          </SafeAreaView>
        </SafeAreaProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
