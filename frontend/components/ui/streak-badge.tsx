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

  // Calm, token-driven tiers: amber (secondary/warning) intensity grows with
  // the streak; no gradients or aggressive fills (styles.md).
  const tierClasses = isOnFire
    ? 'bg-secondary text-secondary-foreground border border-secondary'
    : isHot
      ? 'bg-secondary/15 text-warning'
      : isWarm
        ? 'bg-secondary/10 text-warning'
        : 'bg-muted text-muted-foreground';

  return (
    <div
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${tierClasses}`}
    >
      <Flame
        className={`${iconSizes[size]} ${isOnFire ? 'animate-pulse' : ''}`}
        fill={isWarm ? 'currentColor' : 'none'}
      />
      <span>×{current}</span>
    </div>
  );
}
