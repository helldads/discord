import { formatQuote } from '../lib/format.js';
import { fetchJsonWithTimeout } from '../lib/fetch.js';

export async function handler(controller, env, ctx) {
	const token = env.DISCORD_TOKEN;
	const channelId = env.DISCORD_MAIN_CHANNEL_ID;

	if (!token || !channelId) {
		console.error('Missing DISCORD_TOKEN or DISCORD_QUOTE_CHANNEL_ID');
		return;
	}
	try {
		const quote = await fetchJsonWithTimeout(env.HELLDADS_QUOTES_DAILY_URL);
		const message = formatQuote(quote);
		await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bot ${token}`,
			},
			body: JSON.stringify({ content: message }),
		});
	} catch (err) {
		console.error('Failed to post daily quote', err);
	}
}
