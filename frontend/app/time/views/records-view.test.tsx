import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeRecord } from '@shared/types/time';
import { timeService } from '@shared/services/time-service';
import { showToast } from '@/lib/toast';
import { RecordsView } from './records-view';

vi.mock('@shared/services/time-service', () => ({
  timeService: {
    getRecords: vi.fn(),
    getRecord: vi.fn(),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock('@/lib/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('@shared/contexts/language-context', () => {
  const dictionaries: Record<string, Record<string, string>> = {
    time: {
      allRecords: 'All your time records',
      viewing: 'Viewing {period}',
      logTime: 'Log Time',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      lastMonth: 'Last Month',
      allTime: 'All Time',
      startRecording: 'Start Recording',
      activeRecordings: 'Active Recordings',
      category: 'Category',
      selectCategory: 'Select category',
      description: 'Description',
      whatAreYouWorkingOn: 'What are you working on?',
      start: 'Start',
      stop: 'Stop',
      resume: 'Resume',
      save: 'Save',
      saving: 'Saving...',
      totalTime: 'Total Time',
      entries: 'Entries',
      topCategory: 'Top Category',
      noEntriesMatch: 'No time entries match your filters',
      noEntriesFor: 'No time entries for {period}',
      startRecordingOrLog:
        'Start recording your time or log an entry manually.',
      tryAdjusting: 'Try adjusting your filters or log new time entries.',
      clearFilters: 'Clear filters',
      logFirstEntry: 'Log your first entry',
      recordDeleted: 'Record deleted',
      recordDeletedDescription: 'The time entry has been deleted.',
      failedToLoad: 'Failed to load records',
      categoryRequired: 'Category required',
      categoryRequiredDescription: 'Please select a category.',
      descriptionRequired: 'Description required',
      entry: 'entry',
      deleteTimeEntry: 'Delete Time Entry',
      deleteEntry: 'Delete entry',
      deleteFailed: 'Delete failed',
      filterTimeRecords: 'Filter Time Records',
      month: 'Month',
      allMonths: 'All months',
      year: 'Year',
      allYears: 'All years',
      allCategories: 'All categories',
    },
    common: {
      cancel: 'Cancel',
      close: 'Close',
      delete: 'Delete',
      save: 'Save',
      loading: 'Loading...',
      filters: 'Filters',
      clearAll: 'Clear all',
      clearFilters: 'Clear filters',
      activeFilters: 'Active filters:',
      total: 'Total',
    },
    timeCategories: {
      reading: 'Reading',
      gaming: 'Gaming',
      exercise: 'Exercise',
      work: 'Work',
      study: 'Study',
      meditation: 'Meditation',
      hobbies: 'Hobbies',
      social: 'Social',
      entertainment: 'Entertainment',
      other: 'Other',
    },
    deleteModal: {
      cannotBeUndone: 'This action cannot be undone.',
      areYouSure: 'Are you sure you want to delete "{name}"?',
      deleting: 'Deleting...',
    },
    filterModal: {
      filter: 'Filter',
      reset: 'Reset',
      applyFilters: 'Apply Filters',
    },
  };
  const cache = new Map<
    string,
    (key: string, vars?: Record<string, string | number>) => string
  >();
  return {
    useTranslations: (namespace: string) => {
      if (!cache.has(namespace)) {
        cache.set(namespace, (key, vars) => {
          let str = dictionaries[namespace]?.[key] ?? key;
          if (vars) {
            for (const [k, v] of Object.entries(vars)) {
              str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            }
          }
          return str;
        });
      }
      return cache.get(namespace)!;
    },
  };
});

const now = new Date();

function record(overrides: Partial<TimeRecord>): TimeRecord {
  return {
    id: 1,
    category: 'Work',
    description: 'Sprint work',
    durationMinutes: 90,
    createdAt: new Date(2026, 9, 19, 9, 0).toISOString(),
    updatedAt: '',
    ...overrides,
  };
}

const records: TimeRecord[] = [
  record({
    id: 1,
    category: 'Work',
    description: 'Sprint work',
    durationMinutes: 90,
  }),
  record({
    id: 2,
    category: 'Reading',
    description: 'Papers',
    durationMinutes: 30,
    createdAt: new Date(2026, 9, 20, 20, 0).toISOString(),
  }),
];

describe('RecordsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(timeService.getRecords).mockResolvedValue(records);
  });

  it('renders the loading state and then the grouped records', async () => {
    render(<RecordsView />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText('Sprint work')).toBeInTheDocument()
    );
    expect(screen.getByText('Papers')).toBeInTheDocument();
    // Stats strip: 120 total minutes, 2 entries, top category Work.
    expect(screen.getByText('2h')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument();
    expect(screen.getAllByText('1h 30m').length).toBeGreaterThan(0);
    expect(timeService.getRecords).toHaveBeenCalledWith({
      category: undefined,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
  });

  it('shows the empty state and opens the create modal', async () => {
    const user = userEvent.setup();
    vi.mocked(timeService.getRecords).mockResolvedValue([]);

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    render(<RecordsView />);
    await waitFor(() =>
      expect(
        screen.getByText(
          `No time entries for ${monthNames[now.getMonth()].toLowerCase()}`
        )
      ).toBeInTheDocument()
    );

    await user.click(
      screen.getByRole('button', { name: 'Log your first entry' })
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // The filter aside keeps role="dialog" too; match the modal by its title.
    expect(screen.queryByRole('dialog', { name: 'Log Time' })).toBeNull();
  });

  it('toasts when loading the records fails', async () => {
    vi.mocked(timeService.getRecords).mockRejectedValue(
      new Error('network down')
    );

    render(<RecordsView />);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to load records' })
      )
    );
  });

  it('refuses to start a timer without a category', async () => {
    const user = userEvent.setup();
    render(<RecordsView />);
    await waitFor(() =>
      expect(screen.getByText('Sprint work')).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Category required' })
    );
    expect(screen.queryByText('Active Recordings')).toBeNull();
  });

  it('starts a timer and shows the active session card', async () => {
    const user = userEvent.setup();
    render(<RecordsView />);
    await waitFor(() =>
      expect(screen.getByText('Sprint work')).toBeInTheDocument()
    );

    // The timer category select is the second combobox in the DOM.
    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[1]);
    await user.click(screen.getByRole('option', { name: 'Reading' }));
    await user.type(screen.getByLabelText('Description'), 'Papers');
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getByText('Active Recordings')).toBeInTheDocument();
    expect(screen.getAllByText('Reading').length).toBeGreaterThan(0);
    // The timer form is reset after starting.
    expect(screen.getByLabelText('Description')).toHaveValue('');
    const stored = JSON.parse(
      localStorage.getItem('time_active_sessions') ?? '[]'
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      category: 'Reading',
      description: 'Papers',
    });
  });

  it('deletes a record through the card menu and modal', async () => {
    const user = userEvent.setup();
    vi.mocked(timeService.deleteRecord).mockResolvedValue(undefined);

    render(<RecordsView />);
    await waitFor(() =>
      expect(screen.getByText('Sprint work')).toBeInTheDocument()
    );

    await user.click(screen.getAllByRole('button', { name: 'Open menu' })[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete entry' }));

    await waitFor(() =>
      expect(timeService.deleteRecord).toHaveBeenCalledWith(1)
    );
    expect(screen.queryByText('Sprint work')).toBeNull();
    expect(screen.getByText('Papers')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Record deleted' })
    );
  });

  it('switching the period reloads without month filters', async () => {
    const user = userEvent.setup();
    render(<RecordsView />);
    await waitFor(() =>
      expect(screen.getByText('Sprint work')).toBeInTheDocument()
    );

    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(screen.getByRole('option', { name: 'All Time' }));

    expect(timeService.getRecords).toHaveBeenLastCalledWith({});
    expect(screen.getByText('All your time records')).toBeInTheDocument();
  });

  it('opens the filter sidebar with the time fields', async () => {
    const user = userEvent.setup();
    render(<RecordsView />);
    await waitFor(() =>
      expect(screen.getByText('Sprint work')).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Filters' }));

    expect(
      screen.getByRole('dialog', { name: 'Filter Time Records' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    // The aside stays mounted but slides out of the viewport.
    expect(document.querySelector('aside')!.className).not.toContain(
      'translate-x-0'
    );
  });
});
