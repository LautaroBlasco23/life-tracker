CREATE TABLE calendar_events (
    id          bigserial PRIMARY KEY,
    user_id     bigint NOT NULL,
    title       varchar(255) NOT NULL,
    description text,
    category    varchar(100) NOT NULL DEFAULT 'Other',
    start_at    timestamptz NOT NULL,
    end_at      timestamptz NOT NULL,
    created_at  timestamptz,
    updated_at  timestamptz,
    deleted_at  timestamptz
);

CREATE INDEX idx_calendar_events_user_start ON calendar_events(user_id, start_at);
CREATE INDEX idx_calendar_events_deleted_at ON calendar_events(deleted_at);
