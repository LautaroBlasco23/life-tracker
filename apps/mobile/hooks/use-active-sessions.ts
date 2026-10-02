import { useCallback, useEffect, useRef, useState } from 'react';
import { timeService, useTranslations, storage } from '@shared';
import { showToast } from '../components/ui/toast';
import { formatDuration } from '../lib/format-time';

export interface ActiveTimeSession {
  id: string;
  category: string;
  description: string;
  /** Epoch ms; null while paused. */
  startedAt: number | null;
  /** Seconds frozen while paused. */
  accumulatedSeconds: number;
}

const SESSIONS_STORAGE_KEY = 'time_active_sessions';

function createSessionId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadSessions(): ActiveTimeSession[] {
  const stored = storage.getItem(SESSIONS_STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) =>
        typeof s?.id === 'string' &&
        typeof s?.category === 'string' &&
        typeof s?.description === 'string' &&
        typeof s?.accumulatedSeconds === 'number'
    );
  } catch {
    storage.removeItem(SESSIONS_STORAGE_KEY);
    return [];
  }
}

export function getElapsedSeconds(
  session: ActiveTimeSession,
  now: number
): number {
  const runningSeconds =
    session.startedAt !== null
      ? Math.max(0, Math.floor((now - session.startedAt) / 1000))
      : 0;
  return session.accumulatedSeconds + runningSeconds;
}

/** Port of web's use-active-sessions: sessions persisted via the shared
 * storage adapter so timers survive app restarts and tab switches. */
export function useActiveSessions(onSaved?: () => void) {
  const t = useTranslations('time');

  const [sessions, setSessions] = useState<ActiveTimeSession[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [savingId, setSavingId] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setSessions(loadSessions());
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    storage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const anyRunning = sessions.some((s) => s.startedAt !== null);

  useEffect(() => {
    if (!anyRunning) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [anyRunning]);

  const start = useCallback(
    (category: string, description: string): boolean => {
      if (!category) {
        showToast({
          title: t('categoryRequired'),
          description: t('categoryRequiredDescription'),
          variant: 'destructive',
        });
        return false;
      }

      setSessions((prev) => [
        ...prev,
        {
          id: createSessionId(),
          category,
          description,
          startedAt: Date.now(),
          accumulatedSeconds: 0,
        },
      ]);
      return true;
    },
    [t]
  );

  const pause = useCallback((id: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id && s.startedAt !== null
          ? {
              ...s,
              accumulatedSeconds:
                s.accumulatedSeconds +
                Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000)),
              startedAt: null,
            }
          : s
      )
    );
  }, []);

  const resume = useCallback((id: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id && s.startedAt === null
          ? { ...s, startedAt: Date.now() }
          : s
      )
    );
  }, []);

  const discard = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const save = useCallback(
    async (session: ActiveTimeSession): Promise<boolean> => {
      if (!session.category) {
        showToast({
          title: t('categoryRequired'),
          description: t('categoryRequiredDescription'),
          variant: 'destructive',
        });
        return false;
      }

      if (!session.description.trim()) {
        showToast({
          title: t('descriptionRequired'),
          description: t('descriptionRequiredDescription'),
          variant: 'destructive',
        });
        return false;
      }

      setSavingId(session.id);
      try {
        const totalSeconds = getElapsedSeconds(session, Date.now());
        // Same >= 60 s round-to-minutes rule as the shared service (min 1 min).
        const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));

        await timeService.createRecord({
          category: session.category,
          description: session.description,
          durationMinutes: totalMinutes,
        });

        showToast({
          title: t('timeRecorded'),
          description: t('timeRecordedDescription', {
            duration: formatDuration(totalMinutes),
            category: session.category,
          }),
        });

        setSessions((prev) => prev.filter((s) => s.id !== session.id));
        onSaved?.();
        return true;
      } catch (error) {
        showToast({
          title: t('failedToSave'),
          description:
            error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [t, onSaved]
  );

  return { sessions, now, savingId, start, pause, resume, discard, save };
}
