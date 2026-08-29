import '../global.css';
import '../lib/storage-init';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LanguageProvider } from '@shared';
import { ThemeProvider } from '../lib/theme-provider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </LanguageProvider>
    </ThemeProvider>
  );
}
