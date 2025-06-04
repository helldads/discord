import 'dotenv/config';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`;

const command = {
	name: 'stats',
	description: 'Displays HellDads community stats',
	options: [
		{
			name: 'type',
			description: 'Which stats to display (optional)',
			type: 3, // STRING
			required: false, // ← now optional
			choices: [
				{ name: 'community', value: 'community' },
				{ name: 'reddit', value: 'reddit' },
				{ name: 'discord', value: 'discord' },
				{ name: 'youtube', value: 'youtube' },
			],
		},
	],
};

async function main() {
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bot ${DISCORD_TOKEN}`,
		},
		body: JSON.stringify(command),
	});

	const data = await res.json();
	console.log('Result:', data);
}

main().catch(console.error);
