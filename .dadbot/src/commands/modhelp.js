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

	const option = interaction.data.options?.find((o) => o.name === 'message');
	const userMessage = option?.value || '';
	const userId = interaction.member.user.id;
	const username = interaction.member.user.username || 'user';
	const timestamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '-');

	try {
		const channelRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bot ${token}`,
			},
			body: JSON.stringify({
				name: `mod-help-${username}-${timestamp}`,
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
					content: `<@&${modsRoleId}> ${userMessage}`,
				}),
			});
		} else {
			console.error('Failed to create support channel', channelData);
		}
	} catch (err) {
		console.error('Error handling modhelp command', err);
	}

	return Response.json({
		type: 4,
		data: {
			content: 'The mods have been notified.',
			flags: 64,
		},
	});
}
