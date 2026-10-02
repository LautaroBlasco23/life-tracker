import { Pressable } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import { useTheme } from '../lib/theme-provider';

const MUTED = { light: '#57606a', dark: '#c9d1d9' } as const;

/** Small icon button that toggles light/dark, usable in the app header. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Pressable
      onPress={toggleTheme}
      className="h-9 w-9 rounded-lg items-center justify-center"
      accessibilityLabel="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun size={16} color={MUTED.dark} />
      ) : (
        <Moon size={16} color={MUTED.light} />
      )}
    </Pressable>
  );
}
