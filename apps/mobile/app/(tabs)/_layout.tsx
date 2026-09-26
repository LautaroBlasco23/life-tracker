import { Tabs } from 'expo-router';
import { Activity, ClipboardList, Timer, StickyNote, User, Wallet, Users } from 'lucide-react-native';
import { useTheme } from '../../lib/theme-provider';
import { useTranslations } from '@shared';

export default function TabsLayout() {
  const t = useTranslations('nav');
  const { theme } = useTheme();
  const active = theme === 'dark' ? '#61dafb' : '#0583f2';
  const inactive = theme === 'dark' ? '#c9d1d9' : '#57606a';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          backgroundColor: theme === 'dark' ? '#161b22' : '#ffffff',
          borderTopColor: theme === 'dark' ? '#30363d' : '#d0d7de',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('activities'), tabBarIcon: ({ color, size }) => <Activity color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="routines"
        options={{ title: t('routines'), tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="time"
        options={{ title: t('time'), tabBarIcon: ({ color, size }) => <Timer color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="notes"
        options={{ title: t('notes'), tabBarIcon: ({ color, size }) => <StickyNote color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="finance"
        options={{ title: t('finance'), tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="social"
        options={{ title: t('social'), tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('profile'), tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tabs>
  );
}
