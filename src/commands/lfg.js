const factions = [
	{ name: 'Any', value: 'any' },
	{ name: 'Automatons', value: 'automatons' },
	{ name: 'Terminids', value: 'terminids' },
	{ name: 'Illuminates', value: 'illuminates' },
];

const activities = [
	{ name: 'Major Order', value: 'major_order' },
	{ name: 'Event', value: 'event' },
	{ name: 'Fun', value: 'fun' },
	{ name: 'Farming', value: 'farming' },
	{ name: 'Training', value: 'training' },
	{ name: 'Testing', value: 'testing' },
	{ name: 'Video Recording', value: 'video_recording' },
	{ name: 'Streaming', value: 'streaming' },
];

const difficulties = [
	{ name: 'Low (1–3)', value: 'low' },
	{ name: 'Medium (4–6)', value: 'medium' },
	{ name: 'High (7–9)', value: 'high' },
	{ name: 'Super (10)', value: 'super' },
];

const maxPlayers = [
	{ name: 'Unlimited', value: 'unlimited' },
	{ name: '2', value: '2' },
	{ name: '3', value: '3' },
	{ name: '4', value: '4' },
];

export const command = {
	name: 'lfg',
	description: 'Create a temporary squad voice channel',
	options: [
		{
			name: 'faction',
			description: 'Preferred faction',
			type: 3,
			required: false,
			choices: factions,
		},
		{
			name: 'activity',
			description: 'What are you diving for?',
			type: 3,
			required: false,
			choices: activities,
		},
		{
			name: 'difficulty',
			description: 'Requested difficulty',
			type: 3,
			required: false,
			choices: difficulties,
		},
		{
			name: 'friendcode',
			description: 'Your Helldivers friend code without # (format: 1234-5678)',
			type: 3,
			required: false,
		},
		{
			name: 'comment',
			description: 'Short custom instructions (e.g. “can’t talk”)',
			type: 3,
			required: false,
		},
		{
			name: 'max_players',
			description: 'Limit how many players can join',
			type: 3,
			required: false,
			choices: maxPlayers,
		},
	],
};

const choiceName = (choices, value, fallback) => choices.find((c) => c.value === value)?.name || fallback;

const formatSummary = (params) => {
	const lines = [
		`**Faction:** ${choiceName(factions, params.faction, 'Any')}`,
		`**Activity:** ${choiceName(activities, params.activity, 'Any')}`,
		`**Difficulty:** ${choiceName(difficulties, params.difficulty, 'Any')}`,
		`**Max Players:** ${params.maxPlayersLabel}`,
	];

	if (params.friendcode) {
		lines.push(`**Friend Code:** #${params.friendcode}`);
	}
	if (params.comment) {
		lines.push(`**Note:** ${params.comment}`);
	}

	return lines.join('\n');
};

const slugify = (text) =>
	text
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '')
		.slice(0, 32);

export async function handler(interaction, env, ctx) {
	const token = env.DISCORD_TOKEN;
	const guildId = env.DISCORD_GUILD_ID;
	const categoryId = env.DISCORD_LFG_CATEGORY_ID;

	const options = interaction.data.options ?? [];
	const getOptionValue = (name) => options.find((o) => o.name === name)?.value;

	const faction = getOptionValue('faction') || 'any';
	const activity = getOptionValue('activity');
	const difficulty = getOptionValue('difficulty');
	const friendcode = getOptionValue('friendcode');
	const comment = getOptionValue('comment');
	const maxPlayersOption = getOptionValue('max_players') || 'unlimited';

	if (friendcode && !/^\d{4}-\d{4}$/.test(friendcode)) {
		return Response.json({
			type: 4,
			data: {
				content: 'Invalid friend code format. Please use `1234-5678` (without #).',
				flags: 64,
			},
		});
	}

	const userLimit = maxPlayersOption === 'unlimited' ? 0 : Number(maxPlayersOption);
	const maxPlayersLabel = choiceName(maxPlayers, maxPlayersOption, 'Unlimited');

	const userId = interaction.member?.user?.id;
	const channelName = slugify(['lfg', difficulty, faction, activity].filter((n) => n).join('-'));

	const channelPayload = {
		name: channelName,
		type: 2, // GUILD_VOICE
		user_limit: Number.isNaN(userLimit) ? 0 : userLimit,
	};

	if (categoryId) {
		channelPayload.parent_id = categoryId;
	}

	try {
		const channelRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bot ${token}`,
			},
			body: JSON.stringify(channelPayload),
		});
		const channelData = await channelRes.json();

		if (!channelRes.ok) {
			console.error('Failed to create lfg channel', channelData);
			return Response.json({
				type: 4,
				data: {
					content: 'Failed to create a squad channel. Please try again.',
					flags: 64,
				},
			});
		}

		const summary = formatSummary({
			faction,
			activity,
			difficulty,
			maxPlayersLabel,
			friendcode,
			comment,
		});

		return Response.json({
			type: 4,
			data: {
				content: `<@${userId}> is looking for a group (@LFG) in squad voice channel: <#${channelData.id}>\n${summary}`,
				allowed_mentions: { users: [userId] },
			},
		});
	} catch (err) {
		console.error('Error handling lfg command', err);
		return Response.json({
			type: 4,
			data: {
				content: 'Failed to create a squad channel. Please try again.',
				flags: 64,
			},
		});
	}
}
