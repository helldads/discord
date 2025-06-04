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
				`Reddit: ${stats.reddit.subscribers} subscribers, ${stats.reddit.active_user_count} active users\n` +
				`Discord: ${stats.discord.approximate_member_count} members, ${stats.discord.approximate_presence_count} online\n` +
				`YouTube: ${stats.youtube.subscriber_count} subscribers, ${stats.youtube.video_count} videos\n\n` +
				`Last updated: <t:${unixTimestamp}:R>`;
			break;

		case 'reddit':
			message =
				`**HellDads Reddit Stats**\n` +
				`Subscribers: ${stats.reddit.subscribers}\n` +
				`Active users: ${stats.reddit.active_user_count}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>`;
			break;

		case 'discord':
			message =
				`**HellDads Discord Stats**\n` +
				`Members: ${stats.discord.approximate_member_count}\n` +
				`Online: ${stats.discord.approximate_presence_count}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>`;
			break;

		case 'youtube':
			message =
				`**HellDads YouTube Stats**\n` +
				`Subscribers: ${stats.youtube.subscriber_count}\n` +
				`Videos: ${stats.youtube.video_count}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>`;
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
