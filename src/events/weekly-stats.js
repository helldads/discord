import { fetchJsonWithTimeout } from '../lib/fetch.js';
import { formatStatsMessage } from '../lib/format.js';

/**
 * Retrieve community statistics and post a formatted weekly summary into the
 * main Discord channel.
 *
 * @param {ScheduledController} controller - Cloudflare controller for the scheduled event.
 * @param {Record<string, string>} env - Bindings providing the Discord token,
 *   channel ID and statistics URL.
 * @param {ExecutionContext} ctx - Execution context provided by the platform.
 */
export async function handler(controller, env, ctx) {
	const token = env.DISCORD_TOKEN;
	const channelId = env.DISCORD_MAIN_CHANNEL_ID;

	if (!token || !channelId) {
		console.error('Missing DISCORD_TOKEN or DISCORD_MAIN_CHANNEL_ID');
		//return;
	}

	try {
		const stats = await fetchJsonWithTimeout(env.HELLDADS_STATS_URL);
		const message = formatStatsMessage(stats);

		console.log('STATS', stats);
		console.log('MESSAGE', message);

		await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bot ${token}`,
			},
			body: JSON.stringify({ content: message }),
		});
	} catch (err) {
		console.error('Failed to post weekly stats', err);
	}
}
