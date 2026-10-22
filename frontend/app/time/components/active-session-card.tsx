import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Timer, Play, Square, Trash2 } from 'lucide-react';
import { useTranslations } from '@shared/contexts/language-context';
import {
  ActiveTimeSession,
  getElapsedSeconds,
} from '../hooks/use-active-sessions';
import { formatTimerDisplay } from '../format-time';

function TimerParticles({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;

  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 4,
      size: 2 + Math.random() * 3,
      opacity: 0.3 + Math.random() * 0.4,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-primary animate-float"
          style={{
            left: `${particle.left}%`,
            bottom: '-10px',
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          10% {
            opacity: var(--tw-opacity, 0.5);
          }
          90% {
            opacity: var(--tw-opacity, 0.5);
          }
          100% {
            transform: translateY(-150px) scale(0.5);
            opacity: 0;
          }
        }
        .animate-float {
          animation: float linear infinite;
        }
      `}</style>
    </div>
  );
}

interface ActiveSessionCardProps {
  session: ActiveTimeSession;
  now: number;
  isSaving: boolean;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onSave: (session: ActiveTimeSession) => void;
  onDiscard: (id: string) => void;
}

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
  const isRunning = session.startedAt !== null;
  const elapsedSeconds = getElapsedSeconds(session, now);

  return (
    <Card
      className={`bg-surface border-secondary/30 transition-all duration-300 relative overflow-hidden ${
        isRunning ? 'border-primary/60 ring-2 ring-primary/20' : ''
      }`}
    >
      <TimerParticles isActive={isRunning} />
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Timer
              className={`h-5 w-5 shrink-0 ${
                isRunning
                  ? 'text-primary animate-pulse'
                  : 'text-muted-foreground'
              }`}
            />
            <h3 className="font-semibold text-foreground truncate">
              {session.description || session.category}
            </h3>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {session.category}
          </Badge>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div
            className={`text-3xl font-mono font-bold tabular-nums ${
              isRunning ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {formatTimerDisplay(elapsedSeconds)}
          </div>

          <div className="flex gap-2 justify-end">
            {isRunning ? (
              <Button
                onClick={() => onPause(session.id)}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                {t('stop')}
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => onResume(session.id)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  {t('resume')}
                </Button>
                <Button
                  onClick={() => onSave(session)}
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  {isSaving ? t('saving') : t('save')}
                </Button>
              </>
            )}
            <Button
              onClick={() => onDiscard(session.id)}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
