import { Pressable, Text, View } from 'react-native';
import { cn } from '../../lib/cn';

interface SegmentedTabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}

/** In-page segmented control (web equivalent of the Tabs component). */
export function SegmentedTabs<T extends string>({ value, onChange, options }: SegmentedTabsProps<T>) {
  return (
    <View className="flex-row rounded-lg bg-surface dark:bg-dark-surface p-1 mb-4">
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={cn(
            'flex-1 h-9 rounded-md items-center justify-center',
            value === opt.value && 'bg-background dark:bg-dark-background shadow-sm'
          )}
        >
          <Text
            className={cn(
              'text-sm font-medium',
              value === opt.value
                ? 'text-foreground dark:text-dark-foreground'
                : 'text-muted dark:text-dark-muted'
            )}
            numberOfLines={1}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
