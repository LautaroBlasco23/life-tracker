import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeRecord } from '@shared/types/time';
import { timeService } from '@shared/services/time-service';
import { showToast } from '@/lib/toast';
import { CreateTimeRecordModal } from './create-time-record-modal';

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
      logTime: 'Log Time',
      category: 'Category',
      selectCategory: 'Select category',
      description: 'Description',
      whatAreYouWorkingOn: 'What are you working on?',
      duration: 'Duration',
      hours: 'Hours',
      minutes: 'Minutes',
      invalidDuration: 'Invalid duration',
      enterValidDuration: 'Please enter a valid duration.',
      timeRecorded: 'Time recorded',
      timeRecordedDescription: 'Your time entry has been saved.',
      failedToSave: 'Failed to save',
    },
    common: {
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving...',
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

const createdRecord: TimeRecord = {
  id: 5,
  category: 'Reading',
  description: 'Papers',
  durationMinutes: 90,
  createdAt: '',
  updatedAt: '',
};

function renderModal() {
  const onOpenChange = vi.fn();
  const onRecordCreated = vi.fn();
  render(
    <CreateTimeRecordModal
      open
      onOpenChange={onOpenChange}
      onRecordCreated={onRecordCreated}
    />
  );
  return { onOpenChange, onRecordCreated };
}

async function selectCategory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: 'Reading' }));
}

describe('CreateTimeRecordModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(timeService.createRecord).mockResolvedValue(createdRecord);
  });

  it('keeps the save button disabled until a category is picked', () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('rejects a zero duration without calling the service', async () => {
    const user = userEvent.setup();
    const { onRecordCreated } = renderModal();

    await selectCategory(user);
    await user.type(screen.getByLabelText('Description'), 'Papers');
    await user.type(screen.getAllByPlaceholderText('0')[1], '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(timeService.createRecord).not.toHaveBeenCalled();
    expect(onRecordCreated).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Invalid duration' })
    );
  });

  it('creates a record with the computed minutes and resets the form', async () => {
    const user = userEvent.setup();
    const { onRecordCreated } = renderModal();

    await selectCategory(user);
    await user.type(screen.getByLabelText('Description'), 'Papers');
    const durationInputs = screen.getAllByPlaceholderText('0');
    await user.type(durationInputs[0], '1');
    await user.type(durationInputs[1], '30');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onRecordCreated).toHaveBeenCalledWith(createdRecord)
    );
    expect(timeService.createRecord).toHaveBeenCalledWith({
      category: 'Reading',
      description: 'Papers',
      durationMinutes: 90,
    });
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Time recorded' })
    );
    // The form is reset after a successful save.
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(durationInputs[0]).toHaveValue(null);
  });

  it('surfaces a save failure', async () => {
    vi.mocked(timeService.createRecord).mockRejectedValue(
      new Error('backend exploded')
    );
    const user = userEvent.setup();
    const { onRecordCreated } = renderModal();

    await selectCategory(user);
    await user.type(screen.getByLabelText('Description'), 'Papers');
    const durationInputs = screen.getAllByPlaceholderText('0');
    await user.type(durationInputs[0], '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to save',
          description: 'backend exploded',
        })
      )
    );
    expect(onRecordCreated).not.toHaveBeenCalled();
  });

  it('closes through the cancel button without saving', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onRecordCreated } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onRecordCreated).not.toHaveBeenCalled();
    expect(timeService.createRecord).not.toHaveBeenCalled();
  });
});
