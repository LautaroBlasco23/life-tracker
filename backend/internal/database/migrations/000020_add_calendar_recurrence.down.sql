DROP INDEX IF EXISTS idx_calendar_events_series;

ALTER TABLE calendar_events
    DROP COLUMN IF EXISTS series_id,
    DROP COLUMN IF EXISTS occurrence_index,
    DROP COLUMN IF EXISTS recurrence_rule,
    DROP COLUMN IF EXISTS recurrence_until,
    DROP COLUMN IF EXISTS recurrence_interval;
