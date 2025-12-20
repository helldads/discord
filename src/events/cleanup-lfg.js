import { getTimestampFromSnowflake } from '../lib/snowflake.js';

const LIFETIME_REGEX = /^\w{3}-(3|6|12|24)h-/;

const extractLifetimeHours = (name) => {
	const match = name?.match(LIFETIME_REGEX);
	return match ? Number(match[1]) : null;
};

const shouldDeleteChannel = (channel, nowMs) => {
	const lifetime = extractLifetimeHours(channel.name);
	if (!lifetime || lifetime <= 0) return false;

	const createdAt = getTimestampFromSnowflake(channel.id);
	const expiresAt = createdAt + lifetime * 60 * 60 * 1000;
	return expiresAt <= nowMs;
};

export async function handler(controller, env) {
	const token = env.DISCORD_TOKEN;
	const guildId = env.DISCORD_GUILD_ID;
	const categoryId = env.DISCORD_LFG_CATEGORY_ID;

	if (!token || !guildId || !categoryId) {
		console.error('Missing DISCORD_TOKEN, DISCORD_GUILD_ID or DISCORD_LFG_CATEGORY_ID');
		return;
	}

	try {
		const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
			headers: { Authorization: `Bot ${token}` },
		});
		const channels = await res.json();

		if (!res.ok) {
			console.error('Failed to fetch guild channels', channels);
			return;
		}

		const now = Date.now();
		const deletions = channels.filter((channel) => channel.parent_id === categoryId && shouldDeleteChannel(channel, now));

		await Promise.all(
			deletions.map((channel) =>
				fetch(`https://discord.com/api/v10/channels/${channel.id}`, {
					method: 'DELETE',
					headers: { Authorization: `Bot ${token}` },
				}),
			),
		);
	} catch (err) {
		console.error('Failed to cleanup LFG channels', err);
	}
}

export { extractLifetimeHours };
