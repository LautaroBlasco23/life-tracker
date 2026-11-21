import { describe, expect, it } from 'vitest';
import {
  getReminderStatus,
  isReminderDueOn,
  isReminderDueOnOrBefore,
  isReminderVisibleOn,
} from './reminder';

const NOW = new Date(2026, 5, 15, 12, 0, 0); // 2026-06-15 12:00 local

const reminder = (overrides: {
  dueAt: string;
  activeFrom?: string | null;
  completedAt?: string | null;
}) => ({
  dueAt: overrides.dueAt,
  activeFrom: overrides.activeFrom ?? null,
  completedAt: overrides.completedAt ?? null,
});

describe('getReminderStatus', () => {
  it('completed wins over every other condition (even completed late)', () => {
    const r = reminder({
      dueAt: '2026-06-01T00:00:00',
      completedAt: '2026-06-10T00:00:00',
    });
    expect(getReminderStatus(r, NOW)).toBe('completed');
  });

  it('missed when now is past dueAt', () => {
    expect(
      getReminderStatus(reminder({ dueAt: '2026-06-15T11:59:00' }), NOW)
    ).toBe('missed');
  });

  it('locked before activeFrom, active inside the window', () => {
    const r = reminder({
      dueAt: '2026-06-15T18:00:00',
      activeFrom: '2026-06-15T14:00:00',
    });
    expect(getReminderStatus(r, NOW)).toBe('locked');
    expect(getReminderStatus(r, new Date(2026, 5, 15, 14, 0, 0))).toBe('active');
  });

  it('no activeFrom means always completable until due', () => {
    expect(
      getReminderStatus(reminder({ dueAt: '2026-06-15T18:00:00' }), NOW)
    ).toBe('active');
  });
});

describe('isReminderDueOnOrBefore / isReminderDueOn', () => {
  it('due today or in the past is due-on-or-before; future is not', () => {
    expect(
      isReminderDueOnOrBefore(reminder({ dueAt: '2026-06-14T09:00:00' }), NOW)
    ).toBe(true);
    expect(
      isReminderDueOnOrBefore(reminder({ dueAt: '2026-06-15T23:59:00' }), NOW)
    ).toBe(true);
    expect(
      isReminderDueOnOrBefore(reminder({ dueAt: '2026-06-16T00:00:00' }), NOW)
    ).toBe(false);
  });

  it('matches exact calendar days', () => {
    expect(
      isReminderDueOn(reminder({ dueAt: '2026-06-15T08:00:00' }), NOW)
    ).toBe(true);
    expect(
      isReminderDueOn(reminder({ dueAt: '2026-06-14T08:00:00' }), NOW)
    ).toBe(false);
  });
});

describe('isReminderVisibleOn', () => {
  it('completed reminders only show on the day they were due', () => {
    const completed = reminder({
      dueAt: '2026-06-14T09:00:00',
      completedAt: '2026-06-14T10:00:00',
    });
    expect(isReminderVisibleOn(completed, new Date(2026, 5, 14), NOW)).toBe(
      true
    );
    expect(isReminderVisibleOn(completed, new Date(2026, 5, 13), NOW)).toBe(
      false
    );
    expect(isReminderVisibleOn(completed, new Date(2026, 5, 15), NOW)).toBe(
      false
    );
  });

  it('pending and missed reminders stay visible on today only', () => {
    const past = reminder({ dueAt: '2026-06-14T09:00:00' });
    expect(isReminderVisibleOn(past, new Date(2026, 5, 15), NOW)).toBe(true);
    expect(isReminderVisibleOn(past, new Date(2026, 5, 14), NOW)).toBe(false);

    const future = reminder({ dueAt: '2026-06-20T09:00:00' });
    expect(isReminderVisibleOn(future, new Date(2026, 5, 15), NOW)).toBe(false);
  });
});
