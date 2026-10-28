-- Week day selection for weekly recurrence.
--
-- The series is already materialized (one row per occurrence), so this column
-- is an echo of the rule used to expand it. Values are comma-separated day
-- names (e.g. "monday,wednesday"); one-off events keep the column NULL. Rows
-- created before this change repeat on the first occurrence's weekday.
ALTER TABLE calendar_events
    ADD COLUMN recurrence_weekdays varchar(60);
