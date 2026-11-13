-- Routines no longer have a lifecycle status: every routine is active.
-- Normalize any draft/stopped rows, then drop the column.
UPDATE routines SET status = 'active' WHERE status <> 'active';

ALTER TABLE routines DROP COLUMN status;
