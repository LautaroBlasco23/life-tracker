import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeRecord } from '@shared/types/time';
import { timeService } from '@shared/services/time-service';
import { showToast } from '@/lib/toast';
import { EditTimeRecordModal } from './edit-time-record-modal';

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
      editEntry: 'Edit Time Entry',
      category: 'Category',
      selectCategory: 'Select category',
      description: 'Description',
      whatAreYouWorkingOn: 'What are you working on?',
      duration: 'Duration',
      hours: 'Hours',
      minutes: 'Minutes',
      invalidDuration: 'Invalid duration',
      enterValidDuration: 'Please enter a valid duration.',
      timeUpdated: 'Time updated',
      timeUpdatedDescription: 'Your time entry has been updated.',
    },
    common: {
      cancel: 'Cancel',
      save: 'Save',
      updating: 'Updating...',
      error: 'Error',
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

const record: TimeRecord = {
  id: 3,
  category: 'Study',
  description: 'Thesis',
  durationMinutes: 95,
  createdAt: '',
  updatedAt: '',
};

const updatedRecord: TimeRecord = { ...record, durationMinutes: 120 };

function renderModal(recordProp: TimeRecord | null) {
  const onOpenChange = vi.fn();
  const onRecordUpdated = vi.fn();
  render(
    <EditTimeRecordModal
      open
      onOpenChange={onOpenChange}
      record={recordProp}
      onRecordUpdated={onRecordUpdated}
    />
  );
  return { onOpenChange, onRecordUpdated };
}

describe('EditTimeRecordModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(timeService.updateRecord).mockResolvedValue(updatedRecord);
  });

  it('prefills the form from the record', () => {
    renderModal(record);

    expect(screen.getByRole('combobox')).toHaveTextContent('Study');
    expect(screen.getByLabelText('Description')).toHaveValue('Thesis');
    const durationInputs = screen.getAllByPlaceholderText('0');
    expect(durationInputs[0]).toHaveValue(1);
    expect(durationInputs[1]).toHaveValue(35);
  });

  it('saves the edited record with the computed minutes', async () => {
    const user = userEvent.setup();
    const { onRecordUpdated } = renderModal(record);

    const description = screen.getByLabelText('Description');
    await user.clear(description);
    await user.type(description, 'Thesis chapter 2');
    const durationInputs = screen.getAllByPlaceholderText('0');
    await user.clear(durationInputs[0]);
    await user.type(durationInputs[0], '2');
    await user.clear(durationInputs[1]);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onRecordUpdated).toHaveBeenCalledWith(updatedRecord)
    );
    expect(timeService.updateRecord).toHaveBeenCalledWith(3, {
      category: 'Study',
      description: 'Thesis chapter 2',
      durationMinutes: 120,
    });
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Time updated' })
    );
  });

  it('rejects a zero duration without calling the service', async () => {
    const user = userEvent.setup();
    const { onRecordUpdated } = renderModal(record);

    const durationInputs = screen.getAllByPlaceholderText('0');
    await user.clear(durationInputs[0]);
    await user.clear(durationInputs[1]);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(timeService.updateRecord).not.toHaveBeenCalled();
    expect(onRecordUpdated).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Invalid duration' })
    );
  });

  it('surfaces a save failure', async () => {
    vi.mocked(timeService.updateRecord).mockRejectedValue(
      new Error('backend exploded')
    );
    const user = userEvent.setup();
    const { onRecordUpdated } = renderModal(record);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'backend exploded',
        })
      )
    );
    expect(onRecordUpdated).not.toHaveBeenCalled();
  });

  it('does nothing without a record to edit', () => {
    renderModal(null);

    // No record means no category, so the form stays disabled.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(timeService.updateRecord).not.toHaveBeenCalled();
  });

  it('closes through the cancel button without saving', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onRecordUpdated } = renderModal(record);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onRecordUpdated).not.toHaveBeenCalled();
    expect(timeService.updateRecord).not.toHaveBeenCalled();
  });
});
