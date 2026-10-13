CREATE TABLE note_groups (
    id          bigserial PRIMARY KEY,
    user_id     bigint NOT NULL,
    name        varchar(255) NOT NULL,
    position    int NOT NULL DEFAULT 0,
    created_at  timestamptz,
    updated_at  timestamptz,
    deleted_at  timestamptz
);

CREATE INDEX idx_note_groups_user_id ON note_groups(user_id);
CREATE INDEX idx_note_groups_deleted_at ON note_groups(deleted_at);

ALTER TABLE notes ADD COLUMN group_id bigint;
ALTER TABLE notes ADD COLUMN position int NOT NULL DEFAULT 0;

-- Preserve the current visual ordering (most recently edited first) as
-- explicit per-user positions; unsetPosition rows keep default 0 and
-- tie-break on updated_at DESC, so nothing changes until the user reorders.
UPDATE notes
SET position = sub.rn - 1
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, id DESC) AS rn
    FROM notes
) sub
WHERE notes.id = sub.id;

CREATE INDEX idx_notes_group_id ON notes(group_id);

ALTER TABLE notes
    ADD CONSTRAINT fk_notes_note_group
    FOREIGN KEY (group_id) REFERENCES note_groups(id) ON DELETE SET NULL;
