import { Text, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { cn } from '../../lib/cn';

interface StreakBadgeProps {
  current: number;
  showZero?: boolean;
  size?: 'sm' | 'md';
}

/** Flame streak badge with visual tiers (warm ≥3, hot ≥7, on-fire ≥30). */
export function StreakBadge({ current, showZero = false, size = 'md' }: StreakBadgeProps) {
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

  return (
    <View
      className={cn(
        'flex-row items-center rounded-full self-start',
        sizeClasses[size],
        isOnFire
          ? 'bg-orange-500'
          : isHot
            ? 'bg-orange-100 dark:bg-orange-900/30'
            : isWarm
              ? 'bg-amber-100 dark:bg-amber-900/30'
              : 'bg-gray-100 dark:bg-gray-800'
      )}
    >
      <Flame
        size={iconSizes[size]}
        color={
          isOnFire
            ? '#ffffff'
            : isHot
              ? '#ea580c'
              : isWarm
                ? '#b45309'
                : '#4b5563'
        }
        fill={isWarm ? 'currentColor' : 'none'}
      />
      <Text
        className={cn(
          'font-medium',
          textSizes[size],
          isOnFire
            ? 'text-white'
            : isHot
              ? 'text-orange-700 dark:text-orange-400'
              : isWarm
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-gray-600 dark:text-gray-400'
        )}
      >
        ×{current}
      </Text>
    </View>
  );
}
