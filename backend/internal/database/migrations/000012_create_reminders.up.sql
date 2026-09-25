CREATE TABLE reminders (
    id                bigserial PRIMARY KEY,
    user_id           bigint NOT NULL,
    title             varchar(255) NOT NULL,
    description       text,
    due_at            timestamptz NOT NULL,
    active_from       timestamptz,
    completed_at      timestamptz,
    privacy_status    varchar(20) NOT NULL DEFAULT 'private',
    created_at        timestamptz,
    updated_at        timestamptz,
    deleted_at        timestamptz
);

CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_deleted_at ON reminders(deleted_at);
