-- Onboarding guide state, per account. NULL = guide not completed yet.
-- Existing users are backfilled as completed so only new sign-ups see it.
ALTER TABLE users ADD COLUMN onboarding_completed_at TIMESTAMPTZ;

UPDATE users SET onboarding_completed_at = now() WHERE onboarding_completed_at IS NULL;
