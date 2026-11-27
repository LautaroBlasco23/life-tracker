import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityFormModal } from './activity-form-modal';
import en from '@shared/messages/en.json';
import es from '@shared/messages/es.json';

// The workspace root can hold a second React copy (shared package peer dep),
// so tests that render this dialog mock the i18n context — same approach as
// calendar-event-modal.test. The mock still resolves keys against the real
// catalogs, so a missing key or a raw enum leaks through as the key itself.
vi.mock('@shared/contexts/language-context', async () => {
  const enCatalog = (await import('@shared/messages/en.json')).default;
  const esCatalog = (await import('@shared/messages/es.json')).default;

  return {
    useTranslations: (namespace: string) => {
      const catalog =
        localStorage.getItem('locale') === 'es' ? esCatalog : enCatalog;
      const table = (catalog as Record<string, Record<string, string>>)[
        namespace
      ];
      return (key: string, vars?: Record<string, string | number>) => {
        let str = table?.[key] ?? key;
        for (const [name, value] of Object.entries(vars ?? {})) {
          str = str.replaceAll(`{${name}}`, String(value));
        }
        return str;
      };
    },
  };
});

function renderModal() {
  return render(<ActivityFormModal open onOpenChange={() => {}} />);
}

/** Field order in the modal: Time of Day (0), Frequency (1), Privacy (2). */
function combobox(index: number) {
  return within(screen.getByRole('dialog')).getAllByRole('combobox')[index];
}

describe('ActivityFormModal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows translated Time of Day labels instead of raw enum values', async () => {
    const user = userEvent.setup();
    renderModal();

    const timeOfDay = combobox(0);
    expect(timeOfDay).toHaveTextContent(en.activities.anyMoment);

    await user.click(timeOfDay);

    for (const label of [
      en.activities.anyMoment,
      en.activities.morning,
      en.activities.afternoon,
      en.activities.evening,
    ]) {
      expect(screen.getByRole('option', { name: label })).toBeVisible();
    }

    // Raw enum values must not leak into the menu.
    expect(screen.queryByRole('option', { name: 'anyMoment' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'morning' })).toBeNull();
  });

  it('shows translated Frequency labels instead of raw enum values', async () => {
    const user = userEvent.setup();
    renderModal();

    const frequency = combobox(1);
    expect(frequency).toHaveTextContent(en.activities.daily);

    await user.click(frequency);

    for (const label of [
      en.activities.daily,
      en.activities.weekly,
      en.activities.monthly,
    ]) {
      expect(screen.getByRole('option', { name: label })).toBeVisible();
    }

    expect(screen.queryByRole('option', { name: 'daily' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'weekly' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'monthly' })).toBeNull();
  });

  it('labels Time of Day, Frequency and weekdays in Spanish', async () => {
    localStorage.setItem('locale', 'es');
    const user = userEvent.setup();
    renderModal();

    expect(combobox(0)).toHaveTextContent(es.activities.anyMoment);
    expect(combobox(1)).toHaveTextContent(es.activities.daily);

    // Weekly exposes the day checkboxes; their labels must be translated too.
    await user.click(combobox(1));
    await user.click(
      screen.getByRole('option', { name: es.activities.weekly })
    );

    expect(screen.getByLabelText(es.days.monday)).toBeVisible();
    expect(screen.getByLabelText(es.days.sunday)).toBeVisible();
    expect(screen.queryByLabelText('monday')).toBeNull();
  });
});
