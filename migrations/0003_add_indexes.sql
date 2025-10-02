CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user);
CREATE INDEX IF NOT EXISTS idx_submissions_date ON submissions(date);
CREATE INDEX IF NOT EXISTS idx_highscores_user ON highscores(user);

