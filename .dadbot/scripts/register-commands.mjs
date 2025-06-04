import 'dotenv/config';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`;

// Define all your commands here:
const commands = [
	{
		name: 'stats',
		description: 'Displays HellDads community stats',
		options: [
			{
				name: 'type',
				description: 'Which stats to display (optional)',
				type: 3, // STRING
				required: false,
				choices: [
					{ name: 'community', value: 'community' },
					{ name: 'reddit', value: 'reddit' },
					{ name: 'discord', value: 'discord' },
					{ name: 'youtube', value: 'youtube' },
				],
			},
		],
	},
	{
		name: 'quote-of-the-day',
		description: 'Receive a random quote from the Democracy Officer',
	},
];

async function main() {
	console.log(`Registering ${commands.length} commands to guild ${GUILD_ID}...`);

	const res = await fetch(url, {
		method: 'PUT', // Use PUT to overwrite all commands in one go
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bot ${DISCORD_TOKEN}`,
		},
		body: JSON.stringify(commands),
	});

	const data = await res.json();

	if (res.ok) {
		console.log(
			'Successfully registered commands:',
			data.map((cmd) => cmd.name),
		);
	} else {
		console.error('Error registering commands:', data);
	}
}

main().catch(console.error);
