import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real views are heavy (services, CodeMirror); the page test only cares
// about which views are mounted and which tab is active.
vi.mock('./views/notesView', () => ({
  NotesView: () => <div>notes view</div>,
}));

vi.mock('./views/stickyNotesView', () => ({
  StickyNotesView: () => <div>sticky notes view</div>,
}));

vi.mock('@shared/contexts/language-context', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const dict: Record<string, string> =
      namespace === 'notes'
        ? {
            title: 'Notes',
            description: 'Notes description',
            tabNotes: 'Notes',
            tabSticky: 'Sticky notes',
          }
        : {};
    return dict[key] ?? key;
  },
}));

import NotesPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotesPage', () => {
  it('mounts only the notes view on first load', () => {
    render(<NotesPage />);

    expect(screen.getByText('notes view')).toBeInTheDocument();
    expect(screen.queryByText('sticky notes view')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(
      'Notes'
    );
  });

  it('visiting the sticky tab mounts it and activates it', async () => {
    const user = userEvent.setup();
    render(<NotesPage />);

    await user.click(screen.getByRole('tab', { name: 'Sticky notes' }));

    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(
      'Sticky notes'
    );
    expect(screen.getByText('sticky notes view')).toBeInTheDocument();
    expect(screen.getByText('notes view')).toBeInTheDocument();
  });

  it('keeps both views mounted after switching back (drafts survive)', async () => {
    const user = userEvent.setup();
    render(<NotesPage />);

    await user.click(screen.getByRole('tab', { name: 'Sticky notes' }));
    await user.click(screen.getByRole('tab', { name: 'Notes' }));

    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(
      'Notes'
    );
    // The sticky view stays mounted (hidden) so its state survives.
    expect(screen.getByText('sticky notes view')).toBeInTheDocument();
    expect(screen.getByText('notes view')).toBeInTheDocument();
  });
});
