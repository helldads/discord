/**
 * Slash command definition for `/stats`.
 * Displays community statistics collected from various services.
 */
import { formatNumber } from '../lib/format.js';
export const command = {
	name: 'stats',
	description: 'Displays HellDads community stats',
	options: [
		{
			name: 'type',
			description: 'Which stats to display (optional)',
			type: 3,
			required: false,
			choices: [
				{ name: 'all', value: 'all' },
				{ name: 'reddit', value: 'reddit' },
				{ name: 'discord', value: 'discord' },
				{ name: 'tiktok', value: 'tiktok' },
				{ name: 'youtube', value: 'youtube' },
			],
		},
	],
};

/**
 * Handle the `/stats` slash command.
 *
 * @param {Object} interaction - Discord interaction payload.
 * @param {Object} env - Worker environment bindings.
 * @param {ExecutionContext} ctx - Worker execution context.
 */
export async function handler(interaction, env, ctx) {
	const typeOption = interaction.data.options?.find((opt) => opt.name === 'type');
	const typeValue = typeOption?.value || 'all';

	// Fetch the JSON
	let stats;
	try {
		const res = await fetch(env.HELLDADS_STATS_URL);
		stats = await res.json();
	} catch (err) {
		return Response.json({
			type: 4,
			data: {
				content: `Could not fetch community stats from ${env.HELLDADS_STATS_URL}. Please try again later.`,
			},
		});
	}

	// Format output
	let message = '';
	const nf = formatNumber;
	const unixTimestamp = Math.floor(new Date(stats.lastUpdated).getTime() / 1000);
	switch (typeValue) {
		case 'all':
			message =
				`**HellDads Community Stats**\n\n` +
				`[Reddit](<https://reddit.com/r/HellDads>): ${nf(stats.reddit.subscribers)} subscribers, ${nf(stats.reddit.active_user_count)} active users\n` +
				`[Discord](<https://tinyurl.com/discord-helldads>): ${nf(stats.discord.approximate_member_count)} members, ${nf(stats.discord.approximate_presence_count)} online\n` +
				`[TikTok](<https://www.tiktok.com/@helldads>): ${nf(stats.tiktok.follower_count)} followers, ${nf(stats.tiktok.video_count)} videos\n` +
				`[YouTube](<https://www.youtube.com/@HellDadsHQ>): ${nf(stats.youtube.subscriber_count)} subscribers, ${nf(stats.youtube.video_count)} videos\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		case 'reddit':
			message =
				`**HellDads [Reddit](<https://reddit.com/r/HellDads>) Stats**\n` +
				`Subscribers: ${nf(stats.reddit.subscribers)}\n` +
				`Active users: ${nf(stats.reddit.active_user_count)}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		case 'discord':
			message =
				`**HellDads [Discord](<https://tinyurl.com/discord-helldads>) Stats**\n` +
				`Members: ${nf(stats.discord.approximate_member_count)}\n` +
				`Online: ${nf(stats.discord.approximate_presence_count)}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		case 'tiktok':
			message =
				`**HellDads [TikTok](<https://www.tiktok.com/@helldads>) Stats**\n` +
				`Follower: ${nf(stats.tiktok.follower_count)}\n` +
				`Videos: ${nf(stats.tiktok.video_count)}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		case 'youtube':
			message =
				`**HellDads [YouTube](<https://www.youtube.com/@HellDadsHQ>) Stats**\n` +
				`Subscribers: ${nf(stats.youtube.subscriber_count)}\n` +
				`Videos: ${nf(stats.youtube.video_count)}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		default:
			message = 'Unknown type.';
	}

	return Response.json({
		type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
		data: {
			content: message,
		},
	});
}
