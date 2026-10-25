-- Weekly recurrence support.
--
-- A recurring event is materialized: one row per occurrence. The read path
-- (overlap query, week grid) therefore needs no special casing. Rows that
-- belong to a series share a series_id and carry their position in the
-- series; one-off events keep every column NULL.
ALTER TABLE calendar_events
    ADD COLUMN series_id varchar(64),
    ADD COLUMN occurrence_index int,
    ADD COLUMN recurrence_rule varchar(20),
    ADD COLUMN recurrence_until timestamptz,
    ADD COLUMN recurrence_interval int;

CREATE INDEX idx_calendar_events_series ON calendar_events(user_id, series_id);
