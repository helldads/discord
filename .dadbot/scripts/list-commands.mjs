import 'dotenv/config';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;

const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

async function main() {
	const res = await fetch(url, {
		headers: {
			Authorization: `Bot ${DISCORD_TOKEN}`,
		},
	});

	const data = await res.json();
	console.log('Registered Commands:', data);
}

main().catch(console.error);
