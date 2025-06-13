// discord verification
import { verifyKey } from './verify-discord.js';

// slash commands
import * as stats from './commands/stats.js';
import * as quoteOfTheDay from './commands/quote-of-the-day.js';
import { getRandomQuote, formatQuote } from './commands/quote-of-the-day.js';
import * as modHelp from './commands/modhelp.js';

const commandHandlers = {
	[stats.command.name]: stats.handler,
	[quoteOfTheDay.command.name]: quoteOfTheDay.handler,
	[modHelp.command.name]: modHelp.handler,
};

export default {
	// FETCH http request handler
	async fetch(request, env, ctx) {
		if (request.method !== 'POST') {
			return new Response('Expected POST', { status: 405 });
		}

		// Verify the signature
		const signature = request.headers.get('X-Signature-Ed25519');
		const timestamp = request.headers.get('X-Signature-Timestamp');
		const body = await request.text();

		const isValidRequest = verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
		if (!isValidRequest) {
			return new Response('Invalid request signature', { status: 401 });
		}

		// Parse the interaction
		const interaction = JSON.parse(body);

		// Pong on PING
		if (interaction.type === 1) {
			return Response.json({ type: 1 }); // PONG
		}

		// Handle commands
		if (interaction.type === 2) {
			// ApplicationCommand
			const name = interaction.data.name;
			const handler = commandHandlers[name];
			if (handler) {
				return await handler(interaction, env, ctx);
			} else {
				return Response.json({
					type: 4,
					data: { content: 'Command not found.' },
				});
			}
		}

		return new Response('Unhandled request', { status: 400 });
	},

	// SCHEDULED cron request handler
	async scheduled(controller, env, ctx) {
		// Post a quote of the day into a discord channel
		const token = env.DISCORD_TOKEN;
		const channelId = env.DISCORD_QUOTE_CHANNEL_ID;

		if (!token || !channelId) {
			console.error('Missing DISCORD_TOKEN or DISCORD_QUOTE_CHANNEL_ID');
			return;
		}
		try {
			const quote = getRandomQuote();
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
	},
};
