-- Restore the status column; rows come back as 'active' (previous
-- draft/stopped values are unrecoverable).
ALTER TABLE routines ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
