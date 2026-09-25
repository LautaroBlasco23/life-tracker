import type { PrivacyStatus } from './activity';

/**
 * A one-time reminder that becomes completable during an active window:
 * locked before `activeFrom`, completable until `dueAt`, missed afterwards.
 */
export interface Reminder {
  id: number;
  userId: number;
  title: string;
  description: string;
  /** Deadline: the reminder can no longer be completed after this. */
  dueAt: string;
  /** When the reminder unlocks for completion (null → always completable). */
  activeFrom: string | null;
  /** Set when the reminder is completed (possibly after the deadline). */
  completedAt: string | null;
  privacyStatus?: PrivacyStatus;
  createdAt: string;
  updatedAt: string;
}

export type ReminderStatus = 'locked' | 'active' | 'missed' | 'completed';

export interface CreateReminderRequest {
  title: string;
  description: string;
  dueAt: string;
  activeFrom?: string;
  privacyStatus?: PrivacyStatus;
}

export interface UpdateReminderRequest {
  title?: string;
  description?: string;
  dueAt?: string;
  activeFrom?: string | null;
  privacyStatus?: PrivacyStatus;
}

export function getReminderStatus(
  reminder: Pick<Reminder, 'dueAt' | 'activeFrom' | 'completedAt'>,
  now: Date = new Date()
): ReminderStatus {
  if (reminder.completedAt) return 'completed';
  if (now > new Date(reminder.dueAt)) return 'missed';
  if (reminder.activeFrom && now < new Date(reminder.activeFrom))
    return 'locked';
  return 'active';
}
