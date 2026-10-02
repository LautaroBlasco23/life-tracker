import { Pressable, Text, View } from 'react-native';
import { Play, Square, Timer, Trash2 } from 'lucide-react-native';
import type { ActiveTimeSession } from '../../hooks/use-active-sessions';
import { getElapsedSeconds } from '../../hooks/use-active-sessions';
import { useTranslations } from '@shared';
import { formatTimerDisplay } from '../../lib/format-time';
import { Button } from '../ui/button';
import { useTheme } from '../../lib/theme-provider';
import { cn } from '../../lib/cn';

interface ActiveSessionCardProps {
  session: ActiveTimeSession;
  now: number;
  isSaving: boolean;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onSave: (session: ActiveTimeSession) => void;
  onDiscard: (id: string) => void;
}

/** Mobile port of web's ActiveSessionCard (stop / resume / save / discard). */
export function ActiveSessionCard({
  session,
  now,
  isSaving,
  onPause,
  onResume,
  onSave,
  onDiscard,
}: ActiveSessionCardProps) {
  const t = useTranslations('time');
  const tCommon = useTranslations('common');
  const { theme } = useTheme();
  const spinnerColor = theme === 'dark' ? '#61dafb' : '#0583f2';
  const isRunning = session.startedAt !== null;
  const elapsedSeconds = getElapsedSeconds(session, now);

  return (
    <View
      className={cn(
        'rounded-xl border p-4 bg-surface dark:bg-dark-surface',
        isRunning ? 'border-primary/60 dark:border-dark-primary/60' : 'border-border dark:border-dark-border'
      )}
    >
      <View className="flex-row items-center justify-between gap-2 mb-3">
        <View className="flex-row items-center gap-2 min-w-0 flex-1">
          <Timer
            size={18}
            color={spinnerColor}
          />
          <Text className="font-semibold text-foreground dark:text-dark-foreground flex-1" numberOfLines={1}>
            {session.description || session.category}
          </Text>
        </View>
        <View className="rounded-md bg-primary/10 dark:bg-dark-primary/10 px-2 py-0.5">
          <Text className="text-xs text-primary dark:text-dark-primary">
            {session.category}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between gap-3">
        <Text
          className={cn(
            'text-3xl font-mono font-bold tabular-nums',
            isRunning ? 'text-primary dark:text-dark-primary' : 'text-muted dark:text-dark-muted'
          )}
        >
          {formatTimerDisplay(elapsedSeconds)}
        </Text>

        <View className="flex-row items-center gap-2">
          {isRunning ? (
            <Button variant="destructive" className="h-9 px-3" textClassName="text-sm" onPress={() => onPause(session.id)}>
              {t('stop')}
            </Button>
          ) : (
            <>
              <Button variant="outline" className="h-9 px-3" textClassName="text-sm" onPress={() => onResume(session.id)}>
                {t('resume')}
              </Button>
              <Button className="h-9 px-3" textClassName="text-sm" onPress={() => onSave(session)} loading={isSaving}>
                {isSaving ? tCommon('saving') : t('save')}
              </Button>
            </>
          )}
          <Pressable
            onPress={() => onDiscard(session.id)}
            accessibilityLabel={t('discard')}
            className="p-2"
            hitSlop={8}
          >
            <Trash2 size={18} color="#57606a" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
