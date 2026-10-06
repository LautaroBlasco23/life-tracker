import { themeColors } from '@shared';
import { useTheme } from './theme-provider';

/**
 * Active theme palette for props that can't use Tailwind classes
 * (icon `color`, `placeholderTextColor`, `ActivityIndicator` color).
 * Tokens come from packages/shared/src/lib/theme-colors.ts.
 */
export function useColors() {
  const { theme } = useTheme();
  return themeColors[theme];
}
