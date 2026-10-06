-- Remove the oneTime activity frequency. One-time events are now handled by
-- reminders, which the existing rows predate; discard them along with no
-- longer-needed enum support.
DELETE FROM activities WHERE frequency = 'oneTime';
