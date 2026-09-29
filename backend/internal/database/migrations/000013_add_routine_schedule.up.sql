ALTER TABLE routines
    ADD COLUMN day_time VARCHAR(20) NOT NULL DEFAULT 'notSpecified',
    ADD COLUMN day_frequency TEXT;
