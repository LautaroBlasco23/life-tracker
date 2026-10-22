CREATE TABLE sticky_notes (
    id          bigserial PRIMARY KEY,
    user_id     bigint NOT NULL,
    title       varchar(255) NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    created_at  timestamptz,
    updated_at  timestamptz,
    deleted_at  timestamptz
);

CREATE INDEX idx_sticky_notes_user_id ON sticky_notes(user_id);
CREATE INDEX idx_sticky_notes_deleted_at ON sticky_notes(deleted_at);
