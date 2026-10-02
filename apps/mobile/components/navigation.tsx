import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  Activity,
  Bell,
  ChartPie,
  Menu,
  StickyNote,
  Timer,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslations } from '@shared';
import { ThemeToggle } from './theme-toggle';
import { useTheme } from '../lib/theme-provider';
import { cn } from '../lib/cn';

type NavItem = {
  href: string;
  icon: LucideIcon;
  labelKey: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/activities', icon: Activity, labelKey: 'activities' },
  { href: '/time', icon: Timer, labelKey: 'timeTracker' },
  { href: '/reminders', icon: Bell, labelKey: 'reminders' },
  { href: '/notes', icon: StickyNote, labelKey: 'notes' },
  { href: '/finance/transactions', icon: Wallet, labelKey: 'financeTransactions' },
  { href: '/finance/dashboard', icon: ChartPie, labelKey: 'financeDashboard' },
  { href: '/social', icon: Users, labelKey: 'social' },
];

/** 24px header height offset used to anchor the slide-down panel. */
export const HEADER_HEIGHT = 56;

/**
 * Top app bar with hamburger + slide-down navigation drawer, mirroring the
 * web app's mobile-responsive navigation. Render once per screen; the screen
 * root must be `relative` so the drawer backdrop spans it.
 */
export function Navigation() {
  const pathname = usePathname();
  const currentPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('nav');
  const { theme } = useTheme();
  const router = useRouter();

  const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), []);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  const muted = theme === 'dark' ? '#c9d1d9' : '#57606a';
  const primary = theme === 'dark' ? '#61dafb' : '#0583f2';

  return (
    <>
      <View
        className="h-14 flex-row items-center justify-between px-4 bg-background dark:bg-dark-background border-b border-border dark:border-dark-border"
        style={{ zIndex: 60 }}
      >
        <Pressable
          onPress={toggleMenu}
          className="h-10 w-10 rounded-lg items-center justify-center"
          accessibilityLabel={isOpen ? t('closeMenu') : t('openMenu')}
          accessibilityState={{ expanded: isOpen }}
        >
          {isOpen ? <X size={20} color={muted} /> : <Menu size={20} color={muted} />}
        </Pressable>

        <Text className="text-xl tracking-wide text-foreground dark:text-dark-foreground">
          LifeTracker
        </Text>

        <View className="flex-row items-center gap-1">
          <ThemeToggle />
          <Pressable
            onPress={() => router.push('/profile')}
            className="h-10 w-10 rounded-lg items-center justify-center"
            accessibilityLabel={t('profile')}
          >
            <User
              size={20}
              color={currentPath === '/profile' ? primary : muted}
            />
          </Pressable>
        </View>
      </View>

      {isOpen ? (
        <View className="absolute inset-0 z-50">
          <Pressable className="flex-1 bg-black/40" onPress={closeMenu} accessibilityLabel={t('closeMenu')} />
          <View className="absolute left-0 right-0 bg-background dark:bg-dark-background border-b border-border dark:border-dark-border" style={{ top: HEADER_HEIGHT }}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.href;
              return (
                <Pressable
                  key={item.href}
                  onPress={() => {
                    closeMenu();
                    router.push(item.href);
                  }}
                  className={cn(
                    'flex-row items-center gap-3 px-6 py-3',
                    isActive && 'bg-primary/10 dark:bg-dark-primary/10'
                  )}
                >
                  <Icon size={20} color={isActive ? primary : muted} />
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      isActive
                        ? 'text-primary dark:text-dark-primary'
                        : 'text-muted dark:text-dark-muted'
                    )}
                  >
                    {t(item.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </>
  );
}
