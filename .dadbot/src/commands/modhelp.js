export const command = {
	name: 'modhelp',
	description: 'Contact the moderators for help in a private chat',
	options: [
		{
			name: 'message',
			description: 'Your private message for the mods',
			type: 3,
			required: true,
		},
	],
};

export async function handler(interaction, env, ctx) {
	const token = env.DISCORD_TOKEN;
	const guildId = env.DISCORD_GUILD_ID;
	const categoryId = env.DISCORD_SUPPORT_CATEGORY_ID;
	const modsRoleId = env.DISCORD_MODS_ROLE_ID;
	const botId = env.DISCORD_APPLICATION_ID;

	const option = interaction.data.options?.find((o) => o.name === 'message');
	const userMessage = option?.value || '';
	const userId = interaction.member.user.id;
	const username = interaction.member.user.username || 'user';
	const sourceChannelId = interaction.channel_id;

	const slugify = (text) =>
		text
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, '')
			.trim()
			.split(/\s+/)
			.slice(0, 5)
			.join('-')
			.slice(0, 32) || 'help';

	const slug = slugify(userMessage);

	try {
		const channelRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bot ${token}`,
			},
			body: JSON.stringify({
				name: `modhelp-${username}-${slug}`,
				type: 0, // GUILD_TEXT
				parent_id: categoryId,
				permission_overwrites: [
					{
						id: guildId,
						deny: 1024, // VIEW_CHANNEL
						type: 0,
					},
					{
						id: userId,
						allow: 1024 | 2048,
						type: 1,
					},
					{
						id: modsRoleId,
						allow: 1024 | 2048,
						type: 0,
					},
					{
						id: botId,
						allow: 1024 | 2048,
						type: 1,
					},
				],
			}),
		});
		const channelData = await channelRes.json();

		if (channelRes.ok) {
			await fetch(`https://discord.com/api/v10/channels/${channelData.id}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bot ${token}`,
				},
				body: JSON.stringify({
					content: `<@&${modsRoleId}> New request from <@${userId}> in <#${sourceChannelId}>:\n${userMessage}`,
					allowed_mentions: { parse: ['users', 'roles'] },
				}),
			});
			return Response.json({
				type: 4,
				data: {
					content: `The mods have been notified. Your private support channel is <#${channelData.id}>`,
					flags: 64,
				},
			});
		} else {
			console.error('Failed to create support channel', channelData);
			return Response.json({
				type: 4,
				data: {
					content: 'Failed to create support channel.',
					flags: 64,
				},
			});
		}
	} catch (err) {
		console.error('Error handling modhelp command', err);
		return Response.json({
			type: 4,
			data: {
				content: 'Failed to contact mods.',
				flags: 64,
			},
		});
	}
}
