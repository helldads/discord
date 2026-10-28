CREATE TABLE IF NOT EXISTS dissident_cases (
 guild_id TEXT NOT NULL, target_id TEXT NOT NULL, channel_id TEXT,
 first_reporter_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'creating',
 updated_at INTEGER NOT NULL, PRIMARY KEY(guild_id,target_id)
);
CREATE TABLE IF NOT EXISTS dissident_report_cooldowns (
 guild_id TEXT NOT NULL, reporter_id TEXT NOT NULL, submitted_at INTEGER NOT NULL,
 PRIMARY KEY(guild_id,reporter_id)
);
