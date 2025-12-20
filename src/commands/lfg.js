import { getTimestampFromSnowflake } from '../lib/snowflake.js';

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

const expiries = [
	{ name: '3 hours', value: 3 },
	{ name: '6 hours', value: 6 },
	{ name: '12 hours', value: 12 },
	{ name: '24 hours', value: 24 },
	{ name: 'never', value: 0 },
];

const bannedSlugs = ['ass', 'cum', 'dic', 'fag', 'fuk', 'fux', 'gay', 'hoe', 'kkk', 'nig', 'sex', 'tit', 'xxx', '420', '666', '888'];

const SLUG_REGEX = /^[a-zA-Z0-9]{3}$/;

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
			description: 'Preferred difficulty',
			type: 3,
			required: false,
			choices: difficulties,
		},
		{
			name: 'friendcode',
			description: 'Your Helldivers friend code (format: #1234-5678)',
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
		{
			name: 'slug',
			description: '3-letter acronym used to identify the channel, default is "lfg"',
			type: 3,
			required: false,
		},
		{
			name: 'expiry',
			description: 'After how many hours should the channel be automatically deleted (default: 3h)',
			type: 4,
			required: false,
			choices: expiries,
		},
		{
			name: 'ping',
			description: 'Post the confirmation message in this channel and notify all @LFG subscribers (default: on)',
			type: 5,
			required: false,
		},
	],
};

const choiceName = (choices, value, fallback) => choices.find((c) => c.value === value)?.name || fallback;

const formatSummary = (params) => {
	const expireTime = params.deletionDate ? ` (<t:${Math.floor(params.deletionDate.getTime() / 1000)}:R>)` : '';
	const lines = [
		`**Faction:** ${choiceName(factions, params.faction, 'Any')}`,
		`**Activity:** ${choiceName(activities, params.activity, 'Any')}`,
		`**Difficulty:** ${choiceName(difficulties, params.difficulty, 'Any')}`,
		`**Max Players:** ${params.maxPlayersLabel}`,
		`**Expires in:** ${choiceName(expiries, params.expiryHours, 'never')}${expireTime}`,
	];

	if (params.friendcode) {
		const friendcode = params.friendcode.replace(/\D/g, '');
		lines.push(`**Friend Code:** #${friendcode.slice(0, 4)}-${friendcode.slice(4)}`);
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
		.slice(0, 32)
		.replace(/-$/, '');

export const buildSummary = formatSummary;

export const buildConfirmationMessage = (lfgId, userId, channelId, summary) =>
	`<@&${lfgId}>: <@${userId}> is looking for a group in voice channel: <#${channelId}>\n${summary}`;

export const buildChannelName = ({ slug, expiryHours, difficulty, faction, activity, username }) =>
	slugify([slug, expiryHours ? `${expiryHours}h` : null, difficulty, faction, activity, username].filter((n) => n).join('-'));

export const isValidSlug = (slug) => SLUG_REGEX.test(slug) && !bannedSlugs.includes(slug);

export async function handler(interaction, env, ctx) {
	const token = env.DISCORD_TOKEN;
	const guildId = env.DISCORD_GUILD_ID;
	const categoryId = env.DISCORD_LFG_CATEGORY_ID;
	const lfgId = env.DISCORD_LFG_ROLE_ID;

	const options = interaction.data.options ?? [];
	const getOptionValue = (name) => options.find((o) => o.name === name)?.value;

	const faction = getOptionValue('faction') || 'any';
	const activity = getOptionValue('activity');
	const difficulty = getOptionValue('difficulty');
	const friendcode = getOptionValue('friendcode');
	const comment = getOptionValue('comment');
	const maxPlayersOption = getOptionValue('max_players') || 'unlimited';
	const slug = (getOptionValue('slug') || 'lfg').toLowerCase();
	const expiryHours = Number(getOptionValue('expiry') ?? 3);
	const ping = getOptionValue('ping');
	const shouldPing = ping === undefined ? true : Boolean(ping);

	if (friendcode && !/^#?\d{4}-?\d{4}$/.test(friendcode)) {
		return Response.json({
			type: 4,
			data: {
				content: 'Invalid friend code format. Please use `1234-5678`.',
				flags: 64,
			},
		});
	}

	if (!isValidSlug(slug)) {
		return Response.json({
			type: 4,
			data: {
				content: 'Invalid channel slug. Please use a 3-character alphanumeric value. Some acronyms are blocked to avoid profanity.',
				flags: 64,
			},
		});
	}

	const userLimit = maxPlayersOption === 'unlimited' ? 0 : Number(maxPlayersOption);
	const maxPlayersLabel = choiceName(maxPlayers, maxPlayersOption, 'Unlimited');

	const userId = interaction.member?.user?.id;
	const username = interaction.member.user.username || 'squad';
	const channelName = buildChannelName({ slug, expiryHours, difficulty, faction, activity, username });

	const channelPayload = {
		name: channelName,
		type: 2, // GUILD_VOICE
		user_limit: Number.isNaN(userLimit) ? 0 : userLimit,
		position: 0,
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
			console.error('Failed to create voice channel', channelData);
			return Response.json({
				type: 4,
				data: {
					content: 'Failed to create a voice channel. Please try again later.',
					flags: 64,
				},
			});
		}

		const creationTimestamp = getTimestampFromSnowflake(channelData.id);
		const deletionDate = expiryHours > 0 ? new Date(creationTimestamp + expiryHours * 60 * 60 * 1000) : null;

		const summary = formatSummary({
			faction,
			activity,
			difficulty,
			maxPlayersLabel,
			friendcode,
			expiryHours,
			deletionDate,
			comment,
		});

		const confirmationMessage = buildConfirmationMessage(lfgId, userId, channelData.id, summary);

		await fetch(`https://discord.com/api/v10/channels/${channelData.id}/messages`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bot ${token}`,
			},
			body: JSON.stringify({
				content: summary,
				allowed_mentions: { users: [userId] },
			}),
		});

		return Response.json({
			type: 4,
			data: {
				content: shouldPing ? confirmationMessage : `Your channel has been created: <#${channelData.id}>`,
				allowed_mentions: shouldPing ? { users: [userId] } : undefined,
				flags: shouldPing ? undefined : 64,
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
