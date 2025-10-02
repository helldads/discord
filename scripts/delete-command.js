import 'dotenv/config';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`;

async function main() {
	const res = await fetch(url, {
		headers: {
			Authorization: `Bot ${DISCORD_TOKEN}`,
		},
	});

	const data = await res.json();
	console.log('Current Commands:', data);

	for (const cmd of data) {
		if (cmd.name === 'quote-of-the-day') {
			const deleteUrl = `${url}/${cmd.id}`;
			console.log(`Deleting command '${cmd.name}' (${cmd.id})...`);
			const delRes = await fetch(deleteUrl, {
				method: 'DELETE',
				headers: {
					Authorization: `Bot ${DISCORD_TOKEN}`,
				},
			});
			console.log('Delete status:', delRes.status);
		}
	}
}

main().catch(console.error);
