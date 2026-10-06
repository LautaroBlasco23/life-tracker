import { Pressable } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import { useTheme } from '../lib/theme-provider';
import { useColors } from '../lib/use-colors';

/** Small icon button that toggles light/dark, usable in the app header. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const colors = useColors();
  return (
    <Pressable
      onPress={toggleTheme}
      className="h-9 w-9 rounded-lg items-center justify-center"
      accessibilityLabel="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun size={16} color={colors.textMuted} />
      ) : (
        <Moon size={16} color={colors.textMuted} />
      )}
    </Pressable>
  );
}
