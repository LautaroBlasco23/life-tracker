import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActiveSessionCard } from './active-session-card';
import type { ActiveTimeSession } from '../hooks/use-active-sessions';

vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    time: {
      stop: 'Stop',
      resume: 'Resume',
      save: 'Save',
      saving: 'Saving...',
    },
  };
  const cache = new Map<
    string,
    (key: string, vars?: Record<string, string | number>) => string
  >();
  return {
    useTranslations: (namespace: string) => {
      if (!cache.has(namespace)) {
        cache.set(
          namespace,
          (key, vars) => dictionaries[namespace]?.[key] ?? key
        );
      }
      return cache.get(namespace)!;
    },
  };
});

const startedAt = new Date(2026, 9, 21, 10, 0, 0).getTime();

const runningSession: ActiveTimeSession = {
  id: 's1',
  category: 'Study',
  description: 'Papers',
  startedAt,
  accumulatedSeconds: 0,
};

const pausedSession: ActiveTimeSession = {
  id: 's2',
  category: 'Work',
  description: 'Emails',
  startedAt: null,
  accumulatedSeconds: 130,
};

function renderCard(
  session: ActiveTimeSession,
  props: { now?: number; isSaving?: boolean } = {}
) {
  const handlers = {
    onPause: vi.fn(),
    onResume: vi.fn(),
    onSave: vi.fn(),
    onDiscard: vi.fn(),
  };
  const { container } = render(
    <ActiveSessionCard
      session={session}
      now={props.now ?? startedAt}
      isSaving={props.isSaving ?? false}
      {...handlers}
    />
  );
  // The discard control is icon-only (no accessible name); it is the last
  // button of the card.
  const discardButton =
    container.querySelectorAll('button')[
      container.querySelectorAll('button').length - 1
    ];
  return { handlers, discardButton };
}

describe('ActiveSessionCard', () => {
  it('shows the timer, category and description of a running session', () => {
    renderCard(runningSession, { now: startedAt + 3725_000 });

    expect(screen.getByText('Papers')).toBeInTheDocument();
    expect(screen.getByText('Study')).toBeInTheDocument();
    expect(screen.getByText('01:02:05')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('falls back to the category when there is no description', () => {
    renderCard({ ...runningSession, description: '' });

    expect(screen.getByRole('heading', { name: 'Study' })).toBeInTheDocument();
  });

  it('offers resume and save for a paused session', () => {
    renderCard(pausedSession);

    expect(screen.getByText('00:02:10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('pauses a running session when stop is clicked', async () => {
    const user = userEvent.setup();
    const { handlers } = renderCard(runningSession);

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(handlers.onPause).toHaveBeenCalledWith('s1');
    expect(handlers.onResume).not.toHaveBeenCalled();
  });

  it('resumes and saves a paused session', async () => {
    const user = userEvent.setup();
    const { handlers } = renderCard(pausedSession);

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(handlers.onResume).toHaveBeenCalledWith('s2');
    expect(handlers.onSave).toHaveBeenCalledWith(pausedSession);
  });

  it('discards through the icon-only button', async () => {
    const user = userEvent.setup();
    const { handlers, discardButton } = renderCard(runningSession);

    await user.click(discardButton);

    expect(handlers.onDiscard).toHaveBeenCalledWith('s1');
  });

  it('shows a disabled saving state', async () => {
    const user = userEvent.setup();
    const { handlers } = renderCard(pausedSession, { isSaving: true });

    const saveButton = screen.getByRole('button', { name: 'Saving...' });
    expect(saveButton).toBeDisabled();
    await user.click(saveButton);
    expect(handlers.onSave).not.toHaveBeenCalled();
  });
});
