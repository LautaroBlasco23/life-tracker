import { Text, View, type ViewProps } from 'react-native';
import { cn } from '../../lib/cn';

interface CardProps extends ViewProps {
  title?: string;
}

export function Card({ title, className, children, ...props }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-xl border border-border dark:border-dark-border bg-surface dark:bg-dark-surface p-4',
        className
      )}
      {...props}
    >
      {title ? (
        <Text className="text-base font-semibold text-foreground dark:text-dark-foreground mb-3">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <View className={cn('h-2 rounded-full bg-border dark:bg-dark-border overflow-hidden', className)}>
      <View
        className="h-full rounded-full bg-primary dark:bg-dark-primary"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </View>
  );
}
