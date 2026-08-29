import { Pressable, Text, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import type { Activity } from '@shared/types/activity';
import { cn } from '../../lib/cn';

interface ActivityCardProps {
  activity: Activity;
  isProcessing?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function formatDayFrequency(dayFrequency?: string): string | null {
  if (!dayFrequency) return null;
  try {
    const days: string[] = JSON.parse(dayFrequency);
    return days
      .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
      .join(', ');
  } catch {
    return null;
  }
}

export function ActivityCard({ activity, isProcessing, onPress, onLongPress }: ActivityCardProps) {
  const progress = `${activity.todayCompletions}/${activity.completionAmount}`;
  const done = activity.isCompletedToday;
  const weeklyDays = formatDayFrequency(activity.dayFrequency);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={isProcessing}
      className={cn(
        'rounded-xl border p-4 bg-surface dark:bg-dark-surface',
        done ? 'border-success/60 dark:border-dark-success/60' : 'border-border dark:border-dark-border',
        isProcessing && 'opacity-60'
      )}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
            {activity.title}
          </Text>
          {activity.description ? (
            <Text className="text-sm text-muted dark:text-dark-muted mt-0.5" numberOfLines={2}>
              {activity.description}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap gap-2 mt-2">
            <View className="rounded-md border border-border dark:border-dark-border px-2 py-0.5">
              <Text className="text-xs text-muted dark:text-dark-muted">
                {activity.frequency}
              </Text>
            </View>
            {activity.frequency === 'weekly' && weeklyDays ? (
              <View className="rounded-md border border-border dark:border-dark-border px-2 py-0.5">
                <Text className="text-xs text-muted dark:text-dark-muted">{weeklyDays}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View className="items-end">
          <Text className={cn('text-lg font-semibold', done ? 'text-success dark:text-dark-success' : 'text-foreground dark:text-dark-foreground')}>
            {progress}
          </Text>
          {activity.streak && activity.streak.current > 0 ? (
            <View className="flex-row items-center gap-1 mt-1">
              <Flame size={14} color="#e3b341" fill="#e3b341" />
              <Text className="text-xs text-warning dark:text-dark-warning">
                {activity.streak.current}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
