import { Flame } from 'lucide-react';

interface StreakBadgeProps {
  current: number;
  showZero?: boolean;
  size?: 'sm' | 'md';
}

export function StreakBadge({
  current,
  showZero = false,
  size = 'md',
}: StreakBadgeProps) {
  if (current === 0 && !showZero) return null;

  const isWarm = current >= 3;
  const isHot = current >= 7;
  const isOnFire = current >= 30;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-0.5',
    md: 'px-2 py-0.5 text-sm gap-1',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
  };

  return (
    <div
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${
        isOnFire
          ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
          : isHot
            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            : isWarm
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
      }`}
    >
      <Flame
        className={`${iconSizes[size]} ${isOnFire ? 'animate-pulse' : ''}`}
        fill={isWarm ? 'currentColor' : 'none'}
      />
      <span>×{current}</span>
    </div>
  );
}
