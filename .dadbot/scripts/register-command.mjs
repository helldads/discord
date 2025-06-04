import 'dotenv/config'; // Automatically loads .env, .dev.vars, etc.
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;

const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

const command = {
	name: 'helloworld',
	description: 'Replies with Hello World!',
	type: 1, // Chat Input
};

async function main() {
	console.log(DISCORD_TOKEN, APPLICATION_ID);
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
