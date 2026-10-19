import { Text, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { cn } from '../../lib/cn';
import { useColors } from '../../lib/use-colors';

interface StreakBadgeProps {
  current: number;
  showZero?: boolean;
  size?: 'sm' | 'md';
}

/** Flame streak badge with visual tiers (warm ≥3, hot ≥7, on-fire ≥30). */
export function StreakBadge({ current, showZero = false, size = 'md' }: StreakBadgeProps) {
  const colors = useColors();

  if (current === 0 && !showZero) return null;

  const isWarm = current >= 3;
  const isHot = current >= 7;
  const isOnFire = current >= 30;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 gap-0.5',
    md: 'px-2 py-0.5 gap-1',
  };
  const iconSizes = { sm: 12, md: 16 };
  const textSizes = { sm: 'text-xs', md: 'text-sm' };

  // Calm, token-driven tiers: amber intensity grows with the streak; no
  // gradients or aggressive fills (styles.md).
  const bgClasses = isOnFire
    ? 'bg-secondary dark:bg-dark-secondary'
    : isHot
      ? 'bg-secondary/15 dark:bg-dark-secondary/15'
      : isWarm
        ? 'bg-secondary/10 dark:bg-dark-secondary/10'
        : 'bg-muted dark:bg-dark-muted';
  const inkColor = isOnFire
    ? colors.secondaryForeground
    : isWarm || isHot
      ? colors.warning
      : colors.textMuted;

  return (
    <View
      className={cn(
        'flex-row items-center rounded-full self-start',
        sizeClasses[size],
        bgClasses
      )}
    >
      <Flame
        size={iconSizes[size]}
        color={inkColor}
        fill={isWarm ? 'currentColor' : 'none'}
      />
      <Text className={cn('font-medium', textSizes[size])} style={{ color: inkColor }}>
        ×{current}
      </Text>
    </View>
  );
}
