import 'dotenv/config';
import fetch from 'node-fetch';

import * as stats from '../src/commands/stats.js';
import * as quote from '../src/commands/quote.js';
import * as modHelp from '../src/commands/modhelp.js';
import * as help from '../src/commands/help.js';
import * as submit from '../src/commands/submit.js';
import * as update from '../src/commands/update.js';
import * as highscores from '../src/commands/highscores.js';
import * as event from '../src/commands/event.js';

const commands = [
	stats.command,
	quote.command,
	modHelp.command,
	help.command,
	submit.command,
	update.command,
	highscores.command,
	event.command,
];

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
