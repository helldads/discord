ALTER TABLE submissions ADD COLUMN event_kotk_diaper_kills INTEGER;
ALTER TABLE submissions ADD COLUMN event_kotk_baldzerkers_kills INTEGER;
ALTER TABLE submissions ADD COLUMN event_kotk_science_kills INTEGER;
ALTER TABLE submissions ADD COLUMN event_kotk_crayon_kills INTEGER;
ALTER TABLE submissions ADD COLUMN event_kotk_snack_kills INTEGER;
CREATE INDEX IF NOT EXISTS idx_submissions_event_key ON submissions(event_key);
CREATE INDEX IF NOT EXISTS idx_submissions_event_key_user ON submissions(event_key,user);
