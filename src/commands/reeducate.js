import { getTimestampFromSnowflake } from '../lib/snowflake.js';

const API = 'https://discord.com/api/v10';
const VIEW_CHANNEL = 1024;
const SEND_MESSAGES = 2048;
const COOLDOWN_MS = 30 * 60 * 1000;

export const command = {
	name: 'reeducate',
	description: 'Privately report dissident behavior to the moderators',
	options: [
		{ name: 'user', description: 'Dissident to report', type: 6, required: true },
	],
};

const reply = (content) => Response.json({ type: 4, data: { content, flags: 64 } });
const defer = () => Response.json({ type: 5, data: { flags: 64 } });
const roleList = (env) => [
	env.DISCORD_ADMIN_ROLE_ID,
	env.DISCORD_MODS_ROLE_ID,
	env.DISCORD_DEMOCRACY_OFFICER_ROLE_ID,
];
const trustedRoles = (env) => [...roleList(env), env.DISCORD_MODEL_CITIZEN_ROLE_ID];
const hasRole = (member, ids) => (member.roles || []).some((id) => ids.includes(id));
const slug = (value) => (value || 'user').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 32);
const getInput = (interaction, id) => interaction.data.components
	?.flatMap((row) => row.components || [])
	.find((component) => component.custom_id === id)?.value?.trim() || '';

async function discord(env, path, method = 'GET', payload) {
	const response = await fetch(API + path, {
		method,
		headers: {
			Authorization: 'Bot ' + env.DISCORD_TOKEN,
			...(payload ? { 'Content-Type': 'application/json' } : {}),
		},
		...(payload ? { body: JSON.stringify(payload) } : {}),
	});
	if (!response.ok) throw new Error('Discord API ' + response.status + ' on ' + path);
	if (response.status === 204) return null;
	return response.json();
}

const guildMember = (env, id) => discord(env, '/guilds/' + env.DISCORD_GUILD_ID + '/members/' + id);

async function checkTarget(env, targetId, reporterId) {
	if (targetId === reporterId) throw new Error('You cannot report yourself.');
	const [target, guild] = await Promise.all([
		guildMember(env, targetId).catch(() => null),
		discord(env, '/guilds/' + env.DISCORD_GUILD_ID),
	]);
	if (!target) throw new Error('This member could not be found.');
	if (target.user?.bot || targetId === guild.owner_id || hasRole(target, roleList(env))) {
		throw new Error('This member cannot be targeted by this command.');
	}
	return target;
}

async function addDissidentRole(env, targetId, actorId) {
	const target = await checkTarget(env, targetId, actorId);
	if (target.roles.includes(env.DISCORD_DISSIDENT_ROLE_ID)) return false;
	await discord(env, '/guilds/' + env.DISCORD_GUILD_ID + '/members/' + targetId +
		'/roles/' + env.DISCORD_DISSIDENT_ROLE_ID, 'PUT');
	return true;
}

export function findCase(channels, env, targetId) {
	return channels.find((channel) =>
		channel.type === 0 &&
		channel.parent_id === env.DISCORD_SUPPORT_CATEGORY_ID &&
		channel.name.startsWith('dissident-') &&
		channel.name.endsWith('-' + targetId));
}

export function isCoolingDown(channels, env, reporterId, now = Date.now()) {
	return channels.some((channel) =>
		channel.type === 0 &&
		channel.parent_id === env.DISCORD_SUPPORT_CATEGORY_ID &&
		channel.name.startsWith('dissident-') &&
		channel.topic?.includes('reporter:' + reporterId) &&
		now - getTimestampFromSnowflake(channel.id) < COOLDOWN_MS);
}

export function recentlyReported(messages, reporterId, now = Date.now()) {
	return messages.some((message) =>
		message.content?.includes('New dissident report from <@' + reporterId + '>') &&
		now - getTimestampFromSnowflake(message.id) < COOLDOWN_MS);
}

function permissions(env, reporterId) {
	return [
		{ id: env.DISCORD_GUILD_ID, type: 0, deny: VIEW_CHANNEL },
		{ id: env.DISCORD_MODS_ROLE_ID, type: 0, allow: VIEW_CHANNEL | SEND_MESSAGES },
		{ id: reporterId, type: 1, allow: VIEW_CHANNEL | SEND_MESSAGES },
		{ id: env.DISCORD_APPLICATION_ID, type: 1, allow: VIEW_CHANNEL | SEND_MESSAGES },
	];
}

function reportMessage(env, reporterId, targetId, sourceId, reason) {
	return {
		content: '<@&' + env.DISCORD_MODS_ROLE_ID + '> New dissident report from <@' + reporterId +
			'> in <#' + sourceId + '> about <@' + targetId + '>:\n' + reason,
		allowed_mentions: { parse: [], roles: [env.DISCORD_MODS_ROLE_ID] },
		components: [{ type: 1, components: [{
			type: 2, style: 4, label: 'Reeducate', custom_id: 'reeducate:approve:' + targetId,
		}] }],
	};
}

async function updateReply(interaction, env, content) {
	await discord(env, '/webhooks/' + env.DISCORD_APPLICATION_ID + '/' +
		interaction.token + '/messages/@original', 'PATCH', { content });
}

export function handler(interaction) {
	const targetId = interaction.data.options?.find((option) => option.name === 'user')?.value;
	if (!interaction.guild_id || !/^\d{17,20}$/.test(targetId || '')) return reply('Select a server member.');

	return Response.json({ type: 9, data: {
		title: 'Report a Dissident',
		custom_id: 'reeducate:submit:' + targetId + ':' + interaction.channel_id,
		components: [
			{ type: 1, components: [{ type: 4, custom_id: 'reason',
				label: 'Reason for report', style: 2, required: true, min_length: 5, max_length: 1000 }] },
			{ type: 1, components: [{ type: 4, custom_id: 'ack',
				label: 'Misuse risks reeducation: I UNDERSTAND',
				style: 1, required: true, min_length: 12, max_length: 12 }] },
		],
	} });
}

export function onModal(interaction, env, ctx) {
	const [prefix, action, targetId, sourceId] = interaction.data.custom_id.split(':');
	const reason = getInput(interaction, 'reason');
	const acknowledged = getInput(interaction, 'ack').toUpperCase() === 'I UNDERSTAND';
	if (prefix !== 'reeducate' || action !== 'submit' || !/^\d{17,20}$/.test(targetId || '') ||
		interaction.guild_id !== env.DISCORD_GUILD_ID) return reply('Invalid report.');
	if (!acknowledged || reason.length < 5) {
		return reply('Enter a reason and type I UNDERSTAND. Misuse may result in your own reeducation.');
	}
	ctx.waitUntil(submitReport(interaction, env, targetId, sourceId, reason));
	return defer();
}

async function submitReport(interaction, env, targetId, sourceId, reason) {
	const reporterId = interaction.member.user.id;
	try {
		const [reporter, target, channels] = await Promise.all([
			guildMember(env, reporterId),
			checkTarget(env, targetId, reporterId),
			discord(env, '/guilds/' + env.DISCORD_GUILD_ID + '/channels'),
		]);
		const trusted = hasRole(reporter, trustedRoles(env));
		let channel = findCase(channels, env, targetId);
		const existing = Boolean(channel);

		if (!trusted && isCoolingDown(channels, env, reporterId)) {
			await updateReply(interaction, env, 'You recently submitted a report. Please allow 30 minutes before reporting again.');
			return;
		}

		if (channel && !trusted) {
			const messages = await discord(env, '/channels/' + channel.id + '/messages?limit=100');
			if (recentlyReported(messages, reporterId)) {
				await updateReply(interaction, env,
					'You recently submitted a report. Please allow 30 minutes before reporting again.');
				return;
			}
		}

		if (!channel) {
			channel = await discord(env, '/guilds/' + env.DISCORD_GUILD_ID + '/channels', 'POST', {
				type: 0,
				parent_id: env.DISCORD_SUPPORT_CATEGORY_ID,
				name: 'dissident-' + slug(target.user.username) + '-' + targetId,
				topic: 'target:' + targetId + ' reporter:' + reporterId,
				permission_overwrites: permissions(env, reporterId),
			});
		} else if (trusted) {
			await discord(env, '/channels/' + channel.id + '/permissions/' + reporterId, 'PUT', {
				type: 1, allow: String(VIEW_CHANNEL | SEND_MESSAGES), deny: '0',
			});
		}

		await discord(env, '/channels/' + channel.id + '/messages', 'POST',
			reportMessage(env, reporterId, targetId, sourceId, reason));

		let roleStatus = '';
		if (trusted) {
			try {
				const added = await addDissidentRole(env, targetId, reporterId);
				roleStatus = added ? ' Dissident role assigned.' : ' Dissident role already assigned.';
				await discord(env, '/channels/' + channel.id + '/messages', 'POST', {
					content: '<@' + reporterId + '> ' + (added ? 'assigned' : 'confirmed') +
						' the Dissident role for <@' + targetId + '>.',
					allowed_mentions: { parse: [] },
				});
			} catch (error) {
				console.error('Unable to assign Dissident role', error);
				roleStatus = ' Automatic role assignment failed; moderators have been notified.';
				await discord(env, '/channels/' + channel.id + '/messages', 'POST', {
					content: 'Automatic role assignment failed. A moderator should review this case.',
					allowed_mentions: { parse: [] },
				});
			}
		}

		const message = existing
			? 'Thank you. This member has already been reported.'
			: 'Thank you. Your report has been received.';
		const access = !existing || trusted
			? ' Case channel: <#' + channel.id + '>.'
			: ' A moderator will reach out if needed.';
		await updateReply(interaction, env, message + access + roleStatus);
	} catch (error) {
		console.error('Unable to process dissident report', error);
		await updateReply(interaction, env, 'Unable to process your report. Please contact the moderators with /modhelp.')
			.catch(console.error);
	}
}

export async function onButton(interaction, env, ctx) {
	const targetId = interaction.data.custom_id.split(':')[2];
	const reporterId = interaction.member?.user?.id;
	if (interaction.guild_id !== env.DISCORD_GUILD_ID || !/^\d{17,20}$/.test(targetId || '')) {
		return reply('Invalid action.');
	}
	try {
		const [moderator, channel] = await Promise.all([
			guildMember(env, reporterId),
			discord(env, '/channels/' + interaction.channel_id),
		]);
		if (!hasRole(moderator, roleList(env))) return reply('Only moderators may approve this report.');
		if (findCase([channel], env, targetId)?.id !== interaction.channel_id) {
			return reply('This report is no longer active.');
		}
	} catch (error) {
		console.error('Unable to verify report approval', error);
		return reply('Could not verify this report.');
	}

	ctx.waitUntil((async () => {
		try {
			const added = await addDissidentRole(env, targetId, reporterId);
			await discord(env, '/channels/' + interaction.channel_id + '/messages', 'POST', {
				content: '<@' + reporterId + '> ' + (added ? 'assigned' : 'confirmed') +
					' the Dissident role for <@' + targetId + '>.',
				allowed_mentions: { parse: [] },
			});
			await updateReply(interaction, env,
				added ? 'Dissident role assigned.' : 'Dissident role was already assigned.');
		} catch (error) {
			console.error('Unable to approve dissident report', error);
			await updateReply(interaction, env, 'Role assignment failed. Check the target and bot permissions.')
				.catch(console.error);
		}
	})());
	return defer();
}
