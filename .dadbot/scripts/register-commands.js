import 'dotenv/config';
import fetch from 'node-fetch';

import * as stats from '../src/commands/stats.js';
import * as quoteOfTheDay from '../src/commands/quote-of-the-day.js';
import * as modHelp from '../src/commands/modhelp.js';
import * as help from '../src/commands/help.js';
const commands = [stats.command, quoteOfTheDay.command, modHelp.command, help.command];

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`;

async function main() {
	console.log(`Registering ${commands.length} commands to guild ${GUILD_ID}...`);

	const res = await fetch(url, {
		method: 'PUT',
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
