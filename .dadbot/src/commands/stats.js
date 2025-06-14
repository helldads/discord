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
	const unixTimestamp = Math.floor(new Date(stats.lastUpdated).getTime() / 1000);
	switch (typeValue) {
		case 'all':
			message =
				`**HellDads Community Stats**\n\n` +
				`[Reddit](<https://reddit.com/r/HellDads>): ${stats.reddit.subscribers} subscribers, ${stats.reddit.active_user_count} active users\n` +
				`[Discord](<https://tinyurl.com/discord-helldads>): ${stats.discord.approximate_member_count} members, ${stats.discord.approximate_presence_count} online\n` +
				`[TikTok](<https://www.tiktok.com/@helldads>): ${stats.tiktok.follower_count} followers, ${stats.tiktok.video_count} videos\n` +
				`[YouTube](<https://www.youtube.com/@HellDadsHQ>): ${stats.youtube.subscriber_count} subscribers, ${stats.youtube.video_count} videos\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		case 'reddit':
			message =
				`**HellDads [Reddit](<https://reddit.com/r/HellDads>) Stats**\n` +
				`Subscribers: ${stats.reddit.subscribers}\n` +
				`Active users: ${stats.reddit.active_user_count}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		case 'discord':
			message =
				`**HellDads [Discord](<https://tinyurl.com/discord-helldads>) Stats**\n` +
				`Members: ${stats.discord.approximate_member_count}\n` +
				`Online: ${stats.discord.approximate_presence_count}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		case 'tiktok':
			message =
				`**HellDads [TikTok](<https://www.tiktok.com/@helldads>) Stats**\n` +
				`Follower: ${stats.tiktok.follower_count}\n` +
				`Videos: ${stats.tiktok.video_count}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		case 'youtube':
			message =
				`**HellDads [YouTube](<https://www.youtube.com/@HellDadsHQ>) Stats**\n` +
				`Subscribers: ${stats.youtube.subscriber_count}\n` +
				`Videos: ${stats.youtube.video_count}\n\n` +
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
